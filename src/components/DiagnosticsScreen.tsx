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
    `UA: ${navigator.userAgent}`,
  ]
  const text = `${info.join('\n')}\n---\n${lines.join('\n')}`

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
        <button type="button" className="big-btn big-btn--sub" onClick={() => input1.current?.focus()}>
          ① に フォーカスする
        </button>
        <small>おした ときに キーボードが でるか みてね（ボタンの タップの なかで focus() を よびます）</small>
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
