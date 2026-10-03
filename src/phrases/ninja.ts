import type { Character } from './types'

/** にんじゃ（語尾は「〜でござる」「ニンニン」）。穴うめの使いかたは onee.ts を見てね */
export const ninja: Character = {
  id: 'ninja',
  name: 'にんじゃ',
  emoji: '🥷',
  blurb: 'ニンニン！ござるで おしえるでござる',
  voice: { gender: 'male', slot: 2 },
  pitch: 0.85,
  rate: 1.0,
  kana: 'hiragana',
  phrases: {
    start: '{name}、はじめるでござる！{min}でござるぞ。ニンニン！',
    half: 'はんぶん すぎたでござる。あと{min}でござる。ニンニン',
    remaining5: 'あと{min}でござる。いそぐでござる！',
    remaining1: 'あと{min}でござる！ラストでござる！ニンニン！',
    end: '{name}、おわったでござる！おぬし、やるでござるな！',
    ask: '{name}、どうだったでござるか？じぶんで つけるでござる！',
    rateGood: 'まる、おみごとでござる！ニンニン！',
    rateBad: 'ばつでござるか。つぎは がんばるでござるよ。ニンニン',
    next: 'つぎは {next} でござる！ニンニン！',
    allDone: 'きょうの よてい ぜんぶ おわったでござる！みごとでござる！ニンニン！',
    fixedStart: '{time}でござる。{fixed}の じかんでござる！ニンニン',
    fixedSoon: 'あと{min}で {fixed}でござる。じゅんびするでござる！',
    leaveSoon: 'あと{min}で {fixed}でござる！ニンニン',
    leaveNow: 'いってらっしゃいでござる！ニンニン！',
    freeStart: 'じゆうじかんでござる。{fixed}まで あと{min}でござる。ニンニン',
    timeoutNote: 'のこりの カードは じかんぎれでござる。ざんねんでござる',
    cannotExtend: '{fixed}の じかんが あるから、のばせないでござる',
    endOfDay: 'きょうも おつかれでござる。おやすみでござる。ニンニン',
    extended: '{min}、のばしたでござる。ニンニン',
  },
}
