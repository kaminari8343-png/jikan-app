import { describe, expect, it } from 'vitest'
import { MORNING_CARDS, PRESET_CARDS } from './cards'
import { CHARACTERS, getCharacter } from './phrases'
import { say } from './phrases.logic'
import { READINGS, readingOf } from './readings'

const NEW_CARDS = [
  { id: 'netflix', name: 'ネットフリックス', emoji: '🎬', yomi: 'ねっとふりっくす' },
  { id: 'unext', name: 'ユーネクスト', emoji: '🍿', yomi: 'ゆーねくすと' },
  { id: 'tv', name: 'テレビ', emoji: '📺', yomi: 'てれび' },
  { id: 'youtube', name: 'ユーチューブ', emoji: '▶️', yomi: 'ゆーちゅーぶ' },
]

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const dist = (a: string, b: string) => Math.hypot(...hex(a).map((v, i) => v - hex(b)[i]))

describe('パレットの みるもの 4まい', () => {
  it('ネットフリックス・ユーネクスト・テレビ・ユーチューブ が、カタカナの名前・絵文字・30ふんで入っている', () => {
    for (const n of NEW_CARDS) {
      const card = PRESET_CARDS.find((c) => c.id === n.id)
      expect(card, n.id).toBeTruthy()
      expect(card).toMatchObject({ name: n.name, emoji: n.emoji, minutes: 30 })
      expect(card!.name).toMatch(/^[゠-ヿ]+$/) // カタカナだけ
      expect(card!.group).toBeUndefined() // ふつうの「やること」の場所
    }
  })

  it('絵文字は ロゴではなく ふつうの絵文字で、4まいとも ちがう', () => {
    const emojis = NEW_CARDS.map((n) => PRESET_CARDS.find((c) => c.id === n.id)!.emoji)
    expect(new Set(emojis).size).toBe(4)
    expect(emojis).toEqual(['🎬', '🍿', '📺', '▶️'])
  })

  it('色は カードごとに ちがい、ほかのカードとも ひと目で 見分けられる', () => {
    const news = NEW_CARDS.map((n) => PRESET_CARDS.find((c) => c.id === n.id)!)
    const others = [...PRESET_CARDS.filter((c) => !NEW_CARDS.some((n) => n.id === c.id)), ...MORNING_CARDS]
    for (const c of news) {
      expect(c.color, c.id).toMatch(/^#[0-9a-f]{6}$/i)
      for (const o of news.filter((x) => x !== c)) expect(dist(c.color, o.color), `${c.id} と ${o.id}`).toBeGreaterThan(60)
      for (const o of others) expect(dist(c.color, o.color), `${c.id} と ${o.id}`).toBeGreaterThan(40)
    }
  })

  it('パレットの カードの id は かさならない。ほかのカードは そのまま', () => {
    const all = [...PRESET_CARDS, ...MORNING_CARDS]
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length)
    expect(PRESET_CARDS.slice(0, 4).map((c) => c.name)).toEqual(['きゅうけい', 'しゅくだい', 'おやつ', 'ゲーム'])
    expect(PRESET_CARDS.some((c) => c.id === 'prepare')).toBe(true)
  })
})

describe('読み変換（読み上げの読みかた）', () => {
  it('4まいの読みかた', () => {
    for (const n of NEW_CARDS) expect(readingOf(n.name), n.name).toBe(n.yomi)
    expect(READINGS['ネットフリックス']).toBe('ねっとふりっくす')
  })
  it('登録のない名前は そのまま。前後の空白・全角半角・大文字小文字は くべつしない', () => {
    expect(readingOf('しゅくだい')).toBe('しゅくだい')
    expect(readingOf('ゲーム')).toBe('ゲーム')
    expect(readingOf('  テレビ ')).toBe('てれび')
    expect(readingOf('ｔｖ')).toBe('てれび') // 全角の英字
    expect(readingOf('youtube')).toBe('ゆーちゅーぶ')
    expect(readingOf('NETFLIX')).toBe('ねっとふりっくす')
    expect(readingOf('u-next')).toBe('ゆーねくすと')
    expect(readingOf('')).toBe('')
  })
  it('ぜんぶの読みかたは ひらがなだけ（（ー）ものばす棒 は OK）', () => {
    for (const yomi of Object.values(READINGS)) expect(yomi).toMatch(/^[ぁ-ゖー]+$/)
  })

  it('セリフでは 読みかたで話す（やさしい おねえさん）', () => {
    const onee = getCharacter('onee')
    expect(say('start', { name: 'ネットフリックス', minutes: 30 }, onee)).toBe('ねっとふりっくす、はじまるよー！さんじゅっぷんだよ')
    expect(say('start', { name: 'ユーネクスト', minutes: 30 }, onee)).toBe('ゆーねくすと、はじまるよー！さんじゅっぷんだよ')
    expect(say('start', { name: 'テレビ', minutes: 30 }, onee)).toBe('てれび、はじまるよー！さんじゅっぷんだよ')
    expect(say('start', { name: 'ユーチューブ', minutes: 30 }, onee)).toBe('ゆーちゅーぶ、はじまるよー！さんじゅっぷんだよ')
    expect(say('end', { name: 'テレビ' }, onee)).toBe('てれび、おわり！よくがんばったね')
    expect(say('ask', { name: 'ユーチューブ' }, onee)).toBe('ゆーちゅーぶ、どうだった？じぶんでつけてみよう')
    expect(say('next', { next: 'ネットフリックス' }, onee)).toBe('つぎは ねっとふりっくす だね')
  })

  it('どのキャラでも、4まいの名前が 読みかたで話される（カタカナの名前のまま 話さない）', () => {
    for (const ch of CHARACTERS) {
      for (const n of NEW_CARDS) {
        const start = say('start', { name: n.name, minutes: 30 }, ch)
        const next = say('next', { next: n.name }, ch)
        const expected = ch.kana === 'katakana' ? n.name : n.yomi // ロボットは しゃべる文ぜんぶが カタカナ
        expect(start, `${ch.id} ${n.name}`).toContain(expected)
        expect(next, `${ch.id} ${n.name}`).toContain(expected)
        if (ch.kana === 'hiragana') expect(start, `${ch.id} ${n.name}`).not.toContain(n.name) // カタカナのまま話さない
      }
    }
  })

  it('じこくカードの名前（{fixed}）にも 読みかたを つかう', () => {
    expect(say('fixedStart', { fixed: 'テレビ', clock: 19 * 60 }, getCharacter('onee'))).toBe('しちじだよ。てれびの じかんだよ')
  })
})
