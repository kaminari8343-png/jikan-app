import { phrases, type PhraseKey } from './phrases'
import { minutesToKana } from './time'

export interface PhraseVars {
  name?: string
  next?: string
  minutes?: number
}

/** セリフの穴うめ。{min} は分をかなの読みに直して入れる */
export function say(key: PhraseKey, vars: PhraseVars = {}): string {
  return phrases[key]
    .replaceAll('{name}', vars.name ?? '')
    .replaceAll('{next}', vars.next ?? '')
    .replaceAll('{min}', vars.minutes != null ? minutesToKana(vars.minutes) : '')
}
