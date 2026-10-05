// @vitest-environment jsdom
//
// iPad / iPhone の Safari で「入力欄をタップしてもキーボードが出ない」を ふせぐための テスト。
// 実際の画面（App と、開いたダイアログ）を jsdom で描いて、次を しらべる:
//   1. 入力欄（input / textarea / select）と、その祖先（html・body・モーダル…）に
//      user-select: none / -webkit-touch-callout: none / touch-action: none / pointer-events: none が かかっていない
//   2. 入力欄へのタッチ・クリックを、だれも preventDefault していない
//   3. 入力欄は、ドラッグできる部品（dnd-kit）の中に ない。入っていても ドラッグは はじまらない
//   4. （iOS の standalone = ホーム画面のアプリ 対策）入力欄の祖先に position: fixed / transform / overflow / 100vh などが ない。
//      ダイアログは 重ね合わせではなく、ふつうの全画面ページ。viewport に user-scalable=no などが ない
import { createRoot, type Root } from 'react-dom/client'
import { act, useState } from 'react'
import { DndContext, MouseSensor, TouchSensor, useDraggable, useSensor, useSensors } from '@dnd-kit/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { App } from './App'
import { SafeMouseSensor, SafeTouchSensor, isInteractiveTarget } from './dndSensors'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// ※ vitest では CSS を import すると 空になるので、ファイルを直接よむ（空だと検査が空振りになるので、長さも しらべる）
const cssText = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

// ---- CSS を読む（かんたんな パーサー） ----

interface Rule {
  selectors: string[]
  decls: Record<string, string>
}

function splitTop(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function parseCss(src: string): Rule[] {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  const walk = (text: string) => {
    let i = 0
    while (i < text.length) {
      const open = text.indexOf('{', i)
      if (open < 0) break
      const head = text.slice(i, open).trim()
      let depth = 1
      let j = open + 1
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
        j++
      }
      const body = text.slice(open + 1, j - 1)
      if (head.startsWith('@')) {
        if (/^@(media|supports|layer)/.test(head)) walk(body) // @keyframes / @font-face は とばす
      } else {
        const decls: Record<string, string> = {}
        for (const d of splitTop(body, ';')) {
          const k = d.indexOf(':')
          if (k > 0) decls[d.slice(0, k).trim().toLowerCase()] = d.slice(k + 1).trim().replace(/\s*!important$/, '').toLowerCase()
        }
        rules.push({ selectors: splitTop(head, ',').map((s) => s.trim()), decls })
      }
      i = j
    }
  }
  walk(css)
  return rules
}

/** 入力欄に かけては いけない設定 */
const SUPPRESSORS: [string, string][] = [
  ['user-select', 'none'],
  ['-webkit-user-select', 'none'],
  ['-webkit-touch-callout', 'none'],
  ['touch-action', 'none'],
  ['pointer-events', 'none'],
]

const CONTROL = 'input, textarea, select'

const label = (el: Element) => `<${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}${el.getAttribute('aria-label') ? ` aria-label="${el.getAttribute('aria-label')}"` : ''}>`

/** 入力欄と、その祖先（自分・html まで）に、抑止設定をかける rule を さがす */
function findViolations(css: string, root: ParentNode = document): string[] {
  const rules = parseCss(css).filter((r) => SUPPRESSORS.some(([k, v]) => r.decls[k] === v))
  const found: string[] = []
  const controls = Array.from(root.querySelectorAll(CONTROL)).filter((c) => !c.hasAttribute('hidden'))
  for (const c of controls) {
    for (let el: Element | null = c; el; el = el.parentElement) {
      for (const r of rules) {
        for (const sel of r.selectors) {
          if (sel.includes('::')) continue
          let hit = false
          try {
            hit = el.matches(sel)
          } catch {
            hit = false
          }
          if (hit) {
            const which = SUPPRESSORS.filter(([k, v]) => r.decls[k] === v).map(([k, v]) => `${k}: ${v}`)
            found.push(`${label(c)} ${el === c ? 'じしん' : `の祖先 ${label(el)}`} に「${sel}」で ${which.join(', ')}`)
          }
        }
      }
    }
  }
  return found
}

/** iOS の standalone（ホーム画面のアプリ）で、入力欄にキーボードが出なくなる原因に なりやすい、入力欄の祖先の指定 */
const RISKS: { prop: string; bad: (v: string) => boolean }[] = [
  { prop: 'position', bad: (v) => v === 'fixed' || v === 'sticky' },
  { prop: 'transform', bad: (v) => v !== 'none' },
  { prop: 'will-change', bad: (v) => v !== 'auto' },
  { prop: 'filter', bad: (v) => v !== 'none' },
  { prop: 'backdrop-filter', bad: (v) => v !== 'none' },
  { prop: 'perspective', bad: (v) => v !== 'none' },
  { prop: 'contain', bad: (v) => v !== 'none' },
  { prop: 'overflow', bad: (v) => /hidden|auto|scroll|clip/.test(v) },
  { prop: 'overflow-x', bad: (v) => /hidden|auto|scroll|clip/.test(v) },
  { prop: 'overflow-y', bad: (v) => /hidden|auto|scroll|clip/.test(v) },
  { prop: 'height', bad: (v) => /\d(vh|dvh|svh|lvh)\b/.test(v) },
  { prop: 'min-height', bad: (v) => /\d(vh|dvh|svh|lvh)\b/.test(v) },
  { prop: 'max-height', bad: (v) => /\d(vh|dvh|svh|lvh)\b/.test(v) },
  { prop: '-webkit-overflow-scrolling', bad: () => true },
  { prop: 'overscroll-behavior', bad: (v) => v !== 'auto' },
]

function findStructuralRisks(css: string, root: ParentNode = document): string[] {
  const rules = parseCss(css).filter((r) => RISKS.some(({ prop, bad }) => r.decls[prop] !== undefined && bad(r.decls[prop])))
  const found: string[] = []
  const controls = Array.from(root.querySelectorAll(CONTROL)).filter((c) => !c.hasAttribute('hidden'))
  for (const c of controls) {
    for (let el: Element | null = c; el; el = el.parentElement) {
      for (const r of rules) {
        for (const sel of r.selectors) {
          if (sel.includes('::')) continue
          let hit = false
          try {
            hit = el.matches(sel)
          } catch {
            hit = false
          }
          if (!hit) continue
          const which = RISKS.filter(({ prop, bad }) => r.decls[prop] !== undefined && bad(r.decls[prop])).map(({ prop }) => `${prop}: ${r.decls[prop]}`)
          found.push(`${label(c)} ${el === c ? 'じしん' : `の祖先 ${label(el)}`} に「${sel}」で ${which.join(', ')}`)
        }
      }
    }
  }
  return found
}

describe('CSS: 抑止設定のかけかた', () => {
  it('styles.css を ちゃんと読めている（空だと、ほかの検査が空振りになる）', () => {
    expect(cssText.length).toBeGreaterThan(10_000)
    expect(parseCss(cssText).length).toBeGreaterThan(200)
    expect(parseCss(cssText).some((r) => r.selectors.includes('.plan-row') && r.decls['touch-action'] === 'none')).toBe(true)
  })
  it('html・body・:root・* には user-select: none などを かけていない', () => {
    const bad = parseCss(cssText).filter(
      (r) => r.selectors.some((s) => /^(html|body|:root|\*|#root|\.app)$/.test(s)) && SUPPRESSORS.some(([k, v]) => r.decls[k] === v),
    )
    expect(bad.map((r) => r.selectors.join(','))).toEqual([])
  })
  it('入力欄は user-select: text・touch-action: manipulation・長押しメニューあり、と はっきり決めている', () => {
    const r = parseCss(cssText).find((x) => ['input', 'textarea', 'select'].every((s) => x.selectors.includes(s)))
    expect(r).toBeTruthy()
    expect(r!.decls['user-select']).toBe('text')
    expect(r!.decls['-webkit-user-select']).toBe('text')
    expect(r!.decls['-webkit-touch-callout']).toBe('default')
    expect(r!.decls['touch-action']).toBe('manipulation')
  })
  it('ビルド前のCSSに 「入力欄に抑止設定をかける」rule が ない（検出器の自己テスト: わざと悪いCSSを入れると見つかる）', () => {
    document.body.innerHTML = '<div id="x"><label><input /></label><textarea></textarea><select></select></div>'
    expect(findViolations('body{user-select:none}')).toHaveLength(3)
    expect(findViolations('.x, #x{-webkit-touch-callout:none}')).toHaveLength(3)
    expect(findViolations('input{touch-action:none}')).toHaveLength(1)
    expect(findViolations('label{-webkit-user-select:none}')).toHaveLength(1)
    expect(findViolations('@media (min-width: 1px){ select{pointer-events:none} }')).toHaveLength(1)
    expect(findViolations('button{user-select:none}')).toHaveLength(0)
    expect(findViolations(cssText)).toHaveLength(0)
    document.body.innerHTML = ''
  })
})

// ---- 実際の画面を描いて しらべる ----

const fire = (el: Element, type: string, init: EventInit = {}) => {
  const ev = new Event(type, { bubbles: true, cancelable: true, ...init })
  act(() => {
    el.dispatchEvent(ev)
  })
  return ev
}
const click = (el: Element | null | undefined) => {
  if (!el) throw new Error('クリックする部品が見つかりません')
  act(() => {
    ;(el as HTMLElement).click()
  })
}
const byText = (text: string, scope: ParentNode = document) =>
  Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLElement | undefined

describe('iOS の standalone 対策（入力欄の祖先の構造・viewport）', () => {
  it('検出器の自己テスト: fixed / transform / overflow / 100vh などを入力欄の祖先にかけると 見つかる', () => {
    document.body.innerHTML = '<div id="x"><div class="m"><label><input /></label></div></div>'
    expect(findStructuralRisks('.m{position:fixed}')).toHaveLength(1)
    expect(findStructuralRisks('#x{transform:translateY(0)}')).toHaveLength(1)
    expect(findStructuralRisks('.m{overflow:hidden}')).toHaveLength(1)
    expect(findStructuralRisks('.m{overflow-y:auto}')).toHaveLength(1)
    expect(findStructuralRisks('body{min-height:100vh}')).toHaveLength(1)
    expect(findStructuralRisks('.m{max-height:100dvh}')).toHaveLength(1)
    expect(findStructuralRisks('html,body{overscroll-behavior:none}')).toHaveLength(2)
    expect(findStructuralRisks('.m{will-change:transform}')).toHaveLength(1)
    expect(findStructuralRisks('.m{overflow:visible;position:relative;transform:none}')).toHaveLength(0)
    expect(findStructuralRisks('.other{position:fixed}')).toHaveLength(0)
    document.body.innerHTML = ''
  })

  it('index.html の viewport に user-scalable=no / maximum-scale などが ない', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const viewport = /<meta[^>]+name="viewport"[^>]+content="([^"]*)"/.exec(html)?.[1] ?? ''
    expect(viewport).toContain('width=device-width')
    expect(viewport).toContain('viewport-fit=cover')
    expect(viewport).not.toMatch(/user-scalable|maximum-scale|minimum-scale/)
  })
})

describe('実際の画面の入力欄', () => {
  let root: Root
  let host: HTMLElement
  const seen = new Map<string, Element[]>()

  /** いま開いている画面の入力欄を しらべて、どんな入力欄があったか おぼえる */
  const inspect = (name: string) => {
    const controls = Array.from(document.querySelectorAll(CONTROL)).filter((c) => !c.hasAttribute('hidden'))
    seen.set(name, controls)
    // 1. 入力欄と祖先に 抑止設定が かかっていない
    expect(findViolations(cssText), name).toEqual([])
    // 4. 入力欄の祖先に position: fixed / transform / overflow / 100vh などが ない（iOS の standalone 対策）
    expect(findStructuralRisks(cssText), name).toEqual([])
    // 3. 入力欄は ドラッグできる部品の中にない
    for (const c of controls) {
      expect(c.closest('[aria-roledescription="sortable"], [aria-roledescription="draggable"]'), `${name}: ${label(c)}`).toBeNull()
    }
    // 2. 入力欄へのタッチ・クリックを だれも止めていない
    for (const c of controls) {
      for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click']) {
        expect(fire(c, type).defaultPrevented, `${name}: ${label(c)} の ${type} が preventDefault された`).toBe(false)
      }
    }
  }

  beforeAll(() => {
    // jsdom に無いもの（dnd-kit が使う）
    const stub = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= stub
    ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver ??= stub
    localStorage.clear()
    window.scrollTo = () => {} // jsdom には ない
    document.documentElement.setAttribute('lang', 'ja')
    host = document.createElement('div')
    host.id = 'root'
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(<App />))
  })
  afterAll(() => {
    act(() => root.unmount())
  })

  const close = () => {
    const closers = Array.from(document.querySelectorAll('.modal__head .icon-btn'))
    act(() => (closers[closers.length - 1] as HTMLElement).click())
  }

  it('メイン画面（よてい・パレット）', () => {
    inspect('メイン画面')
  })

  it('「＋じぶんで つくる」（カスタムカード）: なまえの入力欄', () => {
    click(byText('じぶんで'))
    // ダイアログは 全画面のページ。うしろの よてい画面・ドラッグ部品は ない
    expect(document.querySelector('.page')).not.toBeNull()
    expect(document.querySelector('.plan-area, .palette, [aria-roledescription]')).toBeNull()
    inspect('じぶんでつくる')
    const inputs = seen.get('じぶんでつくる')!
    expect(inputs.some((c) => c.tagName === 'INPUT' && (c as HTMLInputElement).placeholder.includes('ピアノ'))).toBe(true)
    close()
  })

  it('いつものよてい（ほぞんする なまえ）', () => {
    click(byText('いつものよてい'))
    inspect('いつものよてい')
    expect(seen.get('いつものよてい')!.length).toBeGreaterThanOrEqual(1)
    close()
  })

  it('せってい（声・キャラ・ちょうせい・バックアップ）→ じこくカード編集 → どだい・ながいやすみ', () => {
    click(document.querySelector('[aria-label="せってい"]'))
    inspect('せってい')
    expect(seen.get('せってい')!.length).toBeGreaterThanOrEqual(2)

    // こえの ちょうせい（details の中の select・range）
    const details = document.querySelector('details.char-tune') as HTMLDetailsElement
    act(() => {
      details.open = true
    })
    inspect('せってい（こえの ちょうせい）')
    expect(seen.get('せってい（こえの ちょうせい）')!.some((c) => c.tagName === 'SELECT')).toBe(true)

    // じこくカードの編集（名前・時刻・ラジオ・チェックボックス）
    click(document.querySelector('[aria-label="ゆうごはん をなおす"]'))
    inspect('じこくカード編集')
    const fixed = seen.get('じこくカード編集')!
    expect(fixed.some((c) => (c as HTMLInputElement).type === 'time')).toBe(true)
    expect(fixed.some((c) => (c as HTMLInputElement).type === 'radio')).toBe(true)
    expect(fixed.some((c) => (c as HTMLInputElement).type === 'checkbox')).toBe(true)
    expect(fixed.some((c) => c.tagName === 'INPUT' && !(c as HTMLInputElement).type.match(/time|radio|checkbox|range/))).toBe(true)
    close()

    // どだい（時刻・カード選択）と、ながい やすみ（なまえ・日づけ）
    click(byText('どだいと ながい やすみを ひらく'))
    inspect('どだい・ながいやすみ')
    const tpl = seen.get('どだい・ながいやすみ')!
    expect(tpl.some((c) => c.tagName === 'SELECT')).toBe(true)
    expect(tpl.some((c) => (c as HTMLInputElement).type === 'time')).toBe(true)
    expect(tpl.some((c) => (c as HTMLInputElement).type === 'date')).toBe(true)
    expect(tpl.some((c) => c.tagName === 'INPUT' && (c as HTMLInputElement).getAttribute('aria-label') === 'やすみの なまえ')).toBe(true)
    close() // どだい → せってい

    // 入力しんだん（原因さがし用の画面）
    click(byText('もじが いれられない とき'))
    inspect('にゅうりょく しんだん')
    const diag = seen.get('にゅうりょく しんだん')!
    expect(diag.some((c) => c.tagName === 'INPUT')).toBe(true)
    expect(diag.some((c) => c.tagName === 'TEXTAREA')).toBe(true)
    // さわると ログに のこる（だれかが止めていれば ⚠ が つく）
    const log = document.querySelector('[aria-label="ログ"]')!
    expect(log.textContent).toContain('click')
    expect(log.textContent).not.toContain('止められた')
    close() // しんだん → せってい
    close() // せってい → メイン
  })

  it('ダイアログを とじると、よてい画面にもどる（ひらく前の画面）', () => {
    expect(document.querySelector('.page')).toBeNull()
    expect(document.querySelector('.plan-area')).not.toBeNull()
  })

  it('どの画面でも、入力欄の祖先に data-no-drag（モーダル）がある or ドラッグ部品の外にある', () => {
    for (const [name, controls] of seen) {
      for (const c of controls) {
        const inModal = c.closest('.modal') !== null
        const inMain = c.closest('main.app') !== null && !inModal
        expect(inModal || !inMain, `${name}: ${label(c)}`).toBe(true)
      }
    }
  })
})

// ---- ドラッグできる部品の中の入力欄 ----

describe('dnd-kit: 入力欄ではドラッグを はじめない', () => {
  function Item({ kind, tag }: { kind: 'safe' | 'plain'; tag: 'input' | 'select' | 'textarea' | 'div' | 'label' }) {
    const [, set] = useState(0)
    void set
    const sensors = useSensors(
      useSensor(kind === 'safe' ? SafeMouseSensor : MouseSensor),
      useSensor(kind === 'safe' ? SafeTouchSensor : TouchSensor),
    )
    return (
      <DndContext sensors={sensors}>
        <Drag tag={tag} />
      </DndContext>
    )
  }
  function Drag({ tag }: { tag: string }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: 'a' })
    return (
      <div ref={setNodeRef} data-dragging={isDragging ? 'yes' : 'no'} {...attributes} {...listeners}>
        {tag === 'input' && <input aria-label="t" />}
        {tag === 'select' && <select aria-label="t" />}
        {tag === 'textarea' && <textarea aria-label="t" />}
        {tag === 'label' && (
          <label>
            なまえ<span id="in-label">x</span>
          </label>
        )}
        {tag === 'div' && <span aria-label="t">drag me</span>}
      </div>
    )
  }

  const mount = (kind: 'safe' | 'plain', tag: 'input' | 'select' | 'textarea' | 'div' | 'label') => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const r = createRoot(el)
    act(() => r.render(<Item kind={kind} tag={tag} />))
    return { el, unmount: () => act(() => r.unmount()) }
  }
  const target = (el: HTMLElement, tag: string) => (tag === 'label' ? el.querySelector('#in-label')! : el.querySelector('[aria-label="t"]')!)
  const dragging = (el: HTMLElement) => el.querySelector('[data-dragging]')!.getAttribute('data-dragging') === 'yes'

  const mouseDown = (t: Element) => {
    act(() => {
      t.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 1, clientY: 1 }))
    })
  }
  const touchStart = (t: Element) => {
    const ev = new Event('touchstart', { bubbles: true, cancelable: true }) as Event & { touches: unknown[] }
    ev.touches = [{ clientX: 1, clientY: 1 }]
    act(() => {
      t.dispatchEvent(ev)
    })
    return ev
  }

  it.each(['input', 'select', 'textarea', 'label'] as const)('%s の上では、マウスでもタッチでも ドラッグが はじまらない', (tag) => {
    for (const start of [mouseDown, touchStart]) {
      const m = mount('safe', tag)
      const ev = start(target(m.el, tag)) as Event | undefined
      expect(dragging(m.el), `${tag}`).toBe(false)
      if (ev) expect(ev.defaultPrevented).toBe(false)
      m.unmount()
    }
  })

  it('（検出の確かめ）ふつうの MouseSensor / TouchSensor だと、入力欄の上でも ドラッグが はじまってしまう', () => {
    for (const start of [mouseDown, touchStart]) {
      const m = mount('plain', 'input')
      start(target(m.el, 'input'))
      expect(dragging(m.el)).toBe(true)
      m.unmount()
    }
  })

  it('入力欄いがいの場所では、これまでどおり ドラッグできる', () => {
    for (const start of [mouseDown, touchStart]) {
      const m = mount('safe', 'div')
      start(target(m.el, 'div'))
      expect(dragging(m.el)).toBe(true)
      m.unmount()
    }
  })

  it('isInteractiveTarget', () => {
    document.body.innerHTML =
      '<div id="a"><input id="i"/><select id="s"><option id="o"></option></select><label id="l"><span id="ls">x</span></label><button id="b">b</button><div data-no-drag><p id="nd">y</p></div><div contenteditable="true"><b id="ce">z</b></div></div>'
    const $ = (id: string) => document.getElementById(id)
    for (const id of ['i', 's', 'o', 'l', 'ls', 'nd', 'ce']) expect(isInteractiveTarget($(id)), id).toBe(true)
    for (const id of ['a', 'b']) expect(isInteractiveTarget($(id)), id).toBe(false)
    expect(isInteractiveTarget(null)).toBe(false)
    document.body.innerHTML = ''
  })
})
