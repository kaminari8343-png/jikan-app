import { describe, expect, it } from 'vitest'
import { abortRun, dueEvents, elapsedMs, extend, finishCard, markFired, normalizeRun, pause, rateCard, remainingMs, resume, scheduleEvents, startRun } from './runner'
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

describe('ふりかえり（⭕️❌）の流れ', () => {
  const plan = () => startRun([item('a', 5), item('b', 10)], T0, 'sess-1')

  it('スタートすると、1まいめの記録ができる', () => {
    const r = plan()
    expect(r.phase).toBe('timer')
    expect(r.session.entries).toHaveLength(1)
    expect(r.session.entries[0]).toMatchObject({ name: 'a', plannedMinutes: 5, startedAt: T0, endedAt: null, result: null, rating: null, extensions: 0 })
  })

  it('時間がきたら⭕️❌まち。評価するまで、つぎのカードは はじまらない', () => {
    let r = finishCard(plan(), 'done', T0 + 5 * MIN)
    expect(r.phase).toBe('rate')
    expect(r.index).toBe(0)
    expect(r.runningSince).toBeNull()
    expect(r.session.entries).toHaveLength(1)
    expect(r.session.entries[0]).toMatchObject({ result: 'done', endedAt: T0 + 5 * MIN, rating: null })
    // まっているあいだは時間が進まない
    expect(elapsedMs(r, T0 + 60 * MIN)).toBe(0)
    r = rateCard(r, 'good', T0 + 7 * MIN)
    expect(r.phase).toBe('timer')
    expect(r.index).toBe(1)
    expect(r.session.entries[0].rating).toBe('good')
    // つぎのカードは、評価をおした時刻からはじまる
    expect(r.session.entries[1]).toMatchObject({ name: 'b', startedAt: T0 + 7 * MIN, endedAt: null })
    expect(elapsedMs(r, T0 + 9 * MIN)).toBe(2 * MIN)
  })

  it('タブが止まっていて気づくのが遅れても、終了時刻は ほんとうの時刻で記録する', () => {
    const r = finishCard(plan(), 'done', T0 + 30 * MIN)
    expect(r.session.entries[0].endedAt).toBe(T0 + 5 * MIN)
  })

  it('一時停止をはさんだ終了時刻', () => {
    let r = pause(plan(), T0 + 2 * MIN)
    r = resume(r, T0 + 10 * MIN) // 8ふん止めた
    r = finishCard(r, 'done', T0 + 13 * MIN)
    expect(r.session.entries[0].endedAt).toBe(T0 + 13 * MIN)
  })

  it('スキップしたカードも評価できる', () => {
    let r = finishCard(plan(), 'skipped', T0 + 1 * MIN)
    expect(r.phase).toBe('rate')
    expect(r.session.entries[0]).toMatchObject({ result: 'skipped', endedAt: T0 + 1 * MIN })
    r = rateCard(r, 'bad', T0 + 2 * MIN)
    expect(r.session.entries[0].rating).toBe('bad')
    expect(r.index).toBe(1)
  })

  it('+5ふん をおした回数を記録する', () => {
    let r = plan()
    r = extend(r, T0 + 1 * MIN)
    r = extend(r, T0 + 2 * MIN)
    expect(r.session.entries[0].extensions).toBe(2)
    // 予定の時間は、のばす前のまま
    expect(r.session.entries[0].plannedMinutes).toBe(5)
  })

  it('さいごのカードを評価すると、おしまい（記録も finished）', () => {
    let r = rateCard(finishCard(plan(), 'done', T0 + 5 * MIN), 'good', T0 + 5 * MIN)
    r = rateCard(finishCard(r, 'done', T0 + 15 * MIN), 'bad', T0 + 16 * MIN)
    expect(r.phase).toBe('done')
    expect(r.session.status).toBe('finished')
    expect(r.session.entries.map((e) => e.rating)).toEqual(['good', 'bad'])
  })

  it('評価まちでないときに rateCard しても何も変わらない', () => {
    const r = plan()
    expect(rateCard(r, 'good', T0 + MIN)).toBe(r)
  })

  it('やめると「とちゅうでやめた」。さいごまで終われば finished', () => {
    expect(abortRun(plan()).status).toBe('aborted')
    expect(abortRun(finishCard(plan(), 'done', T0 + 5 * MIN)).status).toBe('aborted')
    const done = rateCard(finishCard(rateCard(finishCard(plan(), 'done', T0), 'good', T0), 'done', T0), 'good', T0)
    expect(abortRun(done).status).toBe('finished')
  })

  it('古い形式の保存データは捨てる', () => {
    expect(normalizeRun(null)).toBeNull()
    expect(normalizeRun({ items: [], index: 0, finished: false })).toBeNull()
    const r = plan()
    expect(normalizeRun(JSON.parse(JSON.stringify(r)))).toEqual(r)
  })
})
