import { describe, expect, it } from 'vitest'
import { clockToKana, formatClock, formatClockAp, formatMinOfDayAp, formatMinOfDay, formatMinutes, formatSpan, funSuffix, inputToMinOfDay, minOfDayToInput, minutesToKana } from './time'
import { say } from './phrases.logic'

describe('minutesToKana', () => {
  const cases: [number, string][] = [
    [1, 'いっぷん'],
    [2, 'にふん'],
    [3, 'さんぷん'],
    [4, 'よんぷん'],
    [5, 'ごふん'],
    [6, 'ろっぷん'],
    [7, 'ななふん'],
    [8, 'はっぷん'],
    [9, 'きゅうふん'],
    [10, 'じゅっぷん'],
    [11, 'じゅういっぷん'],
    [15, 'じゅうごふん'],
    [20, 'にじゅっぷん'],
    [30, 'さんじゅっぷん'],
    [45, 'よんじゅうごふん'],
    [59, 'ごじゅうきゅうふん'],
    [60, 'いちじかん'],
    [90, 'いちじかん さんじゅっぷん'],
    [100, 'いちじかん よんじゅっぷん'],
    [120, 'にじかん'],
    [206, 'さんじかん にじゅうろっぷん'],
    [460, 'ななじかん よんじゅっぷん'],
    [600, 'じゅうじかん'],
  ]
  it.each(cases)('%i → %s', (n, kana) => expect(minutesToKana(n)).toBe(kana))
})

describe('表示用', () => {
  it('ふん／ぷん', () => {
    expect(funSuffix(7)).toBe('ふん')
    expect(funSuffix(30)).toBe('ぷん')
    expect(formatMinutes(15)).toBe('15ふん')
  })
  it('時刻', () => {
    expect(formatClock(new Date(2026, 0, 1, 17, 30))).toBe('5じ30ぷん')
    expect(formatClock(new Date(2026, 0, 1, 17, 0))).toBe('5じ')
    expect(formatClock(new Date(2026, 0, 1, 0, 5))).toBe('12じ5ふん')
  })
})

describe('セリフ', () => {
  it('はじまり', () => {
    expect(say('start', { name: 'しゅくだい', minutes: 15 })).toBe('しゅくだい、はじまるよー！じゅうごふんだよ')
  })
  it('つぎは', () => {
    expect(say('next', { next: 'おやつ' })).toBe('つぎは おやつ だね')
  })
})

describe('時刻の読み・表示（じこくカード）', () => {
  it('clockToKana', () => {
    expect(clockToKana(18 * 60 + 30)).toBe('ろくじ さんじゅっぷん')
    expect(clockToKana(19 * 60)).toBe('しちじ')
    expect(clockToKana(0)).toBe('じゅうにじ')
    expect(clockToKana(12 * 60 + 5)).toBe('じゅうにじ ごふん')
    expect(clockToKana(21 * 60 + 15)).toBe('くじ じゅうごふん')
  })
  it('formatMinOfDay / input 変換', () => {
    expect(formatMinOfDay(18 * 60 + 30)).toBe('6じ30ぷん')
    expect(formatMinOfDay(21 * 60)).toBe('9じ')
    expect(minOfDayToInput(18 * 60 + 5)).toBe('18:05')
    expect(inputToMinOfDay('18:05')).toBe(18 * 60 + 5)
    expect(inputToMinOfDay('24:00')).toBeNull()
    expect(inputToMinOfDay('')).toBeNull()
  })
  it('formatSpan', () => {
    expect(formatSpan(20)).toBe('20ぷん')
    expect(formatSpan(60)).toBe('1じかん')
    expect(formatSpan(90)).toBe('1じかん30ぷん')
  })
})

describe('ごぜん／ごご つきの時刻', () => {
  it('formatMinOfDayAp / formatClockAp', () => {
    expect(formatMinOfDayAp(6 * 60 + 30)).toBe('ごぜん6じ30ぷん')
    expect(formatMinOfDayAp(18 * 60 + 30)).toBe('ごご6じ30ぷん')
    expect(formatMinOfDayAp(12 * 60)).toBe('ごご12じ')
    expect(formatMinOfDayAp(0)).toBe('ごぜん12じ')
    expect(formatClockAp(new Date(2026, 9, 2, 15, 0))).toBe('ごご3じ')
  })
})
