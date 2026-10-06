import { describe, expect, it } from 'vitest'
import { MORNING_CARDS, PRESET_CARDS } from './cards'
import { bestTimes, coinsEarned, coinsForSaved, isTrialCard, recordKey, stampTrial } from './trial'
import { finishEarly, rateCard, startRun, skipCard, tick } from './runner'
import { buildBackup, parseBackup } from './history'
import { normalizeSettings } from './voiceSettings'
import { say } from './phrases.logic'
import { getCharacter } from './phrases'
import type { HistoryEntry, HistorySession, PlanItem } from './types'

const MIN = 60_000
const T0 = new Date(2026, 9, 2, 16, 0).getTime()
const item = (name: string, minutes: number, trial = true): PlanItem => ({ uid: name, cardId: name, name, emoji: '✏️', color: '#ccc', minutes, trial })
const keys = (s: { cues: { key: string }[] }) => s.cues.map((c) => c.key)

describe('はじめの設定（どのカードが オン？）', () => {
  it('べんきょう系と あさのカードは オン', () => {
    for (const id of ['homework', 'math', 'japanese', 'reading', 'calc-card', 'kana']) expect(isTrialCard(id), id).toBe(true)
    for (const c of MORNING_CARDS) expect(isTrialCard(c.id), c.id).toBe(true)
  })
  it('おやつ・ゲーム・動画系・じぶんで つくったカード・じこくカードは オフ', () => {
    for (const id of ['snack', 'game', 'netflix', 'unext', 'tv', 'youtube', 'rest', 'prepare', 'custom-abc', 'dinner']) expect(isTrialCard(id), id).toBe(false)
  })
  it('せっていで カードごとに かえられる', () => {
    expect(isTrialCard('homework', { homework: false })).toBe(false)
    expect(isTrialCard('snack', { snack: true })).toBe(true)
  })
  it('PRESET のカードは ぜんぶ どちらかに きまっている', () => {
    for (const c of PRESET_CARDS) expect(typeof isTrialCard(c.id)).toBe('boolean')
  })
  it('stampTrial: ふつうのカードだけに つく。じこくカードは いつも オフ', () => {
    const fixed: PlanItem = { ...item('dinner', 30, false), kind: 'fixed', startMin: 1110 }
    const out = stampTrial([{ ...item('x', 5, false), cardId: 'homework' }, { ...item('y', 5, true), cardId: 'snack' }, fixed], {})
    expect(out.map((i) => i.trial)).toEqual([true, false, false])
  })
  it('設定の保存: 読みこみで こわれたデータを すてる', () => {
    expect(normalizeSettings({ trialOverrides: { a: true, b: 'x', c: false } }).trialOverrides).toEqual({ a: true, c: false })
    expect(normalizeSettings({}).trialOverrides).toEqual({})
  })
})

describe('はやかったボーナス・コイン', () => {
  it('うかせた1ぷんに つき 1まい（1ぷんに たりなければ 0）', () => {
    expect(coinsForSaved(3 * MIN + 59_000)).toBe(3)
    expect(coinsForSaved(59_000)).toBe(0)
  })
  it('オンのカードを 3ぷん はやく おわる → 「はやかった」と ほめる。⭕️で コイン3まい', () => {
    const s0 = startRun([item('a', 10)], T0)
    const fin = finishEarly(s0.run, T0 + 7 * MIN)
    expect(keys(fin)).toEqual(['early', 'ask'])
    expect(fin.cues[0].vars).toEqual({ minutes: 3 })
    const e = fin.run.session.entries[0]
    expect(e).toMatchObject({ result: 'done', trial: true, activeMs: 7 * MIN, savedMs: 3 * MIN })
    const rated = rateCard(fin.run, 'good', T0 + 8 * MIN)
    expect(keys(rated)).toContain('coinGet')
    expect(rated.cues.find((c) => c.key === 'coinGet')!.vars).toEqual({ count: 3 })
    expect(rated.run.session.entries[0].coins).toBe(3)
  })
  it('❌のときは コインなし。「つぎは はやく ちゃんと できるかな？」', () => {
    const fin = finishEarly(startRun([item('a', 10)], T0).run, T0 + 5 * MIN)
    const bad = rateCard(fin.run, 'bad', T0 + 6 * MIN)
    expect(keys(bad)[0]).toBe('tryFaster')
    expect(keys(bad)).not.toContain('rateBad')
    expect(bad.run.session.entries[0].coins).toBeUndefined()
    expect(say('tryFaster', {}, getCharacter('onee'))).toBe('つぎは はやく ちゃんと できるかな？')
  })
  it('オフのカードは はやく おわっても ボーナスなし', () => {
    const fin = finishEarly(startRun([item('a', 10, false)], T0).run, T0 + 5 * MIN)
    expect(keys(fin)).toEqual(['end', 'ask'])
    expect(fin.run.session.entries[0].savedMs).toBeUndefined()
    expect(keys(rateCard(fin.run, 'good', T0 + 6 * MIN))).not.toContain('coinGet')
  })
  it('1ぷんに たりない はやさ・時間いっぱい・スキップは コインなし', () => {
    const quick = finishEarly(startRun([item('a', 10)], T0).run, T0 + 10 * MIN - 30_000)
    expect(keys(quick)[0]).toBe('end')
    expect(rateCard(quick.run, 'good', T0 + 11 * MIN).run.session.entries[0].coins).toBeUndefined()
    const full = tick(startRun([item('a', 10)], T0).run, T0 + 10 * MIN)
    expect(full.run.session.entries[0].savedMs).toBe(0)
    const sk = skipCard(startRun([item('a', 10)], T0).run, T0 + 2 * MIN)
    expect(rateCard(sk.run, 'good', T0 + 3 * MIN).run.session.entries[0].coins).toBeUndefined()
  })
  it('いちじていしの時間は ひく', () => {
    // 10ぷんのカード。2ぷん うごいて、5ふん ていし、2ふん うごいて おわる（うごいた時間 4ふん）
    let r = startRun([item('a', 10)], T0).run
    r = { ...r, accumMs: 2 * MIN, runningSince: null }
    r = { ...r, runningSince: T0 + 7 * MIN }
    const fin = finishEarly(r, T0 + 9 * MIN)
    expect(fin.run.session.entries[0]).toMatchObject({ activeMs: 4 * MIN, savedMs: 6 * MIN })
  })
  it('コインの ごうけいは きろくから 出す', () => {
    const e = (coins?: number): HistoryEntry => ({ name: 'a', emoji: '', color: '#ccc', plannedMinutes: 5, startedAt: 0, endedAt: 1, result: 'done', extensions: 0, rating: 'good', coins })
    const sessions: HistorySession[] = [
      { id: 's1', startedAt: 0, status: 'finished', entries: [e(3), e(), e(2)] },
      { id: 's2', startedAt: 1, status: 'finished', entries: [e(4)] },
    ]
    expect(coinsEarned(sessions)).toBe(9)
  })
})

describe('じぶんの きろく（ベスト）', () => {
  const play = (items: PlanItem[], doneAfterMin: number[], bests = new Map()) => {
    let r = startRun(items, T0).run
    let t = T0
    for (const m of doneAfterMin) {
      t += m * MIN
      const fin = finishEarly(r, t)
      const rated = rateCard(fin.run, 'good', t, bests)
      r = rated.run
    }
    return r
  }
  it('はじめて ⭕️ → しんきろく。つぎに もっと はやければ また しんきろく。おそければ ちがう', () => {
    const first = play([item('さんすう', 10)], [8])
    expect(first.session.entries[0].record).toBe(true)
    const bests1 = bestTimes([first.session])
    expect(bests1.get(recordKey('さんすう'))!.ms).toBe(8 * MIN)

    const faster = play([item('さんすう', 10)], [6], bests1)
    expect(faster.session.entries[0].record).toBe(true)
    const slower = play([item('さんすう', 10)], [9], bests1)
    expect(slower.session.entries[0].record).toBeUndefined()
    expect(rateCard(finishEarly(startRun([item('さんすう', 10)], T0).run, T0 + 9 * MIN).run, 'good', T0 + 10 * MIN, bests1).cues.map((c) => c.key)).not.toContain('newRecord')
  })
  it('❌のときは きろくに ならない', () => {
    const fin = finishEarly(startRun([item('こくご', 10)], T0).run, T0 + 2 * MIN)
    const bad = rateCard(fin.run, 'bad', T0 + 3 * MIN)
    expect(bad.run.session.entries[0].record).toBeUndefined()
    expect(bestTimes([bad.run.session]).size).toBe(0)
  })
  it('おなじ回の中で 2まい（おなじなまえ）やったとき、2まいめが はやければ しんきろく', () => {
    const r = play([{ ...item('こくご', 10), uid: 'u1' }, { ...item('こくご', 10), uid: 'u2' }], [8, 5])
    expect(r.session.entries.map((e) => e.record)).toEqual([true, true])
    const r2 = play([{ ...item('こくご', 10), uid: 'u1' }, { ...item('こくご', 10), uid: 'u2' }], [5, 8])
    expect(r2.session.entries.map((e) => e.record)).toEqual([true, undefined])
  })
  it('「なまえ」が ちがえば べつの きろく（おなじカードでも）', () => {
    const s = play([{ ...item('しゅくだい', 10), cardId: 'homework' }, { ...item('さんすう', 10), cardId: 'homework' }], [5, 9]).session
    const b = bestTimes([s])
    expect(b.size).toBe(2)
    expect(b.get(recordKey('しゅくだい'))!.ms).toBe(5 * MIN)
    expect(b.get(recordKey('さんすう'))!.ms).toBe(9 * MIN)
  })
  it('いま じっこう中の回は ベストから のぞける', () => {
    const s = play([item('a', 10)], [5]).session
    expect(bestTimes([s], s.id).size).toBe(0)
  })
})

describe('バックアップ', () => {
  it('タイムトライアルの きろくも そのまま 読める。古い きろくも 読める', () => {
    const r = play1()
    const parsed = parseBackup(buildBackup([r]))
    expect(parsed.ok && parsed.sessions[0].entries[0]).toMatchObject({ trial: true, activeMs: 5 * MIN, savedMs: 5 * MIN, coins: 5, record: true })
    const old = { app: 'jikan-app', version: 1, history: [{ id: 'o', startedAt: 1, status: 'finished', entries: [{ name: 'a', emoji: 'x', plannedMinutes: 5, startedAt: 1, endedAt: 2, result: 'done', extensions: 0, rating: 'good' }] }] }
    const p2 = parseBackup(JSON.stringify(old))
    expect(p2.ok && p2.sessions[0].entries[0].trial).toBeUndefined()
  })
  function play1(): HistorySession {
    const fin = finishEarly(startRun([item('a', 10)], T0).run, T0 + 5 * MIN)
    return rateCard(fin.run, 'good', T0 + 6 * MIN).run.session
  }
})

describe('セリフ（5人ぶん）', () => {
  it('はやかった！/ コイン / しんきろく', () => {
    const onee = getCharacter('onee')
    expect(say('early', { minutes: 3 }, onee)).toContain('さんぷん')
    expect(say('early', { minutes: 3 }, onee)).toContain('はやかった')
    expect(say('coinGet', { count: 3 }, onee)).toContain('さんまい')
    expect(say('newRecord', {}, onee)).toContain('しんきろく')
  })
})
