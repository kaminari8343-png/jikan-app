import { describe, expect, it } from 'vitest'
import { formatClock, formatMinutes, funSuffix, minutesToKana } from './time'
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
    [60, 'ろくじゅっぷん'],
    [100, 'ひゃっぷん'],
    [120, 'ひゃくにじゅっぷん'],
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
