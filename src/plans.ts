// 日ごとのよてい（日付キー "YYYY-MM-DD" → よてい）
import type { FixedCard, PlanItem } from './types'
import { syncFixed } from './schedule'

export type Plans = Record<string, PlanItem[]>

/** その日のよていが まだなければ、make() でつくって入れる（あれば そのまま） */
export function withDayPlan(plans: Plans, key: string, make: () => PlanItem[]): Plans {
  return plans[key] ? plans : { ...plans, [key]: make() }
}

/** 今日より前の日のよていは、いらないので捨てる */
export function prunePlans(plans: Plans, todayKey: string): Plans {
  const keys = Object.keys(plans)
  const keep = keys.filter((k) => k >= todayKey)
  return keep.length === keys.length ? plans : Object.fromEntries(keep.map((k) => [k, plans[k]]))
}

/** 設定のじこくカード（名前・しずか など）を直したら、ぜんぶの日のよていに反映する */
export function syncAllPlans(plans: Plans, cards: FixedCard[]): Plans {
  let changed = false
  const out: Plans = {}
  for (const [k, items] of Object.entries(plans)) {
    const next = syncFixed(items, cards)
    if (next !== items) changed = true
    out[k] = next
  }
  return changed ? out : plans
}
