// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { KANA_ROWS, dakuten, handakuten, pressKana, small, toHira, toKata, type KanaKey, type KanaMode } from './kana'
import { KanaField } from './components/KanaField'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const typeAll = (keys: (KanaKey | string)[], mode: KanaMode = 'hiragana', max = 10) =>
  keys.reduce<string>((v, k) => pressKana(v, typeof k === 'string' ? { type: 'char', ch: k } : k, mode, max), '')
const D: KanaKey = { type: 'daku' }
const H: KanaKey = { type: 'handaku' }
const S: KanaKey = { type: 'small' }

describe('50音の ならび', () => {
  it('あ〜ん（ぜんぶ 45もじ ＋ を・ん）が そろっている', () => {
    const all = KANA_ROWS.flat().filter((c): c is string => c !== null).join('')
    expect(all).toBe('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん')
    expect(KANA_ROWS.every((r) => r.length === 5)).toBe(true)
  })
})

describe('ひらがな・カタカナ', () => {
  it('ひらがな ⇄ カタカナ', () => {
    expect(toKata('さんすう')).toBe('サンスウ')
    expect(toHira('サンスウ')).toBe('さんすう')
    expect(toKata('ー')).toBe('ー')
  })
  it('カタカナモードで 打つと カタカナ。のばし棒も', () => {
    expect(typeAll(['て', 'れ', 'ひ', 'ー'], 'katakana')).toBe('テレヒー')
    expect(typeAll(['て', 'れ', 'ひ'], 'hiragana')).toBe('てれひ')
  })
  it('まぜて 打てる（モードを かえた ところから）', () => {
    expect(pressKana(typeAll(['あ']), { type: 'char', ch: 'い' }, 'katakana', 10)).toBe('あイ')
  })
})

describe('だくてん・はんだくてん・ちいさい もじ', () => {
  it('゛: か→が、は→ば、う→ゔ。もういちど おすと もどる', () => {
    expect(dakuten('か')).toBe('が')
    expect(dakuten('が')).toBe('か')
    expect(dakuten('は')).toBe('ば')
    expect(dakuten('ぱ')).toBe('ば')
    expect(dakuten('う')).toBe('ゔ')
    expect(dakuten('あ')).toBeNull()
  })
  it('゜: は→ぱ。ば→ぱ。ぱ→は', () => {
    expect(handakuten('は')).toBe('ぱ')
    expect(handakuten('ば')).toBe('ぱ')
    expect(handakuten('ぱ')).toBe('は')
    expect(handakuten('か')).toBeNull()
  })
  it('小: や→ゃ、つ→っ、あ→ぁ。もういちどで もどる', () => {
    expect(small('や')).toBe('ゃ')
    expect(small('つ')).toBe('っ')
    expect(small('あ')).toBe('ぁ')
    expect(small('ゃ')).toBe('や')
    expect(small('か')).toBeNull()
  })
  it('カタカナでも はたらく', () => {
    expect(dakuten('カ')).toBe('ガ')
    expect(handakuten('ハ')).toBe('パ')
    expect(small('ツ')).toBe('ッ')
  })
  it('さいごの 1もじに だけ かかる。つけられない ときは そのまま', () => {
    expect(typeAll(['か', 'き', D])).toBe('かぎ')
    expect(typeAll(['き', 'ゃ'.replace('ゃ', 'や'), S])).toBe('きゃ')
    expect(typeAll(['ぴ', 'あ', D])).toBe('ぴあ')
    expect(typeAll([D])).toBe('')
    expect(typeAll(['ひ', 'ゃ'.replace('ゃ', 'や'), S, 'く'])).toBe('ひゃく')
    expect(typeAll(['て', 'ん', 'ぷ', 'ら'])).toBe('てんぷら')
    expect(typeAll(['は', H, 'ぴ'.replace('ぴ', 'ひ'), H])).toBe('ぱぴ')
  })
})

describe('けす・もじすう', () => {
  it('1もじ けす／ぜんぶ けす', () => {
    expect(typeAll(['あ', 'い', 'う', { type: 'back' }])).toBe('あい')
    expect(typeAll(['あ', 'い', 'う', { type: 'clear' }])).toBe('')
    expect(typeAll([{ type: 'back' }])).toBe('')
  })
  it('もじすうの じょうげん（10もじ）を こえて 足さない', () => {
    expect(typeAll(Array(15).fill('あ'))).toBe('あ'.repeat(10))
    expect(typeAll(Array(15).fill('あ'), 'hiragana', 3)).toBe('あああ')
  })
})

describe('KanaField（がめん）', () => {
  let el: HTMLDivElement
  let root: Root
  afterEach(() => {
    act(() => root.unmount())
    el.remove()
  })
  function Harness({ max = 10 }: { max?: number }) {
    const [v, setV] = useState('')
    return (
      <>
        <KanaField label="なまえ" value={v} onChange={setV} maxLength={max} placeholder="れい" />
        <output id="out">{v}</output>
      </>
    )
  }
  const mount = (max?: number) => {
    el = document.createElement('div')
    document.body.appendChild(el)
    root = createRoot(el)
    act(() => root.render(<Harness max={max} />))
  }
  const btn = (name: string) => {
    const b = Array.from(el.querySelectorAll('button')).find((x) => x.textContent?.replace(/\s/g, '') === name.replace(/\s/g, '') || x.getAttribute('aria-label') === name)
    if (!b) throw new Error(`ボタンが ありません: ${name}`)
    return b as HTMLElement
  }
  const tap = (...names: string[]) => names.forEach((n) => act(() => btn(n).click()))
  const out = () => el.querySelector('#out')!.textContent
  const input = () => el.querySelector('input') as HTMLInputElement

  it('ボタンで「さんすう」「ぱんだ」「ちゃいろ」が うてる', () => {
    mount()
    tap('さ', 'ん', 'す', 'う')
    expect(out()).toBe('さんすう')
    tap('ぜんぶけす')
    tap('は', 'はんだくてん', 'ん', 'た', 'だくてん')
    expect(out()).toBe('ぱんだ')
    tap('ぜんぶけす')
    tap('ち', 'や', 'ちいさい もじ', 'い', 'ろ')
    expect(out()).toBe('ちゃいろ')
    tap('ひとつ けす')
    expect(out()).toBe('ちゃい')
  })
  it('カタカナに きりかえて「テレビ」。もどせる', () => {
    mount()
    tap('カタカナに する')
    expect(btn('ひらがなに する').getAttribute('aria-pressed')).toBe('true')
    tap('テ', 'レ', 'ヒ', 'だくてん', 'のばしぼう')
    expect(out()).toBe('テレビー')
    expect(el.textContent).toContain('テ')
    tap('ひらがなに する', 'あ')
    expect(out()).toBe('テレビーあ')
  })
  it('キーボードでも うてる（input の ふつうの 入力）', () => {
    mount()
    const i = input()
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      set.call(i, 'ぴあの')
      i.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(out()).toBe('ぴあの')
    tap('ー')
    expect(out()).toBe('ぴあのー')
  })
  it('入力欄は ふつうの input。ボタンは label の「そと」（入力欄の 祖先に ボタンは ない）', () => {
    mount()
    expect(input().tagName).toBe('INPUT')
    expect(input().closest('button')).toBeNull()
    expect(input().closest('label')!.querySelector('button')).toBeNull()
    expect(input().readOnly).toBe(false)
    expect(input().disabled).toBe(false)
  })
  it('もじすうの じょうげんを まもる', () => {
    mount(2)
    tap('あ', 'い', 'う')
    expect(out()).toBe('あい')
  })
})
