import { describe, expect, it } from 'vitest'
import { say } from './phrases.logic'
import { phrases, SAMPLE, type PhraseKey } from './phrases'

// セリフの穴うめ（{name} {min} {next} {fixed} {time}）が、ぜんぶ うまっているか
describe('phrases.ts のセリフ', () => {
  const vars = { name: SAMPLE.name, next: SAMPLE.next, fixed: SAMPLE.fixed, clock: SAMPLE.clock, minutes: SAMPLE.minutes }
  it('どのセリフも、穴うめ後に { } が残らない', () => {
    for (const key of Object.keys(phrases) as PhraseKey[]) {
      expect(say(key, vars), key).not.toMatch(/[{}]/)
      expect(say(key, vars).trim().length, key).toBeGreaterThan(0)
    }
  })
  it('じこくカードのセリフ（時刻の読み・分の読み）', () => {
    expect(say('fixedStart', { fixed: 'ゆうごはん', clock: 18 * 60 + 30 })).toBe('ろくじ さんじゅっぷんだよ。ゆうごはんの じかんだよ')
    expect(say('fixedStart', { fixed: 'おふろ', clock: 19 * 60 })).toBe('しちじだよ。おふろの じかんだよ')
    expect(say('fixedSoon', { fixed: 'ゆうごはん', minutes: 5 })).toBe('あとごふんで ゆうごはんだよ')
    expect(say('freeStart', { fixed: 'ゆうごはん', minutes: 20 })).toBe('じゆうじかんだよ。ゆうごはんまで あとにじゅっぷんだよ')
    expect(say('cannotExtend', { fixed: 'ゆうごはん' })).toBe('ゆうごはんの じかんが あるから、のばせないよ')
  })
})
