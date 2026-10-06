// タイムトライアル（はやく おわると コイン）と、じぶんの ベスト
import type { CardDef, HistoryEntry, HistorySession, PlanItem } from './types'
import { MORNING_CARDS } from './cards'
import { isFixed } from './schedule'

const MIN = 60_000

/** はじめから タイムトライアルが オンのカード: べんきょう系と、あさの カード */
export const DEFAULT_TRIAL_IDS: ReadonlySet<string> = new Set([
  'homework',
  'math',
  'japanese',
  'reading',
  'calc-card',
  'kana',
  ...MORNING_CARDS.map((c) => c.id),
])

/** そのカード（id）の タイムトライアルは オン？ せっていで かえていれば それ、なければ はじめの設定（じぶんで つくったカードは オフ） */
export function isTrialCard(cardId: string, overrides: Record<string, boolean> = {}): boolean {
  return overrides[cardId] ?? DEFAULT_TRIAL_IDS.has(cardId)
}

/** スタートするとき、ふつうのカードに タイムトライアルの目じるしを つける（じこくカードは いつも オフ） */
export function stampTrial(items: PlanItem[], overrides: Record<string, boolean>): PlanItem[] {
  return items.map((i) => (isFixed(i) ? i : { ...i, trial: isTrialCard(i.cardId, overrides) }))
}

/** 「なまえ」が ちがえば べつの きろく（ぜんかく・はんかくや 大文字小文字は同じ扱い） */
export const recordKey = (name: string) => name.normalize('NFKC').trim().toLowerCase()

/** ベストの きろくに なるのは、タイムトライアルで さいごまで やって ⭕️をつけたカード */
export const isRecordEntry = (e: HistoryEntry): boolean =>
  !!e.trial && e.result === 'done' && e.rating === 'good' && typeof e.activeMs === 'number' && e.activeMs > 0

export interface Best {
  name: string
  emoji: string
  /** いちばん はやかった時間（ms） */
  ms: number
  /** そのときの日（Date.now の値） */
  at: number
  /** ⭕️で おわった回数 */
  count: number
}

/** カード（なまえ）ごとの じぶんベスト。exclude の回は ふくめない（いま じっこう中の回 など） */
export function bestTimes(sessions: HistorySession[], exclude?: string): Map<string, Best> {
  const out = new Map<string, Best>()
  for (const s of sessions) {
    if (s.id === exclude) continue
    for (const e of s.entries) {
      if (!isRecordEntry(e)) continue
      const k = recordKey(e.name)
      const cur = out.get(k)
      if (!cur) out.set(k, { name: e.name, emoji: e.emoji, ms: e.activeMs!, at: e.startedAt, count: 1 })
      else {
        cur.count++
        if (e.activeMs! < cur.ms) Object.assign(cur, { ms: e.activeMs!, at: e.startedAt, name: e.name, emoji: e.emoji })
      }
    }
  }
  return out
}

/** 浮いた時間 → もらえるコイン（1分に つき 1まい。1分に たりなければ 0） */
export const coinsForSaved = (savedMs: number): number => Math.max(0, Math.floor(savedMs / MIN))

/** もらった コインの ごうけい */
export function coinsEarned(sessions: HistorySession[]): number {
  let n = 0
  for (const s of sessions) for (const e of s.entries) n += e.coins ?? 0
  return n
}

export const trialCards = (cards: CardDef[], overrides: Record<string, boolean>) => cards.filter((c) => isTrialCard(c.id, overrides))
