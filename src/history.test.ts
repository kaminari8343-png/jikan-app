import { describe, expect, it } from 'vitest'
import { buildBackup, closeSession, dateKey, dayEntries, dayMark, groupByDay, mergeHistory, monthGrid, parseBackup, upsertSession, weekdayOf } from './history'
import type { HistoryEntry, HistorySession, Rating } from './types'

const at = (y: number, m: number, d: number, h = 16, min = 0) => new Date(y, m - 1, d, h, min).getTime()

const entry = (startedAt: number, rating: Rating | null, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  name: 'しゅくだい',
  emoji: '✏️',
  color: '#ffb84d',
  plannedMinutes: 15,
  startedAt,
  endedAt: startedAt + 15 * 60_000,
  result: 'done',
  extensions: 0,
  rating,
  ...over,
})

const session = (id: string, startedAt: number, status: HistorySession['status'], ratings: (Rating | null)[]): HistorySession => ({
  id,
  startedAt,
  status,
  entries: ratings.map((r, i) => entry(startedAt + i * 20 * 60_000, r)),
})

describe('日づけ・カレンダー', () => {
  it('dateKey は端末の日付', () => {
    expect(dateKey(at(2026, 10, 2, 23, 59))).toBe('2026-10-02')
    expect(dateKey(at(2026, 1, 5, 0, 0))).toBe('2026-01-05')
  })
  it('曜日', () => {
    expect(weekdayOf(2026, 9, 2)).toBe('きん') // 2026-10-02 は金曜
    expect(weekdayOf(2026, 9, 4)).toBe('にち')
  })
  it('月のカレンダー（日曜はじまり・7の倍数）', () => {
    const g = monthGrid(2026, 9) // 2026年10月: 1日は木曜
    expect(g.length % 7).toBe(0)
    expect(g.slice(0, 5)).toEqual([null, null, null, null, 1])
    expect(g.filter((x) => x !== null)).toHaveLength(31)
    expect(monthGrid(2024, 1).filter((x) => x !== null)).toHaveLength(29) // うるう年
  })
})

describe('日ごとのまとめ', () => {
  it('スタートした日ごとに、はじめた順でまとめる。1日に何回でも', () => {
    const a = session('a', at(2026, 10, 2, 17), 'finished', ['good'])
    const b = session('b', at(2026, 10, 2, 15), 'finished', ['bad'])
    const c = session('c', at(2026, 10, 3, 16), 'finished', ['good'])
    const g = groupByDay([a, b, c])
    expect(g.get('2026-10-02')?.map((s) => s.id)).toEqual(['b', 'a'])
    expect(g.get('2026-10-03')?.map((s) => s.id)).toEqual(['c'])
  })
  it('日をまたいだ回は、スタートした日に入る', () => {
    const s = session('s', at(2026, 10, 2, 23, 50), 'finished', ['good', 'good'])
    expect(groupByDay([s]).has('2026-10-02')).toBe(true)
    expect(groupByDay([s]).has('2026-10-03')).toBe(false)
  })
  it('時刻順の一覧（回をまたいでも）', () => {
    const a = session('a', at(2026, 10, 2, 17), 'finished', ['good', 'good'])
    const b = session('b', at(2026, 10, 2, 16), 'aborted', ['bad'])
    const list = dayEntries([a, b])
    expect(list.map((x) => x.session.id)).toEqual(['b', 'a', 'a'])
    expect(list.map((x) => x.entry.startedAt)).toEqual([...list.map((x) => x.entry.startedAt)].sort((x, y) => x - y))
  })
})

describe('はなまるのルール', () => {
  const t = at(2026, 10, 2)
  it('さいごまでやって、ぜんぶ⭕️ → 花丸', () => {
    expect(dayMark([session('a', t, 'finished', ['good', 'good', 'good'])])).toBe('hanamaru')
  })
  it('さいごまでやったが、❌がまざっている → 丸', () => {
    expect(dayMark([session('a', t, 'finished', ['good', 'bad', 'good'])])).toBe('maru')
    expect(dayMark([session('a', t, 'finished', ['bad'])])).toBe('maru')
  })
  it('スキップしたカードは、評価しだい（⭕️なら花丸のまま）', () => {
    const s = session('a', t, 'finished', ['good', 'good'])
    s.entries[1] = entry(t, 'good', { result: 'skipped' })
    expect(dayMark([s])).toBe('hanamaru')
    s.entries[1] = entry(t, 'bad', { result: 'skipped' })
    expect(dayMark([s])).toBe('maru')
  })
  it('とちゅうでやめた日 → 印なし（⭕️ばかりでも）', () => {
    expect(dayMark([session('a', t, 'aborted', ['good', 'good'])])).toBeNull()
  })
  it('じっこう中・記録なしの日 → 印なし', () => {
    expect(dayMark([session('a', t, 'running', ['good'])])).toBeNull()
    expect(dayMark([])).toBeNull()
  })
  it('1日に何回かスタート: ぜんぶの回を合わせて見る', () => {
    expect(dayMark([session('a', t, 'finished', ['good']), session('b', t + 1, 'finished', ['good', 'good'])])).toBe('hanamaru')
    expect(dayMark([session('a', t, 'finished', ['good']), session('b', t + 1, 'finished', ['bad'])])).toBe('maru')
    expect(dayMark([session('a', t, 'finished', ['good']), session('b', t + 1, 'aborted', ['good'])])).toBeNull()
  })
  it('なにも評価しないうちにやめた回（まちがいスタート）は、数えない', () => {
    expect(dayMark([session('a', t, 'aborted', [null]), session('b', t + 1, 'finished', ['good'])])).toBe('hanamaru')
    expect(dayMark([session('a', t, 'aborted', [null])])).toBeNull()
  })
})

describe('はなまるの判定から外れるもの', () => {
  const t = at(2026, 10, 2)
  const base = () => session('a', t, 'finished', ['good', 'good'])

  it('じこくカード・じゆうじかんは、評価なしでも判定に入らない', () => {
    const s = base()
    s.entries.push(entry(t, null, { kind: 'free', name: 'じゆうじかん', result: 'done' }))
    s.entries.push(entry(t, null, { kind: 'fixed', name: 'ゆうごはん', result: 'done' }))
    expect(dayMark([s])).toBe('hanamaru')
  })
  it('じかんぎれのカードは ❌ 扱いにせず、判定から外す', () => {
    const s = base()
    s.entries.push(entry(t, null, { result: 'timeout', endedAt: t }))
    expect(dayMark([s])).toBe('hanamaru')
    s.entries.push(entry(t, 'bad'))
    expect(dayMark([s])).toBe('maru')
  })
  it('じこくカードで止めたカード（cutoff）は、評価したとおりに数える', () => {
    const s = base()
    s.entries.push(entry(t, 'bad', { result: 'cutoff' }))
    expect(dayMark([s])).toBe('maru')
  })
  it('判定できるカードが1枚もない日は、印なし', () => {
    const s = session('a', t, 'finished', [])
    s.entries.push(entry(t, null, { kind: 'fixed', result: 'done' }), entry(t, null, { result: 'timeout' }))
    expect(dayMark([s])).toBeNull()
  })
  it('kind のない古い記録は、ふつうのカードとして数える', () => {
    const s = base() // kind なし
    expect(s.entries.every((e) => e.kind === undefined)).toBe(true)
    expect(dayMark([s])).toBe('hanamaru')
  })
})

describe('記録の更新', () => {
  it('upsertSession: 同じ id は置きかえ、新しい id は追加', () => {
    const a = session('a', 1, 'running', [null])
    const list = upsertSession([], a)
    expect(upsertSession(list, { ...a, status: 'finished' })).toEqual([{ ...a, status: 'finished' }])
    expect(upsertSession(list, session('b', 2, 'running', []))).toHaveLength(2)
  })
  it('closeSession', () => {
    const a = session('a', 1, 'running', [null])
    expect(closeSession(a, 'timer').status).toBe('aborted')
    expect(closeSession(a, 'rate').status).toBe('aborted')
    expect(closeSession(a, 'done').status).toBe('finished')
  })
})

describe('バックアップ（書き出し・読み込み）', () => {
  const sessions = [session('a', at(2026, 10, 2), 'finished', ['good', 'bad']), session('b', at(2026, 10, 3), 'aborted', ['good'])]

  it('書き出して読みこむと、同じ内容にもどる', () => {
    const parsed = parseBackup(buildBackup(sessions))
    expect(parsed).toEqual({ ok: true, sessions, skipped: 0 })
  })
  it('JSONでないものは、エラーにする', () => {
    expect(parseBackup('これはJSONじゃない')).toMatchObject({ ok: false })
  })
  it('このアプリのファイルでないものは、エラーにする', () => {
    expect(parseBackup(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify({ app: 'other', history: [] }))).toMatchObject({ ok: false })
    expect(parseBackup('[]')).toMatchObject({ ok: false })
  })
  it('こわれた記録だけ とばして、のこりは読みこむ', () => {
    const text = JSON.stringify({
      app: 'jikan-app',
      version: 1,
      history: [sessions[0], { id: 'x', startedAt: 'あ', status: 'finished', entries: [] }, { nope: true }],
    })
    expect(parseBackup(text)).toEqual({ ok: true, sessions: [sessions[0]], skipped: 2 })
  })
  it('評価やかたが ふせいな記録は とばす', () => {
    const bad = JSON.parse(JSON.stringify(sessions[0]))
    bad.entries[0].rating = 'maybe'
    expect(parseBackup(JSON.stringify({ app: 'jikan-app', history: [bad] }))).toEqual({ ok: true, sessions: [], skipped: 1 })
  })
  it('じこくカード・じゆうじかん・じかんぎれ・cutoff も、書き出し/読み込みでそのまま戻る', () => {
    const s = session('n', at(2026, 10, 5), 'finished', ['good'])
    s.entries.push(
      entry(at(2026, 10, 5, 17), null, { kind: 'free', name: 'じゆうじかん', result: 'done', emoji: '🕊️' }),
      entry(at(2026, 10, 5, 18), null, { kind: 'fixed', name: 'ゆうごはん', result: 'done' }),
      entry(at(2026, 10, 5, 18), null, { kind: 'normal', result: 'timeout' }),
      entry(at(2026, 10, 5, 19), 'bad', { result: 'cutoff' }),
    )
    expect(parseBackup(buildBackup([s]))).toEqual({ ok: true, sessions: [s], skipped: 0 })
  })
  it('古い形式（kind なし・result は done/skipped）の記録も、そのまま読める', () => {
    const old = {
      app: 'jikan-app',
      version: 1,
      history: [
        {
          id: 'old',
          startedAt: at(2026, 10, 2),
          status: 'finished',
          entries: [{ name: 'しゅくだい', emoji: '✏️', color: '#ffb84d', plannedMinutes: 15, startedAt: at(2026, 10, 2), endedAt: at(2026, 10, 2) + 900000, result: 'done', extensions: 0, rating: 'good' }],
        },
      ],
    }
    const parsed = parseBackup(JSON.stringify(old))
    expect(parsed.ok && parsed.sessions[0].entries[0].kind).toBeUndefined()
    expect(parsed).toMatchObject({ ok: true, skipped: 0 })
  })
  it('kind や result が ふせいな記録は とばす', () => {
    const bad = JSON.parse(JSON.stringify(sessions[0]))
    bad.entries[0].kind = 'weird'
    const bad2 = JSON.parse(JSON.stringify(sessions[0]))
    bad2.entries[0].result = 'weird'
    expect(parseBackup(JSON.stringify({ app: 'jikan-app', history: [bad, bad2] }))).toEqual({ ok: true, sessions: [], skipped: 2 })
  })
  it('「じっこう中」のまま書き出された記録は、やめた扱いで読みこむ', () => {
    const running = session('r', at(2026, 10, 4), 'running', ['good'])
    const parsed = parseBackup(buildBackup([running]))
    expect(parsed.ok && parsed.sessions[0].status).toBe('aborted')
  })
  it('色が ふせいなときは、ふつうの色にする', () => {
    const s = JSON.parse(JSON.stringify(sessions[0]))
    s.entries[0].color = 'url(javascript:alert(1))'
    const parsed = parseBackup(JSON.stringify({ app: 'jikan-app', history: [s] }))
    expect(parsed.ok && parsed.sessions[0].entries[0].color).toBe('#b0bec5')
  })
  it('取りこみは、いまの記録を消さず、ないものだけ足す', () => {
    const current = [sessions[0]]
    const changed = { ...sessions[0], status: 'aborted' as const }
    const { merged, added } = mergeHistory(current, [changed, sessions[1]])
    expect(added).toBe(1)
    expect(merged.map((s) => s.id)).toEqual(['a', 'b'])
    expect(merged[0].status).toBe('finished') // いまのものを残す
  })
})
