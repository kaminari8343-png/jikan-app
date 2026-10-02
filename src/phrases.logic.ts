import { phrases, type PhraseKey } from './phrases'
import { clockToKana, minutesToKana } from './time'

export interface PhraseVars {
  name?: string
  next?: string
  minutes?: number
  /** じこくカードの名前 */
  fixed?: string
  /** 時刻（0:00からの分）。{time} になる */
  clock?: number
}

/** セリフの穴うめ。{min} は分をかなの読みに直して入れる */
export function say(key: PhraseKey, vars: PhraseVars = {}): string {
  return phrases[key]
    .replaceAll('{name}', vars.name ?? '')
    .replaceAll('{next}', vars.next ?? '')
    .replaceAll('{fixed}', vars.fixed ?? '')
    .replaceAll('{time}', vars.clock != null ? clockToKana(vars.clock) : '')
    .replaceAll('{min}', vars.minutes != null ? minutesToKana(vars.minutes) : '')
}
