import type { Cue } from './runner'
import { say } from './phrases.logic'
import { speak, stopSpeaking } from './speech'

/** runner が返した「話すセリフ」を、順番に話す */
export function speakCues(cues: Cue[], opts: { interrupt?: boolean } = {}) {
  if (opts.interrupt) stopSpeaking()
  for (const c of cues) speak(say(c.key, c.vars))
}
