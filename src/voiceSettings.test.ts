import { describe, expect, it } from 'vitest'
import { characterOfDay } from './dailyCharacter'
import { DEFAULT_SETTINGS, normalizeSettings, resolveCharacter } from './voiceSettings'

describe('声の設定', () => {
  it('はじめは やさしい おねえさん・声ON', () => {
    expect(DEFAULT_SETTINGS).toEqual({ voiceOn: true, volume: 1, character: 'onee', tuning: {}, trialOverrides: {} })
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('へん')).toEqual(DEFAULT_SETTINGS)
  })

  it('前のバージョンの設定（はやさ・たかさ）は、おねえさんの調整として引きつぐ', () => {
    const s = normalizeSettings({ voiceOn: false, rate: 1.1, pitch: 1.5, volume: 0.5 })
    expect(s).toEqual({ voiceOn: false, volume: 0.5, character: 'onee', tuning: { onee: { rate: 1.1, pitch: 1.5 } }, trialOverrides: {} })
  })
  it('前の設定が はじめの値（0.9 / 1.2）のままなら、調整なし', () => {
    expect(normalizeSettings({ voiceOn: true, rate: 0.9, pitch: 1.2, volume: 1 })).toEqual(DEFAULT_SETTINGS)
  })
  it('いまの形の設定は そのまま読める。キャラ・調整・ランダムも', () => {
    const saved = { voiceOn: true, volume: 0.8, character: 'ninja', tuning: { ninja: { rate: 1.2, pitch: 0.7, voice: 'Otoya' }, neko: { pitch: 1.9 } }, trialOverrides: { homework: false } }
    expect(normalizeSettings(saved)).toEqual(saved)
    expect(normalizeSettings({ ...saved, character: 'random' }).character).toBe('random')
  })
  it('こわれた値は ふつうの値にもどす', () => {
    const s = normalizeSettings({ character: 'dragon', volume: 9, tuning: { onii: { rate: 'はやい', voice: 3, pitch: 1.1 }, dragon: { rate: 1 }, robot: 'x' } })
    expect(s.character).toBe('onee')
    expect(s.volume).toBe(1)
    expect(s.tuning).toEqual({ onii: { pitch: 1.1 } })
  })

  it('resolveCharacter: えらんだキャラ。random は その日のキャラ', () => {
    expect(resolveCharacter({ character: 'robot' }, '2026-10-03').id).toBe('robot')
    expect(resolveCharacter({ character: 'random' }, '2026-10-03').id).toBe(characterOfDay('2026-10-03'))
    expect(resolveCharacter({ character: 'random' }, '2026-10-04').id).not.toBe(resolveCharacter({ character: 'random' }, '2026-10-03').id)
  })
})
