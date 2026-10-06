/** パレットに並ぶ「やること」カード */
export interface CardDef {
  id: string
  name: string
  emoji: string
  color: string
  /** はじめの時間（分） */
  minutes: number
  custom?: boolean
  /** パレットで分けて見せる。morning = あさの カード */
  group?: 'morning'
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
  /** しずか: オンのじこくカードは、開始・終了のお知らせをしない（5分前のお知らせはする） */
  quiet?: boolean
  /** でかけるカード（いえをでる）: 10・5・1ぷんまえに知らせ、時刻に「いってらっしゃい！」 */
  leaving?: boolean
  /** 1日のおわり（ねる）。省略のとき、長さ0のじこくカードは1日のおわりとして扱う（古いデータ用） */
  endOfDay?: boolean
  /** タイムトライアル（はやく おわると コイン）。スタートするときに、せっていから つける */
  trial?: boolean
  /** あそびカード（コインで のばせる。+5ふんは でない）。スタートするときに、せっていから つける */
  play?: boolean
}

/** じこくカード（親が設定画面でつくる、時刻が決まった予定） */
export interface FixedCard {
  id: string
  name: string
  emoji: string
  color: string
  /** 開始時刻（0:00からの分）。例: 18:30 → 1110 */
  startMin: number
  /** 長さ（分）。0 は長さなし（時刻だけのカード。1日のおわりなら endOfDay） */
  minutes: number
  /** しずか（開始・終了のお知らせをしない。5分前のお知らせはする） */
  quiet?: boolean
  /** でかけるカード（いえをでる）: 10・5・1ぷんまえに知らせ、時刻に「いってらっしゃい！」 */
  leaving?: boolean
  /** 1日のおわり（ねる）。省略のときは minutes === 0 なら1日のおわり（古いデータ用） */
  endOfDay?: boolean
}

/** 土台（テンプレート）の中身。よていと同じ並び順（じこくカードは時刻順、あいだに ふつうのカード） */
export type TemplateItem = Omit<PlanItem, 'uid'>

export type DayType = 'school' | 'holiday'

/** がっこうの日・やすみの日の土台と、曜日ごとの上書き */
export interface Templates {
  school: TemplateItem[]
  holiday: TemplateItem[]
  /** 曜日ごとの上書き（0=にち … 6=ど）。ないときは ふだんの土台 */
  weekday: { school: Record<string, TemplateItem[]>; holiday: Record<string, TemplateItem[]> }
}

/** なつやすみなど、親が登録する長いお休み（from〜to は両方ふくむ。YYYY-MM-DD） */
export interface Vacation {
  id: string
  name: string
  from: string
  to: string
}

export interface SavedPlan {
  id: string
  name: string
  items: Omit<PlanItem, 'uid'>[]
  /** スタート時刻（0:00からの分）。null / 省略は「いま」 */
  startMin?: number | null
}

export type { Settings } from './voiceSettings'

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
  /** タイムトライアルのカードだった */
  trial?: boolean
  /** じっさいに うごいていた時間（ms）。いちじていしは ひく。さいごまで やったカードだけ */
  activeMs?: number
  /** よていより はやく おわった時間（ms） */
  savedMs?: number
  /** ⭕️で もらったコイン */
  coins?: number
  /** じぶんの しんきろく */
  record?: boolean
  /** コインで のばした回数 */
  coinExtensions?: number
}

/** コインを つかった きろく（もらった ぶんは、りれきの きろく自体に のこっている） */
export interface CoinSpend {
  id: string
  /** Date.now の値 */
  at: number
  /** つかった まいすう（正の数） */
  coins: number
  /** なにに つかったか（いまは あそびカードの えんちょうだけ） */
  kind: 'extend'
  /** カードの なまえ */
  name: string
  /** のばした 分 */
  minutes: number
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
