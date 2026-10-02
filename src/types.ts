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
  /** じこくカードでは「長さ」（分）。0 は長さなし（1日のおわり） */
  minutes: number
  /** じこくカード（時刻が決まった予定）なら 'fixed'。ふつうのカードは省略 */
  kind?: 'normal' | 'fixed'
  /** じこくカードの開始時刻（0:00からの分） */
  startMin?: number
}

/** じこくカード（親が設定画面でつくる、時刻が決まった予定） */
export interface FixedCard {
  id: string
  name: string
  emoji: string
  color: string
  /** 開始時刻（0:00からの分）。例: 18:30 → 1110 */
  startMin: number
  /** 長さ（分）。0 は長さなし＝1日のおわり（ねる） */
  minutes: number
}

export interface SavedPlan {
  id: string
  name: string
  items: Omit<PlanItem, 'uid'>[]
  /** スタート時刻（0:00からの分）。null / 省略は「いま」 */
  startMin?: number | null
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
  /**
   * done: さいごまでやった / skipped: スキップ /
   * cutoff: じこくカードの時刻になって、とちゅうで止めた /
   * timeout: じかんぎれ（そのブロックで、はじめられなかった） / null: まだ途中
   */
  result: 'done' | 'skipped' | 'cutoff' | 'timeout' | null
  /** カードの種類。省略（古い記録）はふつうのカード。fixed=じこくカード / free=じゆうじかん */
  kind?: 'normal' | 'fixed' | 'free'
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
 * phase: timer = ふつうのカードのタイマー中 / rate = ⭕️❌をえらぶ画面 /
 *        free = じゆうじかん（つぎのじこくカードまで）/ fixed = じこくカードの最中 / done = おわった
 */
export interface RunState {
  items: PlanItem[]
  index: number
  /** いま（items[index]）のカードで、一時停止までに経過したミリ秒 */
  accumMs: number
  /** 動いているときの再開時刻（Date.now）。止まっているときは null */
  runningSince: number | null
  /** 「+5ふん」で足したミリ秒 */
  extraMs: number
  /** もう話したお知らせ */
  fired: string[]
  phase: 'timer' | 'rate' | 'free' | 'fixed' | 'done'
  /** この回の記録 */
  session: HistorySession
  /** いま進んでいる記録（session.entries の番号）。まだなければ -1 */
  cur: number
  /** その日の 0:00（Date.now の値）。じこくカードの時刻の基準 */
  dayStartMs: number
}
