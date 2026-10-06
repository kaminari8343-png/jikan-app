import { useEffect, useRef, useState } from 'react'
import { BUILD, formatBuild } from '../buildInfo'
import { Modal } from './Modal'

const EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'focusin', 'focusout', 'input', 'keydown', 'beforeinput'] as const
const MAX_LINES = 60

const tag = (t: EventTarget | null) => {
  if (!(t instanceof Element)) return '?'
  const label = t.getAttribute('aria-label') ?? t.getAttribute('placeholder') ?? ''
  return `${t.tagName.toLowerCase()}${label ? `「${label.slice(0, 14)}」` : ''}`
}

/** いま ホーム画面のアプリ（standalone）として ひらいているか */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
}

/**
 * 「にゅうりょく しんだん」: 入力欄に文字が入れられないときの、原因さがし用の画面。
 * ふつうの ページの上に、入力欄を いくつか おいて、さわったときの イベント（タッチ・フォーカス・キーボード）を
 * ログに出す。ログは コピーして 開発者に おくれる。
 */
export function DiagnosticsScreen({ onClose }: { onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([])
  const [copied, setCopied] = useState('')
  const t0 = useRef(performance.now())
  const input1 = useRef<HTMLInputElement>(null)
  // ためした入力欄ごとの けっか（キーボードが でたか）。コピーする ログに 入る
  const [results, setResults] = useState<Record<string, 'でた' | 'でない'>>({})
  const addLine = (text: string) => setLines((l) => [...l.slice(-(MAX_LINES - 1)), `${Math.round(performance.now() - t0.current)}ms ${text}`])

  useEffect(() => {
    const add = (text: string) => setLines((l) => [...l.slice(-(MAX_LINES - 1)), `${Math.round(performance.now() - t0.current)}ms ${text}`])
    // ふつうの（バブリングの）さいごで 見るので、defaultPrevented が わかる（だれかが止めていたら true）
    const onEvent = (e: Event) => {
      const active = document.activeElement
      add(`${e.type} ${tag(e.target)}${e.defaultPrevented ? ' ⚠止められた' : ''}${e.type === 'focusin' ? '' : ` (active=${active ? tag(active) : '-'})`}`)
    }
    for (const t of EVENTS) document.addEventListener(t, onEvent)
    const vv = window.visualViewport
    const onVv = () => add(`visualViewport ${Math.round(vv?.width ?? 0)}x${Math.round(vv?.height ?? 0)} (キーボードで 小さくなると 出る)`)
    vv?.addEventListener('resize', onVv)
    return () => {
      for (const t of EVENTS) document.removeEventListener(t, onEvent)
      vv?.removeEventListener('resize', onVv)
    }
  }, [])

  const info = [
    `がめんの モード: ${isStandalone() ? 'ホーム画面のアプリ（standalone）' : 'ブラウザ'}`,
    `バージョン: ${formatBuild(BUILD)}`,
    `Service Worker: ${'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'はたらいている' : 'まだ はたらいていない') : 'つかえない'}`,
    `がめんの おおきさ: ${window.innerWidth}x${window.innerHeight}（visualViewport ${Math.round(window.visualViewport?.width ?? 0)}x${Math.round(window.visualViewport?.height ?? 0)}）`,
    `さわる 数(maxTouchPoints): ${navigator.maxTouchPoints}  ポインタ: ${typeof matchMedia === 'function' ? (matchMedia('(pointer: fine)').matches ? 'fine(マウスなど)' : 'coarse(ゆび)') : '?'}`,
    `UA: ${navigator.userAgent}`,
  ]
  const resultText = Object.entries(results)
    .map(([k, v]) => `${k}: キーボード ${v}`)
    .join('\n')
  const text = `${info.join('\n')}\n---\n${resultText || '（けっか なし）'}\n---\n${lines.join('\n')}`
  const judge = (key: string) => (
    <span className="diag__judge" role="group" aria-label={`${key} の けっか`}>
      キーボード:
      {(['でた', 'でない'] as const).map((v) => (
        <button key={v} type="button" className={`diag__judge-btn${results[key] === v ? ' diag__judge-btn--on' : ''}`} aria-pressed={results[key] === v} onClick={() => setResults((r) => ({ ...r, [key]: v }))}>
          {v}
        </button>
      ))}
    </span>
  )

  return (
    <Modal title="にゅうりょく しんだん" onClose={onClose}>
      <p className="diag__lead">
        もじが いれられない とき、ここで ためして ください。したの ところを タップして、キーボードが でるか みてね。
        できなかったら「コピー」して、おしえてね。
      </p>

      <label className="field">
        <span>① ふつうの いれる ところ</span>
        <input ref={input1} aria-label="しんだん: ふつうの いれる ところ" placeholder="ここを タップして もじを いれてみてね" />
      </label>
      <label className="field">
        <span>② ながい もじ</span>
        <textarea aria-label="しんだん: ながい もじ" className="diag__textarea" rows={2} placeholder="ここも ためしてね" />
      </label>
      <div className="field">
        <span>③ ボタンから フォーカス</span>
        <button
          type="button"
          className="big-btn big-btn--sub"
          onClick={() => {
            input1.current?.focus()
            // focus() の けっかを きろくする（ほんとうに フォーカスが うつったか）
            const a = document.activeElement
            addLine(`③ focus() のあと active=${a ? tag(a) : '-'}（① にうつっていれば OK）`)
          }}
        >
          ① に フォーカスする
        </button>
        {judge('③ ボタンから')}
        <small>おした ときに キーボードが でるか みてね（ボタンの タップの なかで focus() を よびます）</small>
      </div>

      <p className="diag__lead">したの ①〜⑦ を ひとつずつ タップして、キーボードが でたか「でた／でない」を おしてね。</p>
      <div className="field">
        {judge('① ふつうの input')}
        {judge('② textarea')}
      </div>
      <label className="field">
        <span>④ けんさく（type=search）</span>
        <input type="search" aria-label="しんだん: けんさく" placeholder="ここを タップ" />
      </label>
      {judge('④ search')}
      <div className="field">
        <span>⑤ へんしゅう できる はこ（contenteditable）</span>
        <div className="diag__editable" contentEditable suppressContentEditableWarning role="textbox" aria-label="しんだん: へんしゅうの はこ" />
        {judge('⑤ contenteditable')}
      </div>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <span>⑥ フォームの なか（enterkeyhint つき）</span>
        <input type="text" enterKeyHint="done" inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="しんだん: フォームの なか" placeholder="ここを タップ" />
        {judge('⑥ form内')}
      </form>
      <div className="field">
        <span>⑦ すうじ（inputmode=numeric）</span>
        <input type="text" inputMode="numeric" aria-label="しんだん: すうじ" placeholder="すうじ" />
        {judge('⑦ numeric')}
      </div>

      <div className="field">
        <span>じょうほう</span>
        <pre className="diag__log">{info.join('\n')}</pre>
      </div>
      <div className="field">
        <span>ログ（さわったときの うごき）</span>
        <pre className="diag__log" aria-label="ログ">
          {lines.length ? lines.join('\n') : '（まだ ありません）'}
        </pre>
        <div className="row">
          <button
            type="button"
            className="big-btn big-btn--sub"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text)
                setCopied('コピーしたよ')
              } catch {
                setCopied('コピーできなかったよ（ログを ながおしで えらんで コピーしてね）')
              }
            }}
          >
            📋 コピー
          </button>
          <button type="button" className="big-btn big-btn--sub" onClick={() => setLines([])}>
            けす
          </button>
        </div>
        {copied && <small>{copied}</small>}
      </div>
    </Modal>
  )
}
