// セリフ・キャラクターの入り口。
// キャラは「やさしい おねえさん」(onee) をはじめ、ぜんぶで5人。セリフは キャラごとのファイルにあります。
//   onee.ts / onii.ts / robot.ts / ninja.ts / neko.ts
// あたらしいキャラを足すときは、新しいファイルを作って、types.ts の CHARACTER_IDS と、ここの CHARACTERS に足します。
import { neko } from './neko'
import { ninja } from './ninja'
import { onee } from './onee'
import { onii } from './onii'
import { robot } from './robot'
import type { Character, CharacterId } from './types'

export * from './types'

/** 設定画面にならぶ順 */
export const CHARACTERS: Character[] = [onee, onii, robot, ninja, neko]

export const DEFAULT_CHARACTER_ID: CharacterId = 'onee'

export function getCharacter(id: string | undefined): Character {
  return CHARACTERS.find((c) => c.id === id) ?? onee
}

/** はじめのキャラ（やさしい おねえさん）のセリフ */
export const phrases = onee.phrases

/** 設定画面の「テストさいせい」で使うサンプル値 */
export const SAMPLE = {
  name: 'しゅくだい',
  next: 'おやつ',
  fixed: 'ゆうごはん',
  clock: 18 * 60 + 30,
  minutes: 15,
  halfMinutes: 7,
  five: 5,
  one: 1,
  free: 20,
}
