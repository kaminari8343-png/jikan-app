import type { CardDef, FixedCard } from './types'

export const PRESET_CARDS: CardDef[] = [
  { id: 'rest', name: 'きゅうけい', emoji: '🛋️', color: '#8fd3b6', minutes: 10 },
  { id: 'homework', name: 'しゅくだい', emoji: '✏️', color: '#ffb84d', minutes: 15 },
  { id: 'snack', name: 'おやつ', emoji: '🍪', color: '#ff9eb5', minutes: 10 },
  { id: 'game', name: 'ゲーム', emoji: '🎮', color: '#8ab4ff', minutes: 20 },
  { id: 'prepare', name: 'あしたのじゅんび', emoji: '🎒', color: '#c4a1ff', minutes: 10 },
]

export const CARD_COLORS = ['#ff8a80', '#ffb84d', '#ffd84d', '#8fd3b6', '#8ab4ff', '#c4a1ff', '#ff9eb5', '#b0bec5']

export const CARD_EMOJIS = [
  '📚', '🎨', '🎹', '🧩', '🚿', '🛁', '🍚', '🧸',
  '⚽', '🚲', '📖', '🧹', '🐶', '🌱', '🎵', '😴',
]

export const MIN_MINUTES = 1
export const MAX_MINUTES = 120

/** はじめから入っている じこくカード（親が設定画面で、ふやしたり直したりできる） */
export const DEFAULT_FIXED_CARDS: FixedCard[] = [
  { id: 'dinner', name: 'ゆうごはん', emoji: '🍚', color: '#f4a259', startMin: 18 * 60 + 30, minutes: 30 },
  { id: 'bath', name: 'おふろ', emoji: '🛁', color: '#5bc0eb', startMin: 19 * 60 + 30, minutes: 30 },
  { id: 'bed', name: 'ねる', emoji: '😴', color: '#8d7be0', startMin: 21 * 60, minutes: 0 },
]
