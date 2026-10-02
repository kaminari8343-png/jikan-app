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

/** じっこう中の状態（localStorage に保存して、リロードしても続けられる） */
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
  finished: boolean
}
