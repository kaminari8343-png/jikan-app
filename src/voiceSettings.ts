// 声の設定（保存データの形・移行・キャラの決めかた）
import { CHARACTER_IDS, getCharacter, type Character, type CharacterId } from './phrases'
import { characterOfDay } from './dailyCharacter'
import type { Tuning } from './voices'

export type CharacterChoice = CharacterId | 'random'

export interface Settings {
  voiceOn: boolean
  volume: number
  /** えらんだキャラ。random は「まいにち かわる」 */
  character: CharacterChoice
  /** キャラごとの調整（親が設定画面で、声・高さ・速さを かえたとき） */
  tuning: Partial<Record<CharacterId, Tuning>>
  /** タイムトライアルの オン・オフ（カードの id ごと）。ないカードは はじめの設定 */
  trialOverrides: Record<string, boolean>
  /** あそびカードの 指定（カードの id ごと）。ないカードは はじめの設定 */
  playOverrides: Record<string, boolean>
  /** あそびカードの 1まいの さいだい時間（分） */
  playMax: number
  /** コインで のばす: つかう まいすう・のばす分・1日の回数 */
  coinExtend: { cost: number; minutes: number; perDay: number }
}

export const DEFAULT_SETTINGS: Settings = { voiceOn: true, volume: 1, character: 'onee', tuning: {}, trialOverrides: {}, playOverrides: {}, playMax: 30, coinExtend: { cost: 30, minutes: 10, perDay: 2 } }

/** 前のバージョンの設定（はやさ・たかさ が ぜんたいで ひとつ）の、はじめの値 */
const OLD_RATE = 0.9
const OLD_PITCH = 1.2

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return isNum(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback
}

function cleanBoolMap(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (v && typeof v === 'object') for (const [k, b] of Object.entries(v)) if (typeof b === 'boolean') out[k] = b
  return out
}

/** 保存されていた設定を、いまの形にそろえる。前のバージョンの はやさ・たかさ は「やさしい おねえさん」の調整として引きつぐ */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const character: CharacterChoice =
    r.character === 'random' || (CHARACTER_IDS as readonly string[]).includes(r.character as string) ? (r.character as CharacterChoice) : 'onee'

  const ce = (r.coinExtend && typeof r.coinExtend === 'object' ? r.coinExtend : {}) as Record<string, unknown>
  const tuning: Settings['tuning'] = {}
  if (r.tuning && typeof r.tuning === 'object') {
    for (const id of CHARACTER_IDS) {
      const t = (r.tuning as Record<string, unknown>)[id]
      if (!t || typeof t !== 'object') continue
      const { rate, pitch, voice } = t as Record<string, unknown>
      const clean: Tuning = {}
      if (isNum(rate)) clean.rate = rate
      if (isNum(pitch)) clean.pitch = pitch
      if (typeof voice === 'string' && voice) clean.voice = voice
      if (Object.keys(clean).length) tuning[id] = clean
    }
  }
  // 前のバージョンの設定
  if (!tuning.onee && (isNum(r.rate) || isNum(r.pitch))) {
    const rate = isNum(r.rate) ? r.rate : OLD_RATE
    const pitch = isNum(r.pitch) ? r.pitch : OLD_PITCH
    if (rate !== OLD_RATE || pitch !== OLD_PITCH) tuning.onee = { rate, pitch }
  }

  return {
    voiceOn: typeof r.voiceOn === 'boolean' ? r.voiceOn : true,
    volume: isNum(r.volume) ? Math.min(1, Math.max(0, r.volume)) : 1,
    character,
    tuning,
    trialOverrides: cleanBoolMap(r.trialOverrides),
    playOverrides: cleanBoolMap(r.playOverrides),
    playMax: clampInt(r.playMax, 5, 120, 30),
    coinExtend: {
      cost: clampInt(ce.cost, 1, 500, 30),
      minutes: clampInt(ce.minutes, 1, 60, 10),
      perDay: clampInt(ce.perDay, 1, 20, 2),
    },
  }
}

/** いま話すキャラ（random なら、その日のキャラ） */
export function resolveCharacter(s: Pick<Settings, 'character'>, dateKey: string): Character {
  return getCharacter(s.character === 'random' ? characterOfDay(dateKey) : s.character)
}
