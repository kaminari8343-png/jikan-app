import type { Character } from './types'

/**
 * やさしい おねえさん
 * しゃべるセリフは、このファイルを書きかえるだけで かわります。
 *
 * つかえる「穴うめ」:
 *   {name}  … カードの名前（例: しゅくだい）
 *   {min}   … かかる分（例: じゅうごふん）  ※読み間違いがないよう、かなで読み上げます
 *   {next}  … つぎのカードの名前
 *   {fixed} … じこくカードの名前（例: ゆうごはん）
 *   {time}  … じこくカードの時刻の読み（例: ろくじ さんじゅっぷん）
 *
 * 設定画面の「ためしにきく」「テストさいせい」で、読み間違いがないか聞いて たしかめられます。
 */
export const onee: Character = {
  id: 'onee',
  name: 'やさしい おねえさん',
  emoji: '👩',
  blurb: 'やさしく おはなしするよ',
  voice: { gender: 'female', slot: 0 },
  pitch: 1.2,
  rate: 0.9,
  kana: 'hiragana',
  phrases: {
    start: '{name}、はじまるよー！{min}だよ',
    half: 'はんぶんたったよ。あと{min}だよ',
    remaining5: 'あと{min}だよ',
    remaining1: 'あと{min}だよ',
    end: '{name}、おわり！よくがんばったね',
    ask: '{name}、どうだった？じぶんでつけてみよう',
    // ⭕️❌は絵文字だと読み間違えやすいので、ひらがなで書く
    rateGood: 'まるだね！',
    rateBad: 'ばつだったね。つぎがんばろう',
    next: 'つぎは {next} だね',
    allDone: 'きょうのよてい ぜんぶおわったよ！すごいね！',
    fixedStart: '{time}だよ。{fixed}の じかんだよ',
    fixedSoon: 'あと{min}で {fixed}だよ',
    // {fixed} は カードの名前（いえをでる）
    leaveSoon: 'あと{min}で {fixed}よ',
    leaveNow: 'いってらっしゃい！',
    freeStart: 'じゆうじかんだよ。{fixed}まで あと{min}だよ',
    timeoutNote: 'のこりの カードは じかんぎれだったよ',
    cannotExtend: '{fixed}の じかんが あるから、のばせないよ',
    endOfDay: 'おつかれさま。おやすみなさい',
    extended: '{min}、のばしたよ',
    early: '{min} はやかった！すごい！',
    coinGet: 'コインを {count} もらったよ',
    newRecord: 'しんきろく！すごいね！',
    tryFaster: 'つぎは はやく ちゃんと できるかな？',
    coinExtended: '{min} のびたよ！',
    coinShort: 'あと{count} たりないよ',
    extendLimit: 'きょうは もう のばせないよ',
  },
}
