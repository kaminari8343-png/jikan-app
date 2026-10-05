import { useEffect, type ReactNode } from 'react'

/**
 * ダイアログ。ただし「画面の上に重ねる」のではなく、ふつうの全画面ページとして表示する。
 * （ホーム画面に追加したiOSのアプリ=standalone では、position: fixed の重ね合わせ・overflow: hidden・
 *   二重スクロールの中の入力欄に、キーボードが出ないことがあるため。入力欄の祖先に fixed / transform /
 *   overflow / 100vh を使わない。src/inputs.test.tsx が自動でしらべます）
 * ひらくと 先頭にもどる。うしろの画面（よてい・ドラッグ部品）は、ひらいている間は ない。
 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <section className="page" aria-label={title} data-no-drag>
      <div className="modal">
        <div className="modal__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="とじる" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal__body">
          {children}
          <button type="button" className="big-btn big-btn--sub page__close" onClick={onClose}>
            もどる
          </button>
        </div>
      </div>
    </section>
  )
}
