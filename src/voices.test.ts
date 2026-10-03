import { describe, expect, it } from 'vitest'
import { getCharacter } from './phrases'
import { FEMALE_SUBSTITUTE_PITCH, MALE_SUBSTITUTE_PITCH, chooseVoice, guessGender, utteranceParams, type VoiceLike } from './voices'

const v = (name: string, lang = 'ja-JP'): VoiceLike => ({ name, lang, voiceURI: `uri:${name}` })
const spec = (id: string) => getCharacter(id).voice

describe('声の性別のあて（名前から）', () => {
  it.each([
    ['Kyoko', 'female'],
    ['O-Ren', 'female'],
    ['Microsoft Haruka', 'female'],
    ['Microsoft Nanami Online (Natural)', 'female'],
    ['Google 日本語', 'female'],
    ['Flo (日本語（日本）)', 'female'],
    ['Female Voice', 'female'],
    ['Otoya', 'male'],
    ['Hattori', 'male'],
    ['Microsoft Ichiro', 'male'],
    ['Microsoft Keita Online (Natural)', 'male'],
    ['Eddy (日本語（日本）)', 'male'],
    ['Male Voice', 'male'],
    ['ja-jp-x-jab-local', 'unknown'],
    ['Japanese', 'unknown'],
  ])('%s → %s', (name, g) => expect(guessGender(name)).toBe(g))
})

describe('キャラの声をえらぶ', () => {
  it('女性・男性の声が ひとつずつ: おねえさん/ねこ=女性、おにいさん/ロボット/にんじゃ=男性', () => {
    const voices = [v('Kyoko'), v('Otoya')]
    expect(chooseVoice(voices, spec('onee')).voice?.name).toBe('Kyoko')
    expect(chooseVoice(voices, spec('neko')).voice?.name).toBe('Kyoko')
    for (const id of ['onii', 'robot', 'ninja']) {
      const p = chooseVoice(voices, spec(id))
      expect(p.voice?.name, id).toBe('Otoya')
      expect(p.pitchFactor).toBe(1)
      expect(p.substituted).toBe(false)
    }
  })

  it('同じ性別の声が何種類かあれば、キャラごとに ちがう声になる', () => {
    const voices = [v('Eddy (日本語（日本）)'), v('Kyoko'), v('Hattori'), v('Otoya'), v('O-Ren')]
    const name = (id: string) => chooseVoice(voices, spec(id)).voice?.name
    expect(name('onee')).toBe('Kyoko')
    expect(name('neko')).toBe('O-Ren')
    expect(name('onii')).toBe('Otoya')
    expect(name('robot')).toBe('Hattori')
    expect(name('ninja')).toBe('Eddy (日本語（日本）)')
  })

  it('端末に男性の声がないとき: 女性の声の高さを下げて代用する', () => {
    const p = chooseVoice([v('Kyoko'), v('O-Ren')], spec('onii'))
    expect(p.voice?.name).toBe('Kyoko')
    expect(p.substituted).toBe(true)
    expect(p.pitchFactor).toBe(MALE_SUBSTITUTE_PITCH)
    expect(p.pitchFactor).toBeLessThan(1)
    // 代用でも、キャラごとに ちがう女性の声
    expect(chooseVoice([v('Kyoko'), v('O-Ren')], spec('robot')).voice?.name).toBe('O-Ren')
  })

  it('性別が分からない声しかないときも、男性キャラは 高さを下げて つかう。女性キャラは そのまま', () => {
    const voices = [v('ja-jp-x-jab-local')]
    const male = chooseVoice(voices, spec('onii'))
    expect(male.voice?.name).toBe('ja-jp-x-jab-local')
    expect(male.pitchFactor).toBe(MALE_SUBSTITUTE_PITCH)
    const female = chooseVoice(voices, spec('onee'))
    expect(female.voice?.name).toBe('ja-jp-x-jab-local')
    expect(female.pitchFactor).toBe(1)
  })

  it('女性の声がなく、男性の声しかないとき: 女性キャラは 男性の声の高さを上げて代用', () => {
    const p = chooseVoice([v('Otoya')], spec('neko'))
    expect(p.voice?.name).toBe('Otoya')
    expect(p.pitchFactor).toBe(FEMALE_SUBSTITUTE_PITCH)
    expect(p.substituted).toBe(true)
  })

  it('親が えらんだ声（名前 または voiceURI）が あれば、それを つかう。なければ じどう', () => {
    const voices = [v('Kyoko'), v('Otoya'), v('O-Ren')]
    expect(chooseVoice(voices, spec('onii'), 'O-Ren')).toMatchObject({ pitchFactor: 1, substituted: false })
    expect(chooseVoice(voices, spec('onii'), 'O-Ren').voice?.name).toBe('O-Ren')
    expect(chooseVoice(voices, spec('onii'), 'uri:Kyoko').voice?.name).toBe('Kyoko')
    expect(chooseVoice(voices, spec('onii'), 'ない声').voice?.name).toBe('Otoya')
  })

  it('日本語いがいの声は つかわない。声がなければ null', () => {
    expect(chooseVoice([v('Samantha', 'en-US'), v('Daniel', 'en-GB')], spec('onee')).voice).toBeNull()
    expect(chooseVoice([], spec('onee')).voice).toBeNull()
    expect(chooseVoice([v('Samantha', 'en-US'), v('Kyoko', 'ja_JP')], spec('onee')).voice?.name).toBe('Kyoko')
  })
})

describe('しゃべるときの 高さ・速さ', () => {
  const onii = getCharacter('onii')
  const robot = getCharacter('robot')
  const neko = getCharacter('neko')
  const same = { pitchFactor: 1 }

  it('ふつうは キャラの値そのまま', () => {
    expect(utteranceParams(onii, undefined, same)).toEqual({ pitch: onii.pitch, rate: onii.rate })
    expect(utteranceParams(robot, {}, same)).toEqual({ pitch: robot.pitch, rate: robot.rate })
  })
  it('男性の声を女性の声で代用すると、高さが下がる', () => {
    const sub = { pitchFactor: MALE_SUBSTITUTE_PITCH }
    expect(utteranceParams(onii, undefined, sub).pitch).toBeCloseTo(onii.pitch * 0.7)
    expect(utteranceParams(onii, undefined, sub).pitch).toBeLessThan(onii.pitch)
    expect(utteranceParams(robot, undefined, sub).pitch).toBeLessThan(robot.pitch)
  })
  it('親の調整（高さ・速さ）が あれば、そちらが先', () => {
    expect(utteranceParams(onii, { pitch: 0.9, rate: 1.5 }, same)).toEqual({ pitch: 0.9, rate: 1.5 })
  })
  it('範囲をこえない（高さ 0.1〜2、速さ 0.5〜2）', () => {
    expect(utteranceParams(neko, undefined, { pitchFactor: FEMALE_SUBSTITUTE_PITCH }).pitch).toBe(2)
    expect(utteranceParams(robot, { pitch: 0, rate: 0.1 }, same)).toEqual({ pitch: 0.1, rate: 0.5 })
    expect(utteranceParams(onii, { rate: 9 }, same).rate).toBe(2)
  })
})
