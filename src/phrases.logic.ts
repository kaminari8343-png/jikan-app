import { DEFAULT_CHARACTER_ID, getCharacter, type Character, type PhraseKey } from './phrases'
import { readingOf } from './readings'
import { clockToKana, countToKana, minutesToKana } from './time'

export interface PhraseVars {
  name?: string
  next?: string
  minutes?: number
  /** じこくカードの名前 */
  fixed?: string
  /** 時刻（0:00からの分）。{time} になる */
  clock?: number
  /** コインの まいすう。{count} になる */
  count?: number
}

/** ひらがな → カタカナ（ロボット用） */
export function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

/**
 * セリフの穴うめ。{min} は分をかなの読みに直して入れる。カードの名前は、readings.ts に登録した読みかたで話す。
 * character を わたすと、そのキャラのセリフ（ロボットなら カタカナ）で話す。
 */
export function say(key: PhraseKey, vars: PhraseVars = {}, character: Character = getCharacter(DEFAULT_CHARACTER_ID)): string {
  const text = character.phrases[key]
    .replaceAll('{name}', vars.name ? readingOf(vars.name) : '')
    .replaceAll('{next}', vars.next ? readingOf(vars.next) : '')
    .replaceAll('{fixed}', vars.fixed ? readingOf(vars.fixed) : '')
    .replaceAll('{time}', vars.clock != null ? clockToKana(vars.clock) : '')
    .replaceAll('{count}', vars.count != null ? countToKana(vars.count) : '')
    .replaceAll('{min}', vars.minutes != null ? minutesToKana(vars.minutes) : '')
  return character.kana === 'katakana' ? toKatakana(text) : text
}
