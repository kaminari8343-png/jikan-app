// 端末の日本語の声から、キャラに合う声をえらぶ（純粋な関数。テストしやすいよう Web Speech API に依存しない）
import type { Character } from './phrases'

export interface VoiceLike {
  name: string
  lang: string
  voiceURI?: string
}

export type Gender = 'female' | 'male' | 'unknown'

/** 声の名前から性別をあてる（Web Speech API には 性別の情報が無いので、有名な声の名前で見分ける）。さきに書いたものほど「よい声」 */
const FEMALE_HINTS = ['kyoko', 'o-ren', 'oren', 'nanami', 'haruka', 'ayumi', 'sayaka', 'mizuki', 'google 日本語', 'google japanese', 'flo', 'sandy', 'shelley', 'grandma']
const MALE_HINTS = ['otoya', 'hattori', 'ichiro', 'keita', 'takumi', 'eddy', 'reed', 'rocko', 'grandpa']

const rank = (name: string, hints: string[]) => {
  const n = name.toLowerCase()
  const i = hints.findIndex((h) => n.includes(h))
  return i < 0 ? Infinity : i
}

export function guessGender(name: string): Gender {
  // 名前に「Female」「Male」と書いてあれば それ（'female' には 'male' がふくまれるので、単語としてしらべる）
  if (/\bfemale\b/i.test(name)) return 'female'
  if (/\bmale\b/i.test(name)) return 'male'
  const f = rank(name, FEMALE_HINTS)
  const m = rank(name, MALE_HINTS)
  if (f !== Infinity && (m === Infinity || f <= m)) return 'female'
  if (m !== Infinity) return 'male'
  return 'unknown'
}

export const isJapanese = (v: VoiceLike) => v.lang.toLowerCase().replace('_', '-').startsWith('ja')

/** 声の高さを変えて代用するときの 倍率 */
export const MALE_SUBSTITUTE_PITCH = 0.7
export const FEMALE_SUBSTITUTE_PITCH = 1.3

export interface VoicePick<V> {
  voice: V | null
  /** 代用の声のとき 高さにかける倍率（ふつうは 1） */
  pitchFactor: number
  /** 性別がちがう声で代用しているか */
  substituted: boolean
}

const byRank = <V extends VoiceLike>(list: V[], hints: string[]) =>
  list.map((v, i) => ({ v, r: rank(v.name, hints), i })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.v)

/**
 * キャラの声をえらぶ。
 * 1. override（親が設定画面でえらんだ声）があって、端末にあれば それ
 * 2. 同じ性別の声（slot で、キャラごとに ちがう声に ずらす）
 * 3. 男性の声がないとき → 女性（または性別不明）の声を、高さを下げて代用
 *    女性の声がないとき → 性別不明の声、それもなければ男性の声の高さを上げて代用
 */
export function chooseVoice<V extends VoiceLike>(voices: V[], spec: Character['voice'], override?: string): VoicePick<V> {
  const ja = voices.filter(isJapanese)
  if (ja.length === 0) return { voice: null, pitchFactor: 1, substituted: false }

  if (override) {
    const v = ja.find((x) => x.name === override || x.voiceURI === override)
    if (v) return { voice: v, pitchFactor: 1, substituted: false }
  }

  const female = byRank(ja.filter((v) => guessGender(v.name) === 'female'), FEMALE_HINTS)
  const male = byRank(ja.filter((v) => guessGender(v.name) === 'male'), MALE_HINTS)
  const unknown = ja.filter((v) => guessGender(v.name) === 'unknown')
  const at = (list: V[]) => list[spec.slot % list.length]

  if (spec.gender === 'male') {
    if (male.length) return { voice: at(male), pitchFactor: 1, substituted: false }
    const pool = [...female, ...unknown]
    return { voice: at(pool), pitchFactor: MALE_SUBSTITUTE_PITCH, substituted: true }
  }
  if (female.length) return { voice: at(female), pitchFactor: 1, substituted: false }
  if (unknown.length) return { voice: at(unknown), pitchFactor: 1, substituted: false }
  return { voice: at(male), pitchFactor: FEMALE_SUBSTITUTE_PITCH, substituted: true }
}

export interface Tuning {
  rate?: number
  pitch?: number
  voice?: string
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** しゃべるときの 高さ・速さ（親の調整があればそれ、なければキャラの値。代用の声なら高さに倍率） */
export function utteranceParams(ch: Pick<Character, 'pitch' | 'rate'>, tuning: Tuning | undefined, pick: Pick<VoicePick<unknown>, 'pitchFactor'>) {
  return {
    pitch: clamp((tuning?.pitch ?? ch.pitch) * pick.pitchFactor, 0.1, 2),
    rate: clamp(tuning?.rate ?? ch.rate, 0.5, 2),
  }
}
