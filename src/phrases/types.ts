/**
 * セリフ・キャラクターの「型」と、セリフの種類（キー）の一覧。
 * 新しいセリフの種類を足すときは、PHRASE_KEYS に足して、ぜんぶのキャラのファイルに書きます
 * （書きわすれると、ビルドのときに エラーでおしえてくれます）。
 */
export const PHRASE_KEYS = [
  'start', // カードがはじまるとき
  'half', // はんぶんたったとき
  'remaining5', // のこり5分
  'remaining1', // のこり1分
  'end', // カードの時間がおわったとき（このあと ask が続く）
  'ask', // ⭕️❌をえらんでもらうとき（スキップのときも）
  'rateGood', // ⭕️をえらんだとき
  'rateBad', // ❌をえらんだとき
  'next', // つぎのカードがあるとき
  'allDone', // ぜんぶおわったとき
  'fixedStart', // じこくカードの時刻になったとき
  'fixedSoon', // じこくカードの5分前
  'leaveSoon', // でかけるカード（いえをでる）の 10・5・1ぷんまえ
  'leaveNow', // でかけるカードの時刻（いってらっしゃい）
  'freeStart', // じゆうじかんがはじまったとき
  'timeoutNote', // じかんぎれのカードがあったとき
  'cannotExtend', // 「+5ふん」が、つぎのじこくカードをこえるとき
  'endOfDay', // 1日のおわり（ねる）
  'extended', // 「+5ふん」をおしたとき
  'early', // タイムトライアル: 予定より はやく おわったとき（{min} はやかった！）
  'coinGet', // ⭕️で コインを もらったとき（{count}まい）
  'newRecord', // じぶんの きろくを こえたとき
  'tryFaster', // タイムトライアルで ❌のとき
  'coinExtended', // コインで のばしたとき（{min} のびたよ！）
  'coinShort', // コインが たりないとき（あと{count}）
  'extendLimit', // コインで のばせる 1日の回数を つかいきったとき
] as const

export type PhraseKey = (typeof PHRASE_KEYS)[number]

/** 1キャラぶんのセリフ。キーは PHRASE_KEYS ぜんぶ */
export type Phrases = Record<PhraseKey, string>

export const CHARACTER_IDS = ['onee', 'onii', 'robot', 'ninja', 'neko'] as const
export type CharacterId = (typeof CHARACTER_IDS)[number]

/** 声のすきずき。端末の日本語の声から、この性別に近いものをえらぶ */
export interface VoiceSpec {
  gender: 'female' | 'male'
  /** 同じ性別の声が何種類かあるとき、キャラごとに ちがう声になるよう ずらす番号 */
  slot: number
}

export interface Character {
  id: CharacterId
  /** 画面に出す名前（ひらがな） */
  name: string
  emoji: string
  /** ボタンに出す ひとこと */
  blurb: string
  voice: VoiceSpec
  /** 高さ（0〜2）。1 がふつう */
  pitch: number
  /** 速さ。1 がふつう */
  rate: number
  /** katakana のキャラは、しゃべる文ぜんぶを カタカナに直す（ロボット用） */
  kana: 'hiragana' | 'katakana'
  phrases: Phrases
}
