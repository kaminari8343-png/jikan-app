// コインの つかいみち（あそびカードの えんちょう）と、もらった・つかった きろく
import type { CoinSpend, HistorySession, PlanItem } from './types'
import { dateKey } from './history'
import { coinsEarned } from './trial'
import { isFixed } from './schedule'

/** はじめから「あそびカード」: ゲーム・ユーチューブ・ネットフリックス・ユーネクスト・テレビ */
export const DEFAULT_PLAY_IDS: ReadonlySet<string> = new Set(['game', 'youtube', 'netflix', 'unext', 'tv'])

export function isPlayCard(cardId: string, overrides: Record<string, boolean> = {}): boolean {
  return overrides[cardId] ?? DEFAULT_PLAY_IDS.has(cardId)
}

/** あそびカードの じかんを さいだいに おさえる（じこくカードや ふつうのカードは そのまま） */
export function clampPlay(items: PlanItem[], overrides: Record<string, boolean>, max: number): PlanItem[] {
  let changed = false
  const out = items.map((i) => {
    if (isFixed(i) || !isPlayCard(i.cardId, overrides) || i.minutes <= max) return i
    changed = true
    return { ...i, minutes: max }
  })
  return changed ? out : items
}

/** スタートするとき、あそびカードに 目じるしを つける */
export function stampPlay(items: PlanItem[], overrides: Record<string, boolean>): PlanItem[] {
  return items.map((i) => (isFixed(i) ? i : { ...i, play: isPlayCard(i.cardId, overrides) }))
}

/** いま もっている コイン（もらった − つかった） */
export function coinBalance(sessions: HistorySession[], spends: CoinSpend[]): number {
  return Math.max(0, coinsEarned(sessions) - spends.reduce((n, s) => n + s.coins, 0))
}

/** きょう（nowMs の日）に コインで のばした回数 */
export function extendsToday(spends: CoinSpend[], nowMs: number): number {
  const key = dateKey(nowMs)
  return spends.filter((s) => s.kind === 'extend' && dateKey(s.at) === key).length
}

export interface CoinEvent {
  at: number
  /** +もらった / −つかった */
  delta: number
  label: string
}

/** 日ごとの コインの きろく（もらった・つかった）。新しい順 */
export function coinEventsOn(sessions: HistorySession[], spends: CoinSpend[], key: string): CoinEvent[] {
  const out: CoinEvent[] = []
  for (const s of sessions) {
    for (const e of s.entries) {
      const at = e.endedAt ?? e.startedAt
      if (e.coins && dateKey(at) === key) out.push({ at, delta: e.coins, label: `${e.emoji} ${e.name}` })
    }
  }
  for (const s of spends) {
    if (dateKey(s.at) === key) out.push({ at: s.at, delta: -s.coins, label: `${s.name} を ${s.minutes}ぷん のばした` })
  }
  return out.sort((a, b) => b.at - a.at)
}
