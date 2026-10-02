import type { CardDef, FixedCard } from './types'

export const PRESET_CARDS: CardDef[] = [
  { id: 'rest', name: 'きゅうけい', emoji: '🛋️', color: '#8fd3b6', minutes: 10 },
  { id: 'homework', name: 'しゅくだい', emoji: '✏️', color: '#ffb84d', minutes: 15 },
  { id: 'snack', name: 'おやつ', emoji: '🍪', color: '#ff9eb5', minutes: 10 },
  { id: 'game', name: 'ゲーム', emoji: '🎮', color: '#8ab4ff', minutes: 20 },
  { id: 'prepare', name: 'あしたのじゅんび', emoji: '🎒', color: '#c4a1ff', minutes: 10 },
]

/** あさの カード（がっこうの日の、おきる〜いえをでる のあいだに ならべる） */
export const MORNING_CARDS: CardDef[] = [
  { id: 'dress', name: 'きがえ', emoji: '👕', color: '#8ab4ff', minutes: 10, group: 'morning' },
  { id: 'breakfast-eat', name: 'あさごはん', emoji: '🍞', color: '#ffd166', minutes: 15, group: 'morning' },
  { id: 'brush', name: 'はみがき', emoji: '🪥', color: '#7fdbca', minutes: 5, group: 'morning' },
  { id: 'toilet', name: 'トイレ', emoji: '🚽', color: '#b0bec5', minutes: 5, group: 'morning' },
  { id: 'check-bag', name: 'もちものチェック', emoji: '🎒', color: '#c4a1ff', minutes: 5, group: 'morning' },
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
  { id: 'wake', name: 'おきる', emoji: '⏰', color: '#ffd166', startMin: 6 * 60 + 30, minutes: 0, endOfDay: false },
  { id: 'leave', name: 'いえをでる', emoji: '🚪', color: '#ff8a80', startMin: 7 * 60 + 20, minutes: 0, endOfDay: false, leaving: true },
  { id: 'school', name: 'がっこう', emoji: '🏫', color: '#8ab4ff', startMin: 7 * 60 + 20, minutes: 460, quiet: true },
  { id: 'breakfast', name: 'あさごはん', emoji: '🍞', color: '#f6bd60', startMin: 7 * 60 + 30, minutes: 30, quiet: true },
  { id: 'lunch', name: 'ひるごはん', emoji: '🍱', color: '#84a98c', startMin: 12 * 60, minutes: 30, quiet: true },
  { id: 'dinner', name: 'ゆうごはん', emoji: '🍚', color: '#f4a259', startMin: 18 * 60 + 30, minutes: 30, quiet: true },
  { id: 'bath', name: 'おふろ', emoji: '🛁', color: '#5bc0eb', startMin: 19 * 60 + 30, minutes: 30, quiet: true },
  { id: 'bed', name: 'ねる', emoji: '😴', color: '#8d7be0', startMin: 21 * 60, minutes: 0, endOfDay: true },
]
