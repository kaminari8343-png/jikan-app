import { describe, expect, it } from 'vitest'
import {
  abortRun,
  canExtend,
  dueEvents,
  elapsedMs,
  extendCard,
  finishCard,
  markFired,
  normalizeRun,
  pause,
  phaseCountdown,
  rateCard,
  remainingMs,
  resume,
  scheduleEvents,
  skipCard,
  startRun,
  tick,
  type Step,
} from './runner'
import type { PlanItem } from './types'
import { say } from './phrases.logic'

const MIN = 60_000
const hm = (h: number, m = 0) => h * 60 + m
const DAY = new Date(2026, 9, 2).getTime() // 2026-10-02 0:00
const at = (h: number, m = 0, s = 0) => DAY + (h * 60 + m) * MIN + s * 1000

const normal = (name: string, minutes: number): PlanItem => ({ uid: name, cardId: name, name, emoji: '', color: '#ccc', minutes })
const fixed = (name: string, h: number, m: number, minutes: number): PlanItem => ({
  uid: name,
  cardId: name,
  name,
  emoji: '',
  color: '#999',
  minutes,
  kind: 'fixed',
  startMin: h * 60 + m,
})
const keys = (s: Step) => s.cues.map((c) => c.key)
const entries = (s: Step) => s.run.session.entries

describe('scheduleEvents（はんぶん・あと5ふん・あと1ぷん）', () => {
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
  const run = () => startRun([normal('a', 15)], at(16)).run
  it('バックグラウンドで tick が止まっても、時刻の差で正しく進む', () => {
    const r = run()
    expect(elapsedMs(r, at(16, 7))).toBe(7 * MIN)
    expect(remainingMs(r, at(16, 7))).toBe(8 * MIN)
    expect(remainingMs(r, at(18))).toBe(0)
  })
  it('一時停止中は進まない・再開でつづきから', () => {
    let r = pause(run(), at(16, 3))
    expect(elapsedMs(r, at(17))).toBe(3 * MIN)
    r = resume(r, at(17))
    expect(elapsedMs(r, at(17, 2))).toBe(5 * MIN)
  })
  it('時間がきたお知らせは、いちどだけ', () => {
    let r = run()
    expect(dueEvents(r, at(16, 7))).toEqual([])
    const due = dueEvents(r, at(16, 8))
    expect(due.map((e) => e.key)).toEqual(['half'])
    r = markFired(r, due)
    expect(dueEvents(r, at(16, 8))).toEqual([])
  })
})

describe('ふりかえり（⭕️❌）の流れ', () => {
  const plan = () => startRun([normal('a', 5), normal('b', 10)], at(16), 'sess-1')

  it('スタート: 1まいめの記録と、はじまりのセリフ', () => {
    const s = plan()
    expect(s.run.phase).toBe('timer')
    expect(keys(s)).toEqual(['start'])
    expect(s.cues[0].vars).toEqual({ name: 'a', minutes: 5 })
    expect(entries(s)[0]).toMatchObject({ kind: 'normal', name: 'a', plannedMinutes: 5, startedAt: at(16), endedAt: null, result: null, rating: null })
  })

  it('時間がきたら⭕️❌まち。評価するまで、つぎのカードは はじまらない', () => {
    const t = tick(plan().run, at(16, 5))
    expect(keys(t)).toEqual(['end', 'ask'])
    expect(t.run.phase).toBe('rate')
    expect(entries(t)[0]).toMatchObject({ result: 'done', endedAt: at(16, 5), rating: null })
    // まっているあいだは何も起きない
    const later = tick(t.run, at(18))
    expect(later.run).toBe(t.run)
    expect(later.cues).toEqual([])
    const r = rateCard(t.run, 'good', at(16, 7))
    expect(keys(r)).toEqual(['rateGood', 'next', 'start'])
    expect(r.run.phase).toBe('timer')
    expect(r.run.index).toBe(1)
    expect(entries(r)[0].rating).toBe('good')
    expect(entries(r)[1]).toMatchObject({ name: 'b', startedAt: at(16, 7), endedAt: null })
    expect(elapsedMs(r.run, at(16, 9))).toBe(2 * MIN)
  })

  it('タブが止まっていて気づくのが遅れても、終了時刻は ほんとうの時刻で記録する', () => {
    const t = tick(plan().run, at(16, 30))
    expect(entries(t)[0].endedAt).toBe(at(16, 5))
  })

  it('スキップしたカードも評価できる', () => {
    const s = skipCard(plan().run, at(16, 1))
    expect(keys(s)).toEqual(['ask'])
    expect(entries(s)[0]).toMatchObject({ result: 'skipped', endedAt: at(16, 1) })
    const r = rateCard(s.run, 'bad', at(16, 2))
    expect(entries(r)[0].rating).toBe('bad')
    expect(keys(r)).toEqual(['rateBad', 'next', 'start'])
  })

  it('さいごのカードを評価すると、おしまい（記録も finished）', () => {
    let s = rateCard(tick(plan().run, at(16, 5)).run, 'good', at(16, 5))
    s = rateCard(tick(s.run, at(16, 15)).run, 'bad', at(16, 16))
    expect(s.run.phase).toBe('done')
    expect(s.run.session.status).toBe('finished')
    expect(keys(s)).toEqual(['rateBad', 'allDone'])
    expect(entries(s).map((e) => e.rating)).toEqual(['good', 'bad'])
  })

  it('評価まちでないときに rateCard しても何も変わらない', () => {
    const r = plan().run
    expect(rateCard(r, 'good', at(16, 1)).run).toBe(r)
  })

  it('一時停止をはさんだ終了時刻', () => {
    let r = pause(plan().run, at(16, 2))
    r = resume(r, at(16, 10)) // 8ふん止めた
    expect(tick(r, at(16, 12)).run.phase).toBe('timer')
    expect(entries(tick(r, at(16, 13)))[0].endedAt).toBe(at(16, 13))
  })

  it('やめると「とちゅうでやめた」。さいごまで終われば finished', () => {
    expect(abortRun(plan().run).status).toBe('aborted')
    const done = rateCard(tick(rateCard(tick(plan().run, at(16, 5)).run, 'good', at(16, 5)).run, at(16, 15)).run, 'good', at(16, 15)).run
    expect(abortRun(done).status).toBe('finished')
  })

  it('古い形式の保存データは捨てる', () => {
    expect(normalizeRun(null)).toBeNull()
    expect(normalizeRun({ items: [], index: 0, finished: false })).toBeNull()
    expect(normalizeRun({ items: [normal('a', 5)], index: 0, phase: 'timer', session: { entries: [] } })).toBeNull()
    const r = plan().run
    expect(normalizeRun(JSON.parse(JSON.stringify(r)))).toEqual(r)
  })
})

describe('+5ふん', () => {
  it('回数を記録する。予定の時間は のばす前のまま。あと5ふん／1ぷんは もういちど話せる', () => {
    let r = startRun([normal('a', 10)], at(16)).run
    r = markFired(r, dueEvents(r, at(16, 9, 30))) // half, remaining1 まで話した
    const s1 = extendCard(r, at(16, 9, 30))
    expect(keys(s1)).toEqual(['extended'])
    const s2 = extendCard(s1.run, at(16, 9, 31))
    expect(entries(s2)[0]).toMatchObject({ extensions: 2, plannedMinutes: 10 })
    expect(s1.run.fired).toEqual(['half'])
    expect(dueEvents(s1.run, at(16, 14, 30)).map((e) => e.key)).toEqual(['remaining5', 'remaining1'])
  })
})

describe('じこくカード・じゆうじかん', () => {
  const dinner = fixed('ゆうごはん', 18, 30, 30)
  const bath = fixed('おふろ', 19, 30, 30)
  const bed = fixed('ねる', 21, 0, 0)

  it('さいしょがじこくカードで、まだ先なら じゆうじかんから', () => {
    const s = startRun([dinner], at(18, 0))
    expect(s.run.phase).toBe('free')
    expect(keys(s)).toEqual(['freeStart'])
    expect(s.cues[0].vars).toEqual({ fixed: 'ゆうごはん', minutes: 30 })
    expect(entries(s)[0]).toMatchObject({ kind: 'free', name: 'じゆうじかん', plannedMinutes: 30, startedAt: at(18) })
    expect(phaseCountdown(s.run, at(18, 10))).toEqual({ totalMs: 30 * MIN, remainingMs: 20 * MIN })
  })

  it('カードが早く終わったら、じこくカードの時刻まで じゆうじかん → 時刻になったら じこくカード', () => {
    const s0 = startRun([normal('a', 10), dinner], at(18, 0))
    const t = tick(s0.run, at(18, 10))
    const r = rateCard(t.run, 'good', at(18, 11))
    expect(r.run.phase).toBe('free')
    expect(keys(r)).toEqual(['rateGood', 'freeStart'])
    expect(r.cues[1].vars).toEqual({ fixed: 'ゆうごはん', minutes: 19 })
    // じゆうじかんの間は何も起きない（5分前まで）
    expect(tick(r.run, at(18, 20)).cues).toEqual([])
    // 5分前
    const soon = tick(r.run, at(18, 25))
    expect(keys(soon)).toEqual(['fixedSoon'])
    expect(soon.cues[0].vars).toEqual({ fixed: 'ゆうごはん', minutes: 5 })
    expect(keys(tick(soon.run, at(18, 26)))).toEqual([]) // 1回だけ
    // 時刻
    const go = tick(soon.run, at(18, 30))
    expect(go.run.phase).toBe('fixed')
    expect(keys(go)).toEqual(['fixedStart'])
    expect(go.cues[0].vars).toEqual({ fixed: 'ゆうごはん', clock: 18 * 60 + 30 })
    const es = entries(go)
    expect(es.map((e) => e.kind)).toEqual(['normal', 'free', 'fixed'])
    expect(es[1]).toMatchObject({ endedAt: at(18, 30), result: 'done' })
    expect(es[2]).toMatchObject({ startedAt: at(18, 30), plannedMinutes: 30, rating: null })
  })

  it('じこくカードの時刻になったら、実行中のカードを止めて ふりかえりへ（5分前の知らせも）', () => {
    const s0 = startRun([normal('a', 30), normal('b', 10), dinner], at(18, 15))
    const soon = tick(s0.run, at(18, 25))
    expect(keys(soon)).toEqual(['fixedSoon'])
    const t = tick(soon.run, at(18, 30))
    expect(keys(t)).toEqual(['fixedStart', 'ask'])
    expect(t.run.phase).toBe('rate')
    expect(entries(t)[0]).toMatchObject({ name: 'a', result: 'cutoff', endedAt: at(18, 30) })
    // ふりかえったら、b は じかんぎれ。そのまま じこくカードへ
    const r = rateCard(t.run, 'bad', at(18, 31))
    expect(keys(r)).toEqual(['rateBad', 'timeoutNote', 'start'])
    expect(r.cues[2].vars).toEqual({ name: 'ゆうごはん', minutes: 30 })
    expect(r.run.phase).toBe('fixed')
    expect(entries(r).map((e) => [e.name, e.kind, e.result, e.rating])).toEqual([
      ['a', 'normal', 'cutoff', 'bad'],
      ['b', 'normal', 'timeout', null],
      ['ゆうごはん', 'fixed', null, null],
    ])
    expect(entries(r)[1]).toMatchObject({ startedAt: at(18, 30), endedAt: at(18, 30) })
  })

  it('一時停止中でも、じこくカードの時刻には止まる', () => {
    const s0 = startRun([normal('a', 30), dinner], at(18, 15))
    const paused = pause(s0.run, at(18, 20))
    expect(keys(tick(paused, at(18, 30)))).toEqual(['fixedStart', 'ask'])
  })

  it('評価しているあいだに時刻がきたら、お知らせは1回だけ。評価のあとは じこくカードへ', () => {
    const s0 = startRun([normal('a', 14), normal('b', 5), dinner], at(18, 15))
    const rate = tick(s0.run, at(18, 29, 55)) // 18:30 の少し前に おわった
    expect(rate.run.phase).toBe('rate')
    const t1 = tick(rate.run, at(18, 30))
    expect(keys(t1)).toEqual(['fixedStart'])
    expect(t1.run.phase).toBe('rate')
    expect(tick(t1.run, at(18, 31)).cues).toEqual([])
    const r = rateCard(t1.run, 'good', at(18, 32))
    expect(keys(r)).toEqual(['rateGood', 'timeoutNote', 'start'])
    expect(r.run.phase).toBe('fixed')
  })

  it('時刻まで余裕があれば、ふりかえりのあと つぎのカードがはじまる', () => {
    const s0 = startRun([normal('a', 5), normal('b', 5), dinner], at(18, 0))
    const r = rateCard(tick(s0.run, at(18, 5)).run, 'good', at(18, 6))
    expect(r.run.phase).toBe('timer')
    expect(r.run.index).toBe(1)
  })

  it('おそすぎて5分前を すぎてからのお知らせは、話さない', () => {
    const s0 = startRun([normal('a', 30), dinner], at(18, 15))
    const t = tick(s0.run, at(18, 28))
    expect(t.cues).toEqual([])
    expect(t.run.fired).toContain('soon:ゆうごはん:5')
  })

  it('+5ふん が、つぎのじこくカードをこえるときは できない（理由を声で）', () => {
    const s0 = startRun([normal('a', 10), dinner], at(18, 15))
    expect(canExtend(s0.run, at(18, 15))).toEqual({ ok: true }) // 18:25 → 18:30 ぴったり
    const ok = extendCard(s0.run, at(18, 15))
    expect(keys(ok)).toEqual(['extended'])
    const ng = extendCard(ok.run, at(18, 15))
    expect(keys(ng)).toEqual(['cannotExtend'])
    expect(ng.cues[0].vars).toEqual({ fixed: 'ゆうごはん' })
    expect(ng.run).toBe(ok.run)
    // じこくカードがなければ、いくらでものばせる
    expect(keys(extendCard(startRun([normal('a', 10)], at(18)).run, at(18)))).toEqual(['extended'])
  })

  it('じこくカードが終わったら、つぎのカードへ（ふりかえりなし）', () => {
    const s0 = startRun([dinner, normal('a', 10)], at(18, 30))
    expect(s0.run.phase).toBe('fixed')
    expect(keys(s0)).toEqual(['start'])
    expect(tick(s0.run, at(18, 59)).cues).toEqual([])
    const t = tick(s0.run, at(19, 0))
    expect(keys(t)).toEqual(['end', 'next', 'start'])
    expect(t.run.phase).toBe('timer')
    expect(t.run.index).toBe(1)
    expect(entries(t)[0]).toMatchObject({ kind: 'fixed', startedAt: at(18, 30), endedAt: at(19, 0), result: 'done' })
  })

  it('じこくカードのつぎが、また先のじこくカードなら じゆうじかん', () => {
    const t = tick(startRun([dinner, bath], at(18, 30)).run, at(19, 0))
    expect(t.run.phase).toBe('free')
    expect(keys(t)).toEqual(['end', 'freeStart'])
    expect(t.cues[1].vars).toEqual({ fixed: 'おふろ', minutes: 30 })
  })

  it('もう終わっている時間のじこくカードは、とばす（記録もしない）', () => {
    const s = startRun([dinner, normal('a', 10)], at(19, 10))
    expect(s.run.phase).toBe('timer')
    expect(entries(s).map((e) => e.name)).toEqual(['a'])
  })

  it('スタートする前に もう過ぎていたブロックのカードは、記録せずに とばす（1日ぶんの土台を、夕方にスタートしたとき）', () => {
    const s = startRun([normal('a', 10), dinner], at(18, 40))
    expect(s.run.phase).toBe('fixed')
    expect(entries(s).map((e) => [e.name, e.result])).toEqual([['ゆうごはん', null]])
    expect(keys(s)).toEqual(['start'])
  })

  it('スタートしたあとで時刻をすぎたブロックは、やれなかったカードが じかんぎれになる', () => {
    const s0 = startRun([normal('a', 5), normal('b', 5), dinner], at(18, 20))
    const t = tick(s0.run, at(18, 25)) // a 終了 → 評価まち
    const r = rateCard(t.run, 'good', at(18, 31)) // 評価がおそくて 18:30 をすぎた
    expect(entries(r).map((e) => [e.name, e.result])).toEqual([
      ['a', 'done'],
      ['b', 'timeout'],
      ['ゆうごはん', null],
    ])
  })

  it('ねる（長さなし）: 時刻になったら1日のおわり。あとのカードは じかんぎれ', () => {
    const s0 = startRun([normal('a', 5), bed, normal('z', 5)], at(20, 0))
    const r = rateCard(tick(s0.run, at(20, 5)).run, 'good', at(20, 6))
    expect(r.run.phase).toBe('free')
    const end = tick(r.run, at(21, 0))
    expect(end.run.phase).toBe('done')
    expect(end.run.session.status).toBe('finished')
    expect(keys(end)).toEqual(['fixedStart', 'timeoutNote', 'endOfDay'])
    expect(entries(end).map((e) => [e.name, e.kind, e.result])).toEqual([
      ['a', 'normal', 'done'],
      ['じゆうじかん', 'free', 'done'],
      ['ねる', 'fixed', 'done'],
      ['z', 'normal', 'timeout'],
    ])
  })

  it('途中でやめたとき、じゆうじかんの記録は やめた時刻で閉じる', () => {
    const s = startRun([dinner], at(18, 0))
    const session = abortRun(s.run, at(18, 12))
    expect(session.status).toBe('aborted')
    expect(session.entries[0]).toMatchObject({ kind: 'free', endedAt: at(18, 12) })
  })

  it('じゆうじかんは、スキップ・延長・一時停止の対象にならない', () => {
    const s = startRun([dinner], at(18, 0))
    expect(skipCard(s.run, at(18, 1)).run).toBe(s.run)
    expect(extendCard(s.run, at(18, 1)).run).toBe(s.run)
    expect(pause(s.run, at(18, 1))).toBe(s.run)
  })

  it('じこくカードを2つこえて追いつく（画面が止まっていたとき）', () => {
    const s0 = startRun([normal('a', 10), dinner, normal('b', 10), bath], at(18, 0))
    const rated = rateCard(tick(s0.run, at(18, 10)).run, 'good', at(18, 11))
    const t = tick(rated.run, at(20, 10)) // ごはんも おふろも すぎた
    // ゆうごはん(18:30-19:00)は とばされ、b は おふろ(19:30)に まにあわず じかんぎれ、おふろ(〜20:00)もとばされる
    expect(t.run.phase).toBe('done')
    expect(entries(t).map((e) => [e.name, e.kind, e.result])).toEqual([
      ['a', 'normal', 'done'],
      ['じゆうじかん', 'free', 'done'],
      ['b', 'normal', 'timeout'],
    ])
  })
})

describe('finishCard', () => {
  it('じこくカードで止めたカードは cutoff で記録される', () => {
    const r = finishCard(startRun([normal('a', 10)], at(18)).run, 'cutoff', at(18, 4))
    expect(r.session.entries[0]).toMatchObject({ result: 'cutoff', endedAt: at(18, 4) })
  })
})

// ---- しずか・でかけるカード・あさの流れ ----
const fx = (name: string, h: number, m: number, minutes: number, extra: Partial<PlanItem> = {}): PlanItem => ({
  ...fixed(name, h, m, minutes),
  ...extra,
})
const wake = fx('おきる', 6, 30, 0, { endOfDay: false })
const leave = fx('いえをでる', 7, 20, 0, { endOfDay: false, leaving: true, quiet: false })
const school = fx('がっこう', 7, 20, 460, { quiet: true })
const dinnerQ = fx('ゆうごはん', 18, 30, 30, { quiet: true })
const bedEnd = fx('ねる', 21, 0, 0, { endOfDay: true })

describe('しずか', () => {
  it('しずかのじこくカード: 開始・終了のお知らせは しない（5分前は する）', () => {
    const s0 = startRun([normal('a', 5), dinnerQ, normal('b', 5)], at(18, 20))
    // 5分前（18:25）。a は 18:25 に終わる
    const rate = tick(s0.run, at(18, 25))
    expect(keys(rate)).toContain('end') // ふつうのカードの終わりは話す
    // 18:26 に評価 → じゆうじかん（freeStart は話す）
    const free = rateCard(rate.run, 'good', at(18, 26))
    expect(keys(free)).toEqual(['rateGood', 'freeStart'])
    // 18:30: しずかなので「時刻だよ」は言わない
    const go = tick(free.run, at(18, 30))
    expect(go.run.phase).toBe('fixed')
    expect(go.cues).toEqual([])
    // 18:55 までは何も言わない。19:00 に終わっても「おわり」は言わない。つぎのカードのお知らせは言う
    expect(tick(go.run, at(18, 55)).cues).toEqual([])
    const end = tick(go.run, at(19, 0))
    expect(keys(end)).toEqual(['next', 'start']) // 'end' が無い
    expect(end.run.index).toBe(2)
  })

  it('5分前のお知らせは、しずかでも する', () => {
    const s0 = startRun([normal('a', 30), dinnerQ], at(18, 15))
    const soon = tick(s0.run, at(18, 25))
    expect(keys(soon)).toEqual(['fixedSoon'])
    expect(soon.cues[0].vars).toEqual({ fixed: 'ゆうごはん', minutes: 5 })
  })

  it('しずかのカードで実行中のカードを止めるとき: 「時刻だよ」は言わず、ふりかえりだけ', () => {
    const s0 = startRun([normal('a', 30), dinnerQ], at(18, 15))
    const soon = tick(s0.run, at(18, 25))
    const cut = tick(soon.run, at(18, 30))
    expect(keys(cut)).toEqual(['ask'])
    expect(cut.run.phase).toBe('rate')
    expect(entries(cut)[0].result).toBe('cutoff')
    // 評価のあとに じこくカードがはじまる（しずか: start も言わない）
    const r = rateCard(cut.run, 'good', at(18, 31))
    expect(keys(r)).toEqual(['rateGood'])
    expect(r.run.phase).toBe('fixed')
  })

  it('しずかでないカードは、これまでどおり話す', () => {
    const loud = fx('ゆうごはん', 18, 30, 30)
    const s0 = startRun([loud], at(18, 0))
    const go = tick(s0.run, at(18, 30))
    expect(keys(go)).toEqual(['fixedStart'])
    expect(keys(tick(go.run, at(19, 0)))).toEqual(['end', 'allDone'])
  })

  it('しずかのカードで はじまる（スタート時に もう時刻）: startのセリフを言わない', () => {
    expect(startRun([dinnerQ], at(18, 40)).cues).toEqual([])
  })

  it('1日のおわり（ねる）がしずかなら、おやすみも言わない', () => {
    const quietBed = { ...bedEnd, quiet: true }
    const s0 = startRun([quietBed], at(20, 0))
    const t = tick(s0.run, at(21, 0))
    expect(t.run.phase).toBe('done')
    expect(t.cues).toEqual([])
  })
})

describe('でかけるカード（いえをでる）', () => {
  it('10・5・1ぷんまえに「あと◯で いえをでるよ」。7:20 に「いってらっしゃい！」。どれも1回だけ', () => {
    const s0 = startRun([normal('a', 60), leave, school], at(6, 30))
    const said: string[] = []
    let run = s0.run
    for (const [h, m, sec] of [[7, 9, 0], [7, 10, 0], [7, 10, 1], [7, 14, 59], [7, 15, 0], [7, 18, 0], [7, 19, 0], [7, 19, 30], [7, 20, 0]] as const) {
      const t = tick(run, at(h, m, sec))
      run = t.run
      for (const c of t.cues) said.push(`${h}:${String(m).padStart(2, '0')} ${c.key}${c.vars?.minutes ? `(${c.vars.minutes})` : ''}`)
    }
    expect(said).toEqual(['7:10 leaveSoon(10)', '7:15 leaveSoon(5)', '7:19 leaveSoon(1)', '7:20 leaveNow', '7:20 ask'])
    // セリフの中身
    expect(say('leaveSoon', { fixed: 'いえをでる', minutes: 10 })).toBe('あとじゅっぷんで いえをでるよ')
    expect(say('leaveSoon', { fixed: 'いえをでる', minutes: 1 })).toBe('あといっぷんで いえをでるよ')
    expect(say('leaveNow')).toBe('いってらっしゃい！')
  })

  it('スタートが 7:12 なら、10ぷん前は言わず（もう過ぎた）、5分前と1分前は言う', () => {
    const s0 = startRun([normal('a', 60), leave], at(7, 12))
    expect(s0.run.fired.length).toBe(0)
    const t0 = tick(s0.run, at(7, 12, 1))
    expect(t0.cues).toEqual([]) // 10分前は 7:10 で、もう古い
    expect(keys(tick(t0.run, at(7, 15)))).toEqual(['leaveSoon'])
  })
})

describe('あさの流れ: おきる → あさのカード → いえをでる → がっこう', () => {
  const morning = () => [wake, normal('きがえ', 10), normal('あさごはん', 15), leave, school, dinnerQ, bedEnd]

  it('おきる 6:30 まではじゆうじかん。時刻に知らせて、そのままあさのカードがはじまる', () => {
    const s0 = startRun(morning(), at(6, 25))
    expect(s0.run.phase).toBe('free')
    expect(keys(s0)).toEqual(['freeStart'])
    const t = tick(s0.run, at(6, 30))
    expect(keys(t)).toEqual(['fixedStart', 'next', 'start'])
    expect(t.cues[0].vars).toEqual({ fixed: 'おきる', clock: hm(6, 30) })
    expect(t.cues[2].vars).toEqual({ name: 'きがえ', minutes: 10 })
    expect(t.run.phase).toBe('timer')
    expect(t.run.index).toBe(1)
    expect(entries(t).map((e) => [e.kind, e.name])).toEqual([['free', 'じゆうじかん'], ['fixed', 'おきる'], ['normal', 'きがえ']])
    expect(entries(t)[1]).toMatchObject({ startedAt: at(6, 30), endedAt: at(6, 30), result: 'done', plannedMinutes: 0 })
  })

  it('あさのカードを ぜんぶ終えたら、いえをでる まで じゆうじかん → 時刻に「いってらっしゃい！」→ がっこうは しずか', () => {
    let s = tick(startRun(morning(), at(6, 25)).run, at(6, 30))
    s = rateCard(tick(s.run, at(6, 40)).run, 'good', at(6, 41)) // きがえ
    expect(s.run.index).toBe(2)
    s = rateCard(tick(s.run, at(6, 56)).run, 'good', at(6, 57)) // あさごはん
    expect(s.run.phase).toBe('free')
    expect(s.run.items[s.run.index].name).toBe('いえをでる')
    expect(keys(s)).toEqual(['rateGood', 'freeStart'])
    expect(s.cues[1].vars).toEqual({ fixed: 'いえをでる', minutes: 23 })
    // 7:20 → いってらっしゃい。がっこうが はじまるが、しずかなので ほかには言わない
    const out = tick(s.run, at(7, 20))
    expect(keys(out)).toEqual(['leaveNow'])
    expect(out.run.phase).toBe('fixed')
    expect(out.run.items[out.run.index].name).toBe('がっこう')
    const es = entries(out)
    expect(es.slice(-2).map((e) => [e.kind, e.name])).toEqual([['fixed', 'いえをでる'], ['fixed', 'がっこう']])
    expect(es[es.length - 2]).toMatchObject({ startedAt: at(7, 20), endedAt: at(7, 20), plannedMinutes: 0 })
    // がっこうは 15:00 に終わる（しずか: おわりは言わない）。ゆうごはんまで じゆうじかん
    const home = tick(out.run, at(15, 0))
    expect(home.run.phase).toBe('free')
    expect(keys(home)).toEqual(['freeStart'])
  })

  it('朝のカードが時間をオーバーしても、7:20 に いまのカードを止めて ふりかえり。やれなかったカードは じかんぎれ。いえをでるは記録される', () => {
    const items = [wake, normal('きがえ', 30), normal('はみがき', 5), leave, school]
    let s = tick(startRun(items, at(6, 30)).run, at(6, 30)) // おきる→きがえ
    expect(s.run.items[s.run.index].name).toBe('きがえ')
    // きがえは 7:00 までのはずが 一時停止して 7:20 をむかえる
    const paused = pause(s.run, at(6, 40))
    const cut = tick(paused, at(7, 20))
    expect(keys(cut)).toEqual(['leaveNow', 'ask'])
    expect(cut.run.phase).toBe('rate')
    const r = rateCard(cut.run, 'bad', at(7, 21))
    expect(keys(r)).toEqual(['rateBad', 'timeoutNote'])
    expect(entries(r).map((e) => [e.name, e.result ?? e.kind])).toEqual([
      ['おきる', 'done'],
      ['きがえ', 'cutoff'],
      ['はみがき', 'timeout'],
      ['いえをでる', 'done'], // 記録される
      ['がっこう', 'fixed'],
    ])
    expect(r.run.phase).toBe('fixed')
  })

  it('夕方にスタートしたら、朝の分（おきる・あさのカード・いえをでる・がっこう）は 記録せず だまって とばす', () => {
    const s = startRun(morning(), at(15, 30))
    expect(s.run.phase).toBe('free')
    expect(keys(s)).toEqual(['freeStart'])
    expect(s.cues[0].vars).toEqual({ fixed: 'ゆうごはん', minutes: 180 })
    expect(entries(s).map((e) => e.kind)).toEqual(['free'])
  })

  it('朝（6:28）にスタートして おきる ちょうどでも、いまの時刻なら記録して知らせる', () => {
    const s = startRun(morning(), at(6, 30, 5))
    expect(keys(s)).toEqual(['fixedStart', 'start']) // 最初のカードなので「つぎは」は言わない
    expect(entries(s).map((e) => e.name)).toEqual(['おきる', 'きがえ'])
  })

  it('時刻だけのカードは、カウントダウンも +5ふん の邪魔もしない（+5ふん は いえをでる をこえるとき不可）', () => {
    const s = tick(startRun(morning(), at(7, 0)).run, at(7, 0))
    // 7:00 スタート: おきる は過ぎている → きがえ(10) → いえをでる 7:20
    expect(s.run.phase).toBe('timer')
    const a = extendCard(s.run, at(7, 0))
    expect(keys(a)).toEqual(['extended']) // 7:10 +5 = 7:15 ≦ 7:20
    const b = extendCard(a.run, at(7, 0))
    expect(keys(b)).toEqual(['extended']) // 7:20 ちょうど
    const c = extendCard(b.run, at(7, 0))
    expect(keys(c)).toEqual(['cannotExtend'])
    expect(c.cues[0].vars).toEqual({ fixed: 'いえをでる' })
  })
})

describe('1日のおわり（endOfDay の明示）', () => {
  it('endOfDay: false の長さ0は「時刻だけ」で、1日のおわりにはならない', () => {
    const s = startRun([wake, normal('a', 5)], at(6, 30))
    expect(s.run.phase).toBe('timer')
    expect(s.run.session.status).toBe('running')
  })
  it('endOfDay: true なら、長さ0でも1日のおわり。あとのカードは じかんぎれ', () => {
    const s = startRun([normal('a', 5), bedEnd, normal('z', 5)], at(21, 0))
    expect(s.run.phase).toBe('done')
    // a は スタート前に過ぎたブロック（だまって とばす）。ねる より あとの z だけが じかんぎれ
    expect(entries(s).map((e) => [e.name, e.result])).toEqual([
      ['ねる', 'done'],
      ['z', 'timeout'],
    ])
  })
})

