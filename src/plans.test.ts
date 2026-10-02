import { describe, expect, it } from 'vitest'
import { prunePlans, syncAllPlans, withDayPlan } from './plans'
import type { PlanItem } from './types'

const item = (name: string): PlanItem => ({ uid: name, cardId: name, name, emoji: '', color: '#ccc', minutes: 5 })

describe('日ごとのよてい', () => {
  it('その日のよていが無ければ つくる。あれば そのまま（子どもが直した並びを上書きしない）', () => {
    const made = withDayPlan({}, '2026-10-07', () => [item('a')])
    expect(made['2026-10-07']).toHaveLength(1)
    const again = withDayPlan(made, '2026-10-07', () => [item('zzz')])
    expect(again).toBe(made)
  })
  it('空のよてい（子どもが ぜんぶ消した）も「ある」あつかい。つくりなおさない', () => {
    const plans = { '2026-10-07': [] as PlanItem[] }
    expect(withDayPlan(plans, '2026-10-07', () => [item('a')])).toBe(plans)
  })
  it('今日より前の日は捨てる。今日と先の日は残す', () => {
    const plans = { '2026-10-06': [item('a')], '2026-10-07': [item('b')], '2026-10-08': [item('c')] }
    expect(Object.keys(prunePlans(plans, '2026-10-07'))).toEqual(['2026-10-07', '2026-10-08'])
    const same = { '2026-10-08': [item('c')] }
    expect(prunePlans(same, '2026-10-07')).toBe(same)
  })
})

describe('じこくカード設定の反映', () => {
  it('ぜんぶの日のよていに反映する。変化がなければ同じ物を返す', () => {
    const fx = (name: string): PlanItem => ({ ...item(name), kind: 'fixed', startMin: 600, minutes: 30 })
    const plans = { '2026-10-07': [fx('a')], '2026-10-08': [item('n'), fx('a')] }
    const cards = [{ id: 'a', name: 'あ', emoji: '🍚', color: '#111', startMin: 1, minutes: 1, quiet: true }]
    const out = syncAllPlans(plans, cards)
    expect(out['2026-10-07'][0]).toMatchObject({ name: 'あ', quiet: true, startMin: 600 })
    expect(out['2026-10-08'][1]).toMatchObject({ name: 'あ', quiet: true })
    expect(syncAllPlans(out, cards)).toBe(out)
  })
})
