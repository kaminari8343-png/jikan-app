import { describe, expect, it } from 'vitest'
import { advance, dueEvents, elapsedMs, extend, markFired, pause, remainingMs, resume, scheduleEvents, startRun } from './runner'
import type { PlanItem } from './types'

const item = (name: string, minutes: number): PlanItem => ({ uid: name, cardId: name, name, emoji: '', color: '', minutes })
const T0 = 1_000_000
const MIN = 60_000

describe('scheduleEvents', () => {
  it('15ふん: はんぶん(あと7ふん)・あと5ふん・あと1ぷん', () => {
    const e = scheduleEvents(15 * MIN)
    expect(e.map((x) => [x.key, x.atMs / MIN, x.minutes])).toEqual([
      ['half', 7.5, 7],
      ['remaining5', 10, 5],
      ['remaining1', 14, 1],
    ])
  })
  it('10ふん: あと5ふんは はんぶんと重なるので出さない', () => {
    expect(scheduleEvents(10 * MIN).map((x) => x.key)).toEqual(['half', 'remaining1'])
  })
  it('2ふん: お知らせなし', () => {
    expect(scheduleEvents(2 * MIN)).toEqual([])
  })
})

describe('タイムスタンプでの計算', () => {
  it('バックグラウンドで tick が止まっても、時刻の差で正しく進む', () => {
    const r = startRun([item('a', 15)], T0)
    expect(elapsedMs(r, T0 + 7 * MIN)).toBe(7 * MIN)
    expect(remainingMs(r, T0 + 7 * MIN)).toBe(8 * MIN)
    expect(remainingMs(r, T0 + 99 * MIN)).toBe(0)
  })
  it('一時停止中は進まない・再開でつづきから', () => {
    let r = pause(startRun([item('a', 15)], T0), T0 + 3 * MIN)
    expect(elapsedMs(r, T0 + 60 * MIN)).toBe(3 * MIN)
    r = resume(r, T0 + 60 * MIN)
    expect(elapsedMs(r, T0 + 62 * MIN)).toBe(5 * MIN)
  })
})

describe('お知らせ', () => {
  it('時間がきたものだけ、いちどだけ', () => {
    let r = startRun([item('a', 15)], T0)
    expect(dueEvents(r, T0 + 7 * MIN)).toEqual([])
    const due = dueEvents(r, T0 + 8 * MIN)
    expect(due.map((e) => e.key)).toEqual(['half'])
    r = markFired(r, due)
    expect(dueEvents(r, T0 + 8 * MIN)).toEqual([])
  })
  it('+5ふんで、あと5ふん／1ぷんをもういちど話せる（はんぶんは話さない）', () => {
    let r = startRun([item('a', 10)], T0)
    r = markFired(r, dueEvents(r, T0 + 9.5 * MIN)) // half, remaining1 まで話した
    r = extend(r, T0 + 9.5 * MIN) // 15ふんに
    expect(r.fired).toEqual(['half'])
    expect(dueEvents(r, T0 + 14.5 * MIN).map((e) => e.key)).toEqual(['remaining5', 'remaining1'])
  })
})

describe('つぎのカード', () => {
  it('つぎへ進むと時間がリセット。最後は finished', () => {
    let r = startRun([item('a', 5), item('b', 10)], T0)
    r = advance(r, T0 + 5 * MIN)
    expect(r.index).toBe(1)
    expect(elapsedMs(r, T0 + 8 * MIN)).toBe(3 * MIN)
    r = advance(r, T0 + 15 * MIN)
    expect(r.finished).toBe(true)
  })
})
