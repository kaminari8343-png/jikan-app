import { describe, expect, it } from 'vitest'
import { CHARACTERS, CHARACTER_IDS, PHRASE_KEYS, SAMPLE, getCharacter, phrases, type Character, type PhraseKey } from './phrases'
import { say, toKatakana } from './phrases.logic'

const byId = (id: string) => getCharacter(id)
const onee = byId('onee')
const onii = byId('onii')
const robot = byId('robot')
const ninja = byId('ninja')
const neko = byId('neko')

/** どのセリフにも、あるはずの「穴うめ」 */
const REQUIRED: Record<PhraseKey, string[]> = {
  start: ['{name}', '{min}'],
  half: ['{min}'],
  remaining5: ['{min}'],
  remaining1: ['{min}'],
  end: ['{name}'],
  ask: ['{name}'],
  rateGood: [],
  rateBad: [],
  next: ['{next}'],
  allDone: [],
  fixedStart: ['{time}', '{fixed}'],
  fixedSoon: ['{min}', '{fixed}'],
  leaveSoon: ['{min}', '{fixed}'],
  leaveNow: [],
  freeStart: ['{min}', '{fixed}'],
  timeoutNote: [],
  cannotExtend: ['{fixed}'],
  endOfDay: [],
  extended: ['{min}'],
  early: ['{min}'],
  coinGet: ['{count}'],
  newRecord: [],
  tryFaster: [],
  coinExtended: ['{min}'],
  coinShort: ['{count}'],
  extendLimit: [],
}

const FULL = { name: SAMPLE.name, next: SAMPLE.next, fixed: SAMPLE.fixed, clock: SAMPLE.clock, minutes: SAMPLE.minutes, count: 3 }

describe('キャラクター一覧', () => {
  it('5人: おねえさん・おにいさん・ロボット・にんじゃ・ねこ', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual(['onee', 'onii', 'robot', 'ninja', 'neko'])
    expect([...CHARACTER_IDS]).toEqual(CHARACTERS.map((c) => c.id))
    expect(CHARACTERS.map((c) => c.name)).toEqual(['やさしい おねえさん', 'げんきな おにいさん', 'ロボット', 'にんじゃ', 'ねこ'])
    for (const c of CHARACTERS) {
      expect(c.emoji.length, c.id).toBeGreaterThan(0)
      expect(c.blurb.length, c.id).toBeGreaterThan(0)
    }
  })
  it('getCharacter: 知らない id は おねえさん', () => {
    expect(getCharacter('nope').id).toBe('onee')
    expect(getCharacter(undefined).id).toBe('onee')
  })
})

describe.each(CHARACTERS.map((c) => [c.id, c] as const))('セリフ: %s', (_id, ch: Character) => {
  it('ぜんぶの種類のセリフが そろっている（開始・経過・のこり・終了・ふりかえり・つぎは・じこくカード・いってらっしゃい…）', () => {
    expect(Object.keys(ch.phrases).sort()).toEqual([...PHRASE_KEYS].sort())
    for (const k of PHRASE_KEYS) expect(ch.phrases[k].trim().length, k).toBeGreaterThan(0)
  })
  it('穴うめ（{name} {min} {next} {fixed} {time}）が、あるべきところに ある', () => {
    for (const k of PHRASE_KEYS) for (const hole of REQUIRED[k]) expect(ch.phrases[k], `${k} に ${hole}`).toContain(hole)
  })
  it('穴うめしたあとは { } が のこらず、からっぽにもならない', () => {
    for (const k of PHRASE_KEYS) {
      const s = say(k, FULL, ch)
      expect(s, k).not.toMatch(/[{}]/)
      expect(s.trim().length, k).toBeGreaterThan(0)
    }
  })
  it('声・高さ・速さをもっている', () => {
    expect(['female', 'male']).toContain(ch.voice.gender)
    expect(ch.pitch).toBeGreaterThan(0)
    expect(ch.pitch).toBeLessThanOrEqual(2)
    expect(ch.rate).toBeGreaterThanOrEqual(0.5)
  })
})

describe('やさしい おねえさん（いまの声とセリフ）', () => {
  it('セリフは これまでと同じ', () => {
    expect(say('start', FULL, onee)).toBe('しゅくだい、はじまるよー！じゅうごふんだよ')
    expect(say('end', FULL, onee)).toBe('しゅくだい、おわり！よくがんばったね')
    expect(say('next', FULL, onee)).toBe('つぎは おやつ だね')
    expect(say('rateGood', {}, onee)).toBe('まるだね！')
    expect(say('rateBad', {}, onee)).toBe('ばつだったね。つぎがんばろう')
    expect(say('leaveNow', {}, onee)).toBe('いってらっしゃい！')
    expect(say('allDone', {}, onee)).toBe('きょうのよてい ぜんぶおわったよ！すごいね！')
    // キャラを わたさないときも おねえさん
    expect(say('start', FULL)).toBe(say('start', FULL, onee))
    expect(phrases).toBe(onee.phrases)
  })
  it('声は 女性、高さ 1.2・速さ 0.9（いままでの値）', () => {
    expect(onee.voice.gender).toBe('female')
    expect(onee.pitch).toBe(1.2)
    expect(onee.rate).toBe(0.9)
  })
})

describe('げんきな おにいさん', () => {
  it('「よーし！しゅくだい いくぞー！」', () => {
    expect(say('start', FULL, onii)).toBe('よーし！しゅくだい いくぞー！じゅうごふんだ！')
  })
  it('男性の声で、元気（高め）で 少し速め', () => {
    expect(onii.voice.gender).toBe('male')
    expect(onii.rate).toBeGreaterThan(onee.rate)
    expect(onii.rate).toBeGreaterThan(1)
    expect(onii.pitch).toBeGreaterThanOrEqual(1)
  })
  it('時刻・でかけるのセリフ', () => {
    expect(say('fixedStart', FULL, onii)).toBe('ろくじ さんじゅっぷんだ！ゆうごはんの じかんだぞー！')
    expect(say('leaveSoon', { fixed: 'いえをでる', minutes: 5 }, onii)).toBe('あとごふんで いえをでるぞー！')
  })
})

describe('ロボット', () => {
  it('「シュクダイ ヲ カイシ シマス。ピピッ」（カタカナっぽい言い回し）', () => {
    expect(say('start', FULL, robot)).toBe('シュクダイ ヲ カイシ シマス。ジュウゴフン デス。ピピッ')
    expect(say('fixedStart', FULL, robot)).toBe('ロクジ サンジュップン デス。ユウゴハン ノ ジカン デス。ピピッ')
  })
  it('しゃべる文は ぜんぶカタカナ（ひらがなが まざらない）。どれも「ピピッ」で おわる', () => {
    for (const k of PHRASE_KEYS) {
      const s = say(k, FULL, robot)
      expect(s, k).not.toMatch(/[ぁ-ゖ]/)
      expect(s.endsWith('ピピッ'), k).toBe(true)
    }
  })
  it('低めで ゆっくり', () => {
    expect(robot.pitch).toBeLessThan(0.8)
    expect(robot.rate).toBeLessThan(0.9)
    expect(robot.kana).toBe('katakana')
  })
})

describe('にんじゃ', () => {
  it('語尾は「〜でござる」「ニンニン」', () => {
    expect(say('start', FULL, ninja)).toBe('しゅくだい、はじめるでござる！じゅうごふんでござるぞ。ニンニン！')
    for (const k of PHRASE_KEYS) {
      const s = say(k, FULL, ninja)
      expect(/ござる|ニンニン/.test(s), `${k}: ${s}`).toBe(true)
    }
    expect(PHRASE_KEYS.filter((k) => say(k, FULL, ninja).includes('ニンニン')).length).toBeGreaterThanOrEqual(8)
  })
})

describe('ねこ', () => {
  it('語尾は「〜にゃ」。どのセリフも「にゃ」をふくむ', () => {
    expect(say('start', FULL, neko)).toBe('しゅくだい、はじまるにゃ！じゅうごふんだにゃ！')
    for (const k of PHRASE_KEYS) expect(say(k, FULL, neko), k).toContain('にゃ')
  })
  it('高めの声', () => {
    expect(neko.voice.gender).toBe('female')
    expect(neko.pitch).toBeGreaterThan(onee.pitch)
    expect(neko.pitch).toBeGreaterThanOrEqual(1.5)
  })
})

describe('声のわりあて', () => {
  it('同じ性別のキャラは、ちがう slot（声が何種類かあれば、ちがう声になる）', () => {
    for (const g of ['female', 'male'] as const) {
      const slots = CHARACTERS.filter((c) => c.voice.gender === g).map((c) => c.voice.slot)
      expect(new Set(slots).size, g).toBe(slots.length)
    }
  })
})

describe('toKatakana', () => {
  it('ひらがなだけを カタカナにする（記号・漢字・英数字・ー は そのまま）', () => {
    expect(toKatakana('しゅくだい ヲ かいし 15 ー！AB漢字')).toBe('シュクダイ ヲ カイシ 15 ー！AB漢字')
    expect(toKatakana('ゔ')).toBe('ヴ')
  })
})
