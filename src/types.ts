/** パレットに並ぶ「やること」カード */
export interface CardDef {
  id: string
  name: string
  emoji: string
  color: string
  /** はじめの時間（分） */
  minutes: number
  custom?: boolean
}

/** よていの列に並んだカード（作った時点の内容をコピーして持つ） */
export interface PlanItem {
  uid: string
  cardId: string
  name: string
  emoji: string
  color: string
  minutes: number
}

export interface SavedPlan {
  id: string
  name: string
  items: Omit<PlanItem, 'uid'>[]
}

export interface Settings {
  voiceOn: boolean
  rate: number
  pitch: number
  volume: number
}

export type Rating = 'good' | 'bad'

/** 1枚のカードの記録 */
export interface HistoryEntry {
  name: string
  emoji: string
  color: string
  /** 予定の時間（分）。「+5ふん」で延ばす前の値 */
  plannedMinutes: number
  /** 実際の開始・終了（Date.now の値）。終了は、途中でやめたカードだけ null */
  startedAt: number
  endedAt: number | null
  /** さいごまでやった / スキップ。まだ途中なら null */
  result: 'done' | 'skipped' | null
  /** 「+5ふん」を押した回数 */
  extensions: number
  /** じぶんでつけた⭕️／❌。まだなら null */
  rating: Rating | null
}

/** 「スタート」を押してから、おわる（またはやめる）までの1回分 */
export interface HistorySession {
  id: string
  startedAt: number
  /** running: じっこう中 / finished: ぜんぶやりおえた / aborted: とちゅうでやめた */
  status: 'running' | 'finished' | 'aborted'
  entries: HistoryEntry[]
}

/**
 * じっこう中の状態（localStorage に保存して、リロードしても続けられる）
 * phase: timer = タイマー中 / rate = ⭕️❌をえらぶ画面 / done = ぜんぶおわった
 */
export interface RunState {
  items: PlanItem[]
  index: number
  /** いまのカードで、一時停止までに経過したミリ秒 */
  accumMs: number
  /** 動いているときの再開時刻（Date.now）。止まっているときは null */
  runningSince: number | null
  /** 「+5ふん」で足したミリ秒 */
  extraMs: number
  /** もう話したお知らせ */
  fired: string[]
  phase: 'timer' | 'rate' | 'done'
  /** この回の記録。entries[i] が items[i] に対応する */
  session: HistorySession
}
