import type { Cue } from './runner'
import { say } from './phrases.logic'
import { activeCharacter, speak, stopSpeaking } from './speech'

/** runner が返した「話すセリフ」を、えらんだキャラの声とセリフで、順番に話す */
export function speakCues(cues: Cue[], opts: { interrupt?: boolean } = {}) {
  if (opts.interrupt) stopSpeaking()
  const ch = activeCharacter()
  for (const c of cues) speak(say(c.key, c.vars, ch), ch)
}
