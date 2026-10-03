import { describe, expect, it } from 'vitest'
import { characterOfDay, dayNumber } from './dailyCharacter'
import { CHARACTER_IDS } from './phrases'

const keyOf = (n: number) => new Date(Date.UTC(1970, 0, 1) + n * 86_400_000).toISOString().slice(0, 10)

describe('まいにち かわる（ランダム）', () => {
  it('dayNumber', () => {
    expect(dayNumber('1970-01-01')).toBe(0)
    expect(dayNumber('1970-01-02')).toBe(1)
    expect(dayNumber('2026-10-03') - dayNumber('2026-10-02')).toBe(1)
  })
  it('同じ日は、いつ数えても同じキャラ', () => {
    for (const k of ['2026-10-02', '2026-10-03', '2027-01-01']) expect(characterOfDay(k)).toBe(characterOfDay(k))
  })
  it('つぎの日は かならず ちがうキャラ（2年ぶん くらべる）', () => {
    const start = dayNumber('2026-01-01')
    for (let n = start; n < start + 730; n++) {
      expect(characterOfDay(keyOf(n)), keyOf(n)).not.toBe(characterOfDay(keyOf(n - 1)))
    }
  })
  it('5日ごとに、5人ぜんいんが ひとまわり', () => {
    for (let block = 5000; block < 5100; block++) {
      const ids = Array.from({ length: 5 }, (_, i) => characterOfDay(keyOf(block * 5 + i)))
      expect(new Set(ids).size, `block ${block}`).toBe(5)
    }
  })
  it('かたよらない（1年で どのキャラも 同じくらい）', () => {
    const start = dayNumber('2026-01-01')
    const count: Record<string, number> = {}
    for (let n = start; n < start + 365; n++) count[characterOfDay(keyOf(n))] = (count[characterOfDay(keyOf(n))] ?? 0) + 1
    for (const id of CHARACTER_IDS) {
      expect(count[id], id).toBeGreaterThanOrEqual(70)
      expect(count[id], id).toBeLessThanOrEqual(76)
    }
  })
  it('毎週おなじ曜日に おなじキャラにならない（ならびが ブロックごとに ちがう）', () => {
    const seqs = new Set<string>()
    for (let block = 6000; block < 6040; block++) seqs.add(Array.from({ length: 5 }, (_, i) => characterOfDay(keyOf(block * 5 + i))).join())
    expect(seqs.size).toBeGreaterThan(10)
  })
})
