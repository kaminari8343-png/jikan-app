import { reloadApp, useUpdateReady } from '../updates'

/** あたらしい バージョンが とどいたときに 画面の上に出す（そうさ中のじゃまにならないよう、じぶんで おしてもらう） */
export function UpdateBanner() {
  const ready = useUpdateReady()
  if (!ready) return null
  return (
    <div className="update-banner" role="status">
      <span>🔄 あたらしい バージョンが あるよ</span>
      <button type="button" className="pill-btn pill-btn--small" onClick={reloadApp}>
        こうしんする
      </button>
    </div>
  )
}
