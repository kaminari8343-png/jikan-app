// おとなの せってい用の 4けたの あんしょうばんごう。
// 「こどもが まちがって ひらかない」ための かんたんな ロックで、きびしい安全対策ではない（保存先は この端末の localStorage）。
import { load, save } from './storage'

const KEY = 'pin'

export interface StoredPin {
  salt: string
  hash: string
}

export const isPinFormat = (s: string) => /^\d{4}$/.test(s)

/** かんたんな ハッシュ（FNV-1a を くりかえす）。暗号ではない */
export function hashPin(pin: string, salt: string): string {
  let h = 0x811c9dc5
  const s = `${salt}:${pin}:${salt}`
  for (let round = 0; round < 1000; round++) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i) + round
      h = Math.imul(h, 0x01000193) >>> 0
    }
  }
  return h.toString(16).padStart(8, '0')
}

export function makePin(pin: string, salt: string = Math.random().toString(36).slice(2)): StoredPin {
  return { salt, hash: hashPin(pin, salt) }
}

export function verifyPin(pin: string, stored: StoredPin | null): boolean {
  return !!stored && isPinFormat(pin) && hashPin(pin, stored.salt) === stored.hash
}

export const loadPin = (): StoredPin | null => {
  const v = load<unknown>(KEY, null)
  const p = v as Partial<StoredPin> | null
  return p && typeof p.salt === 'string' && typeof p.hash === 'string' ? { salt: p.salt, hash: p.hash } : null
}
export const savePin = (p: StoredPin | null) => save(KEY, p)

/** わすれたとき用: おとなが とける けいさん（2けた × 2けた） */
export function makeResetChallenge(rand: () => number = Math.random): { question: string; answer: number } {
  const a = 12 + Math.floor(rand() * 78)
  const b = 12 + Math.floor(rand() * 78)
  return { question: `${a} × ${b}`, answer: a * b }
}

/** まちがえが つづいたとき、しばらく まつ（5かい まちがえたら 60びょう） */
export const MAX_TRIES = 5
export const LOCK_MS = 60_000
