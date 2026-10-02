// Web Speech API（日本語・やさしい話し方）

import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = { voiceOn: true, rate: 0.9, pitch: 1.2, volume: 1 }

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

let settings: Settings = DEFAULT_SETTINGS
let cachedVoice: SpeechSynthesisVoice | null = null

export function isSpeechSupported() {
  return supported
}

export function setSpeechSettings(s: Settings) {
  settings = s
}

/** 日本語の声をえらぶ（やさしい声が見つかればそれを優先） */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!supported) return null
  if (cachedVoice) return cachedVoice
  const ja = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ja'))
  if (ja.length === 0) return null
  const preferred = ['kyoko', 'o-ren', 'hattori', 'google 日本語', 'nanami', 'haruka', 'ayumi']
  cachedVoice =
    preferred.map((p) => ja.find((v) => v.name.toLowerCase().includes(p))).find(Boolean) ?? ja[0]
  return cachedVoice
}

if (supported) {
  // 声の一覧はあとから読み込まれることがある
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoice = null
  })
}

/**
 * iOS はユーザーのタップの中で一度しゃべらせないと、あとから音が出ない。
 * 「スタート」ボタンのタップ内で呼ぶ。
 */
export function unlockSpeech() {
  if (!supported) return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  u.lang = 'ja-JP'
  speechSynthesis.speak(u)
}

function makeUtterance(text: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  const v = pickVoice()
  if (v) u.voice = v
  u.rate = settings.rate
  u.pitch = settings.pitch
  u.volume = settings.volume
  return u
}

/** セリフをキューに追加して話す（前のセリフが終わってから話す） */
export function speak(text: string) {
  if (!supported || !settings.voiceOn || !text.trim()) return
  speechSynthesis.speak(makeUtterance(text))
}

/** いま話している／待っているセリフをすべて止めて、すぐ話す */
export function speakNow(text: string) {
  if (!supported) return
  speechSynthesis.cancel()
  speak(text)
}

/** 設定画面のテスト用。声が OFF でも鳴らす */
export function speakTest(text: string) {
  if (!supported) return
  speechSynthesis.cancel()
  speechSynthesis.speak(makeUtterance(text))
}

export function stopSpeaking() {
  if (supported) speechSynthesis.cancel()
}
