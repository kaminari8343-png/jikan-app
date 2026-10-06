import { describe, expect, it } from 'vitest'
import { PRESET_CARDS } from './cards'
import { clampPlay, coinBalance, coinEventsOn, extendsToday, isPlayCard, stampPlay } from './coins'
import { extendCard, extendWithCoins, finishEarly, rateCard, startRun, remainingMs, canExtend } from './runner'
import { buildBackup, mergeSpends, parseBackup } from './history'
import { normalizeSettings } from './voiceSettings'
import { say } from './phrases.logic'
import { getCharacter } from './phrases'
import type { CoinSpend, HistorySession, PlanItem } from './types'

const MIN = 60_000
const DAY = new Date(2026, 9, 6).getTime()
const at = (h: number, m = 0, s = 0) => DAY + (h * 60 + m) * MIN + s * 1000
const RULES = { cost: 30, minutes: 10, perDay: 2 }
const play = (name = 'ゲーム', minutes = 20): PlanItem => ({ uid: name, cardId: 'game', name, emoji: '🎮', color: '#8ab4ff', minutes, play: true })
const fixed = (name: string, h: number, m: number): PlanItem => ({ uid: name, cardId: name, name, emoji: '🍚', color: '#f4a259', minutes: 30, kind: 'fixed', startMin: h * 60 + m })
const keys = (s: { cues: { key: string }[] }) => s.cues.map((c) => c.key)
const spend = (coins: number, atMs: number, id = String(atMs)): CoinSpend => ({ id, at: atMs, coins, kind: 'extend', name: 'ゲーム', minutes: 10 })

describe('あそびカード', () => {
  it('はじめは ゲーム・ユーチューブ・ネットフリックス・ユーネクスト・テレビ だけ', () => {
    const ids = PRESET_CARDS.filter((c) => isPlayCard(c.id)).map((c) => c.id).sort()
    expect(ids).toEqual(['game', 'netflix', 'tv', 'unext', 'youtube'])
  })
  it('親が かえられる', () => {
    expect(isPlayCard('snack', { snack: true })).toBe(true)
    expect(isPlayCard('game', { game: false })).toBe(false)
  })
  it('よていを くむとき さいだい時間に おさえる（ほかの カード・じこくカードは そのまま）', () => {
    const items = [play('ゲーム', 60), { ...play('おやつ', 60), cardId: 'snack' }, { ...fixed('ゆうごはん', 18, 30), cardId: 'game' }]
    const out = clampPlay(items, {}, 30)
    expect(out.map((i) => i.minutes)).toEqual([30, 60, 30])
    expect(clampPlay([play('ゲーム', 20)], {}, 30)).toEqual([play('ゲーム', 20)])
    expect(clampPlay(items, { snack: true }, 45)[1].minutes).toBe(45)
  })
  it('スタートするとき 目じるしを つける', () => {
    const out = stampPlay([{ ...play(), play: undefined }, { ...play('おやつ'), cardId: 'snack', play: undefined }], {})
    expect(out.map((i) => i.play)).toEqual([true, false])
  })
})

describe('コインで のばす', () => {
  const start = (items: PlanItem[], now = at(16, 0)) => startRun(items, now).run
  it('コインが たりていれば 10ぷん のびる。30まい つかう。「のびたよ」と言う', () => {
    const r = start([play()])
    const s = extendWithCoins(r, at(16, 5), RULES, 45, 0)
    expect(s.spent).toBe(30)
    expect(keys(s)).toEqual(['coinExtended'])
    expect(s.cues[0].vars).toEqual({ minutes: 10 })
    expect(s.run.extraMs).toBe(10 * MIN)
    expect(remainingMs(s.run, at(16, 5))).toBe(25 * MIN)
    expect(s.run.session.entries[0].coinExtensions).toBe(1)
    expect(say('coinExtended', { minutes: 10 }, getCharacter('onee'))).toBe('じゅっぷん のびたよ！')
  })
  it('コインが たりないと のびない。「あと◯まい たりないよ」', () => {
    const r = start([play()])
    const s = extendWithCoins(r, at(16, 5), RULES, 12, 0)
    expect(s.spent).toBe(0)
    expect(s.run).toBe(r)
    expect(keys(s)).toEqual(['coinShort'])
    expect(s.cues[0].vars).toEqual({ count: 18 })
    expect(say('coinShort', { count: 18 }, getCharacter('onee'))).toBe('あとじゅうはちまい たりないよ')
  })
  it('1日2回まで', () => {
    const r = start([play('ゲーム', 60)])
    expect(extendWithCoins(r, at(16, 5), RULES, 100, 1).spent).toBe(30)
    const s = extendWithCoins(r, at(16, 5), RULES, 100, 2)
    expect(s.spent).toBe(0)
    expect(keys(s)).toEqual(['extendLimit'])
  })
  it('つぎの じこくカードを こえる のばしかたは できない（りゆうを 言う）', () => {
    const r = start([play('ゲーム', 20), fixed('ゆうごはん', 16, 25)])
    const s = extendWithCoins(r, at(16, 5), RULES, 100, 0)
    expect(s.spent).toBe(0)
    expect(keys(s)).toEqual(['cannotExtend'])
    expect(s.cues[0].vars).toEqual({ fixed: 'ゆうごはん' })
    // ちょうど 間に合うなら のびる
    const ok = extendWithCoins(start([play('ゲーム', 20), fixed('ゆうごはん', 16, 30)]), at(16, 5), RULES, 100, 0)
    expect(ok.spent).toBe(30)
  })
  it('あそびカードでは ない カードは コインで のばせない。+5ふんは そのまま 使える', () => {
    const r = start([{ ...play('しゅくだい', 15), play: false }])
    expect(extendWithCoins(r, at(16, 5), RULES, 100, 0).spent).toBe(0)
    expect(keys(extendCard(r, at(16, 5)))).toEqual(['extended'])
  })
  it('のばしたあと、あと5ふん／1ぷんの おしらせが もういちど 出る', () => {
    let r = start([play('ゲーム', 20)])
    r = { ...r, fired: ['half', 'remaining5', 'remaining1'] }
    const s = extendWithCoins(r, at(16, 19), RULES, 100, 0)
    expect(s.run.fired).toEqual(['half'])
  })
  it('変更した きまり（コイン・分）で はたらく', () => {
    const r = start([play()])
    const s = extendWithCoins(r, at(16, 5), { cost: 5, minutes: 3, perDay: 9 }, 5, 8)
    expect(s.spent).toBe(5)
    expect(s.run.extraMs).toBe(3 * MIN)
    expect(canExtend(s.run, at(16, 5), 3 * MIN).ok).toBe(true)
  })
})

describe('コインの つづり（もらった・つかった・のこり）', () => {
  const session = (id: string, startedAt: number, coins: number[]): HistorySession => ({
    id,
    startedAt,
    status: 'finished',
    entries: coins.map((c, i) => ({ name: `カード${i}`, emoji: '✏️', color: '#ccc', plannedMinutes: 5, startedAt: startedAt + i * MIN, endedAt: startedAt + i * MIN + 1000, result: 'done' as const, extensions: 0, rating: 'good' as const, coins: c })),
  })
  const sessions = [session('a', at(16, 0), [3, 4]), session('b', DAY - 86_400_000 + at(10, 0) - DAY, [10])]
  it('のこり = もらった − つかった（マイナスには ならない）', () => {
    expect(coinBalance(sessions, [])).toBe(17)
    expect(coinBalance(sessions, [spend(10, at(17))])).toBe(7)
    expect(coinBalance(sessions, [spend(100, at(17))])).toBe(0)
  })
  it('きょう のばした回数（ひづけが かわると リセット）', () => {
    const l = [spend(30, at(16)), spend(30, at(17)), spend(30, at(17) - 86_400_000, 'y')]
    expect(extendsToday(l, at(18))).toBe(2)
    expect(extendsToday(l, at(18) + 86_400_000)).toBe(0)
  })
  it('日ごとの きろく: もらった・つかった が じゅんばんに 出る', () => {
    const key = '2026-10-06'
    const ev = coinEventsOn(sessions, [spend(30, at(17, 30)), spend(30, at(17, 30) + 3 * 86_400_000, 'other')], key)
    expect(ev.map((e) => e.delta)).toEqual([-30, 4, 3])
    expect(ev[0].label).toContain('のばした')
    expect(coinEventsOn(sessions, [], '2026-10-07')).toEqual([])
  })
  it('バックアップに コインを つかった きろくも 入る。古い バックアップも 読める。まぜると ふえない', () => {
    const text = buildBackup(sessions, 1, [spend(30, at(17), 'x')])
    const p = parseBackup(text)
    expect(p.ok && p.coinSpends).toEqual([spend(30, at(17), 'x')])
    const old = parseBackup(JSON.stringify({ app: 'jikan-app', history: [] }))
    expect(old.ok && old.coinSpends).toEqual([])
    const bad = parseBackup(JSON.stringify({ app: 'jikan-app', history: [], coinSpends: [{ id: 1 }, { id: 'z', at: 1, coins: -3, kind: 'extend' }] }))
    expect(bad.ok && bad.coinSpends).toEqual([])
    expect(mergeSpends([spend(30, 5, 'x')], [spend(30, 5, 'x'), spend(30, 9, 'y')]).map((s) => s.id)).toEqual(['x', 'y'])
  })
  it('タイムトライアルで もらった コインを つかって のばす（つうしで）', () => {
    const fin = finishEarly(startRun([{ uid: 'a', cardId: 'homework', name: 'しゅくだい', emoji: '✏️', color: '#fc0', minutes: 40, trial: true }], at(15, 0)).run, at(15, 10))
    const rated = rateCard(fin.run, 'good', at(15, 11))
    const earned = rated.run.session.entries[0].coins!
    expect(earned).toBe(30)
    expect(coinBalance([rated.run.session], [])).toBe(30)
  })
})

describe('せっていの ほぞん', () => {
  it('はじめの値と、はんいの おさえ', () => {
    const d = normalizeSettings({})
    expect(d.playMax).toBe(30)
    expect(d.coinExtend).toEqual({ cost: 30, minutes: 10, perDay: 2 })
    const odd = normalizeSettings({ playMax: 9999, coinExtend: { cost: -5, minutes: 'x', perDay: 3.4 }, playOverrides: { a: true, b: 1 } })
    expect(odd.playMax).toBe(120)
    expect(odd.coinExtend).toEqual({ cost: 1, minutes: 10, perDay: 3 })
    expect(odd.playOverrides).toEqual({ a: true })
  })
})
