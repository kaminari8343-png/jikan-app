// ファンファーレ（Web Audio）。ファイルを使わず、音を その場で つくる。
// iOS は、タップの中で AudioContext を つくって resume しないと 鳴らない → unlockAudio() を タップの中で呼ぶ。
import { soundSettings } from './speech'

type Ctx = AudioContext
let ctx: Ctx | null = null

function getCtx(): Ctx | null {
  if (ctx) return ctx
  const C = (typeof window !== 'undefined' && (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) || null
  if (!C) return null
  try {
    ctx = new C()
  } catch {
    ctx = null
  }
  return ctx
}

/** ボタンをタップしたときに呼ぶ（音を出せるように しておく） */
export function unlockAudio() {
  const c = getCtx()
  if (c && c.state === 'suspended') void c.resume().catch(() => {})
}

/** ファンファーレの音（ドミソ ドーー）: [周波数Hz, はじまり秒, 長さ秒] */
export const FANFARE_NOTES: [number, number, number][] = [
  [523.25, 0, 0.14],
  [523.25, 0.16, 0.14],
  [523.25, 0.32, 0.14],
  [659.25, 0.48, 0.18],
  [783.99, 0.7, 0.2],
  [1046.5, 0.94, 0.7],
]

export function playFanfare() {
  const { on, volume } = soundSettings()
  const c = getCtx()
  if (!on || !c || volume <= 0) return
  unlockAudio()
  const t0 = c.currentTime + 0.02
  for (const [freq, at, len] of FANFARE_NOTES) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const peak = 0.25 * volume
    gain.gain.setValueAtTime(0.0001, t0 + at)
    gain.gain.exponentialRampToValueAtTime(peak, t0 + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len)
    osc.connect(gain).connect(c.destination)
    osc.start(t0 + at)
    osc.stop(t0 + at + len + 0.05)
  }
}
