import type { Character } from './types'

/**
 * ロボット（低めの声で、ゆっくり）
 * しゃべる文は ぜんぶカタカナに直してから読みます（{name} や {min} の ひらがなも カタカナになります）。
 * 穴うめの使いかたは onee.ts を見てね。
 */
export const robot: Character = {
  id: 'robot',
  name: 'ロボット',
  emoji: '🤖',
  blurb: 'ピピッ！ロボットが おしえるよ',
  voice: { gender: 'male', slot: 1 },
  pitch: 0.5,
  rate: 0.7,
  kana: 'katakana',
  phrases: {
    start: '{name} ヲ カイシ シマス。{min} デス。ピピッ',
    half: 'ケイカ ジカン ハンブン。ノコリ {min}。ピピッ',
    remaining5: 'ノコリ {min}。ピピッ',
    remaining1: 'ノコリ {min}。ケイコク。ピピッ',
    end: '{name} ヲ シュウリョウ シマス。オツカレサマ デシタ。ピピッ',
    ask: '{name} ノ ジコ ヒョウカ ヲ ニュウリョク シテ クダサイ。ピピッ',
    rateGood: 'マル ヲ カクニン。ヨク デキマシタ。ピピッ',
    rateBad: 'バツ ヲ カクニン。ツギ ハ ガンバリマショウ。ピピッ',
    next: 'ツギ ハ {next} デス。ピピッ',
    allDone: 'ホンジツ ノ ヨテイ ヲ スベテ シュウリョウ シマシタ。ミゴト デス。ピピッ',
    fixedStart: '{time} デス。{fixed} ノ ジカン デス。ピピッ',
    fixedSoon: 'ノコリ {min}。{fixed} ノ ジカン デス。ピピッ',
    leaveSoon: 'ノコリ {min}。{fixed} ジュンビ ヲ シテ クダサイ。ピピッ',
    leaveNow: 'イッテ ラッシャイ。ピピッ',
    freeStart: 'ジユウ ジカン デス。{fixed} マデ ノコリ {min}。ピピッ',
    timeoutNote: 'ノコリ ノ カード ハ ジカン ギレ デス。ピピッ',
    cannotExtend: '{fixed} ノ ジカン ガ アル タメ、エンチョウ デキマセン。ピピッ',
    endOfDay: 'ホンジツ ノ カツドウ ヲ シュウリョウ シマス。オヤスミ ナサイ。ピピッ',
    extended: '{min} エンチョウ シマシタ。ピピッ',
    early: '{min} ハヤク シュウリョウ。ピピッ',
    coinGet: 'コイン {count} ヲ カクトク。ピピッ',
    newRecord: 'シン キロク ヲ コウシン。ピピッ',
    tryFaster: 'ツギ ハ ハヤク チャント デキルカナ？ピピッ',
  },
}
