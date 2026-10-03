// Web Speech API（日本語）。キャラクターごとに、声・高さ・速さをかえて話す

import { dateKey } from './history'
import type { Character } from './phrases'
import { DEFAULT_SETTINGS, resolveCharacter, type Settings } from './voiceSettings'
import { chooseVoice, guessGender, isJapanese, utteranceParams, type Gender } from './voices'

export { DEFAULT_SETTINGS }

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

let settings: Settings = DEFAULT_SETTINGS

export function isSpeechSupported() {
  return supported
}

export function setSpeechSettings(s: Settings) {
  settings = s
}

/** いま話すキャラ（「まいにち かわる」なら、その日のキャラ） */
export function activeCharacter(): Character {
  return resolveCharacter(settings, dateKey(Date.now()))
}

export interface JaVoice {
  name: string
  lang: string
  gender: Gender
}

/** 端末の日本語の声の一覧（声は あとから読み込まれることがある） */
export function listJaVoices(): JaVoice[] {
  if (!supported) return []
  return speechSynthesis
    .getVoices()
    .filter(isJapanese)
    .map((v) => ({ name: v.name, lang: v.lang, gender: guessGender(v.name) }))
}

/** そのキャラの声（のこりは makeUtterance で高さ・速さをきめる）。声の一覧は毎回読む（iOS は あとから増えるため） */
export function voiceFor(ch: Character) {
  const voices = supported ? speechSynthesis.getVoices() : []
  return chooseVoice(voices, ch.voice, settings.tuning[ch.id]?.voice)
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

function makeUtterance(text: string, ch: Character): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  const pick = voiceFor(ch)
  if (pick.voice) u.voice = pick.voice
  const { pitch, rate } = utteranceParams(ch, settings.tuning[ch.id], pick)
  u.pitch = pitch
  u.rate = rate
  u.volume = settings.volume
  return u
}

/** セリフをキューに追加して話す（前のセリフが終わってから話す） */
export function speak(text: string, ch: Character = activeCharacter()) {
  if (!supported || !settings.voiceOn || !text.trim()) return
  speechSynthesis.speak(makeUtterance(text, ch))
}

/** いま話している／待っているセリフをすべて止めて、すぐ話す */
export function speakNow(text: string, ch: Character = activeCharacter()) {
  if (!supported) return
  speechSynthesis.cancel()
  speak(text, ch)
}

/** 設定画面のテスト用。声が OFF でも鳴らす */
export function speakTest(text: string, ch: Character = activeCharacter()) {
  if (!supported) return
  speechSynthesis.cancel()
  speechSynthesis.speak(makeUtterance(text, ch))
}

export function stopSpeaking() {
  if (supported) speechSynthesis.cancel()
}
