export interface BuildInfo {
  /** ビルドした日時（ISO） */
  time: string
  /** コミットの短い番号。ローカルのビルドは 'dev' */
  sha: string
}

export const BUILD: BuildInfo = typeof __BUILD__ === 'undefined' ? { time: new Date(0).toISOString(), sha: 'dev' } : __BUILD__

/** 画面に出す バージョン。例: 「10がつ5にち 20:29（07e36c4）」（端末の時刻で） */
export function formatBuild(b: BuildInfo): string {
  const d = new Date(b.time)
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${d.getMonth() + 1}がつ${d.getDate()}にち ${hm}（${b.sha}）`
}
