import { describe, expect, it } from 'vitest'
import { PRESET_CARDS } from './cards'
import { READINGS, readingOf } from './readings'
import { moveItem } from './schedule'
import { finishCard, rateCard, startRun } from './runner'
import { say } from './phrases.logic'
import { newItem } from './components/Planner'
import type { PlanItem } from './types'

const homework = PRESET_CARDS.find((c) => c.id === 'homework')!
const MIN = 60_000
const T0 = new Date(2026, 9, 2, 16, 0).getTime()

describe('同じカードを 何枚でも', () => {
  const a = newItem(homework)
  const b = newItem(homework)
  const c = newItem(homework)
  it('入れるたびに 新しい uid（カードのidとは べつ）', () => {
    expect(new Set([a.uid, b.uid, c.uid]).size).toBe(3)
    expect(a.cardId).toBe(b.cardId)
    expect(a.uid).not.toBe(a.cardId)
  })
  it('ならびかえ・時間・なまえ・削除が それぞれ べつべつ', () => {
    const list: PlanItem[] = [a, b, c]
    const moved = moveItem(list, b.uid, -1)
    expect(moved.map((i) => i.uid)).toEqual([b.uid, a.uid, c.uid])
    const edited = list.map((i) => (i.uid === b.uid ? { ...i, minutes: 30, name: 'さんすう' } : i))
    expect(edited.map((i) => [i.name, i.minutes])).toEqual([['しゅくだい', 15], ['さんすう', 30], ['しゅくだい', 15]])
    expect(list.filter((i) => i.uid !== b.uid).map((i) => i.uid)).toEqual([a.uid, c.uid])
  })
  it('じっこう・きろく・ふりかえりも 1枚ずつ', () => {
    const items = [a, { ...b, name: 'さんすう' }, c]
    let step = startRun(items, T0, 's1')
    expect(step.run.session.entries.map((e) => e.name)).toEqual(['しゅくだい'])
    const fin = finishCard(step.run, 'done', T0 + 15 * MIN)
    step = rateCard(fin, 'good', T0 + 16 * MIN)
    const names = step.run.session.entries.map((e) => e.name)
    expect(names).toEqual(['しゅくだい', 'さんすう'])
    expect(step.run.session.entries[0].rating).toBe('good')
    expect(step.run.session.entries[1].rating).toBeNull()
  })
  it('つけたなまえで 読み上げる', () => {
    expect(say('start', { name: 'さんすう', minutes: 15 })).toContain('さんすう')
  })
})

describe('べんきょうの カード', () => {
  const names = ['さんすう', 'こくご', 'おんどく', 'けいさんカード', 'ひらがな・カタカナ']
  it('パレットにある。絵文字・色は それぞれ べつ', () => {
    const cs = names.map((n) => PRESET_CARDS.find((c) => c.name === n))
    expect(cs.every(Boolean)).toBe(true)
    expect(new Set(cs.map((c) => c!.emoji)).size).toBe(5)
    expect(new Set(cs.map((c) => c!.color)).size).toBe(5)
    expect(new Set(PRESET_CARDS.map((c) => c.id)).size).toBe(PRESET_CARDS.length)
  })
  it('カタカナまじりは 読みかたを とうろく', () => {
    expect(readingOf('けいさんカード')).toBe('けいさんかーど')
    expect(READINGS['ひらがな・カタカナ']).toBeTruthy()
  })
})
