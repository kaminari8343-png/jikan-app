// アプリの中の ひらがな入力（iPadの ホーム画面アプリで キーボードが 出ないときの 代わり）。
// 文字の足しかた・けしかたを 純粋な関数に している（テストしやすいように）。

export type KanaMode = 'hiragana' | 'katakana'

/** 50音の ならび（5れつ）。空きは null */
export const KANA_ROWS: (string | null)[][] = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', null, 'ゆ', null, 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', null, 'を', null, 'ん'],
]

const HIRA = /[ぁ-ゖ]/g
const KATA = /[ァ-ヶ]/g
const IS_KATA = /^[ァ-ヶ]$/

export const toKata = (s: string): string => s.replace(HIRA, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
export const toHira = (s: string): string => s.replace(KATA, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

const isKata = (c: string) => IS_KATA.test(c)

/** ひらがなで あつかって、もとが カタカナなら カタカナに もどす */
function viaHira(ch: string, f: (h: string) => string): string {
  const kata = isKata(ch)
  const out = f(kata ? toHira(ch) : ch)
  return kata ? toKata(out) : out
}

const DAKU_FROM = 'かきくけこさしすせそたちつてとはひふへほう'
const DAKU_TO = 'がぎぐげござじずぜぞだぢづでどばびぶべぼゔ'
const HANDAKU_FROM = 'はひふへほ'
const HANDAKU_TO = 'ぱぴぷぺぽ'
const SMALL_FROM = 'あいうえおつやゆよわ'
const SMALL_TO = 'ぁぃぅぇぉっゃゅょゎ'

const swap = (c: string, a: string, b: string): string | null => {
  const i = a.indexOf(c)
  if (i >= 0) return b[i]
  const j = b.indexOf(c)
  return j >= 0 ? a[j] : null
}

/** 「゛」: か⇄が、は⇄ば（ぱ → ば）、う⇄ゔ。つけられない文字は そのまま（null） */
export function dakuten(ch: string): string | null {
  const r = viaHira(ch, (h) => {
    const p = HANDAKU_TO.indexOf(h)
    if (p >= 0) return 'ばびぶべぼ'[p] // ぱ → ば
    return swap(h, DAKU_FROM, DAKU_TO) ?? ''
  })
  return r === '' ? null : r
}

/** 「゜」: は⇄ぱ（ば → ぱ） */
export function handakuten(ch: string): string | null {
  const r = viaHira(ch, (h) => {
    const b = 'ばびぶべぼ'.indexOf(h)
    if (b >= 0) return HANDAKU_TO[b]
    return swap(h, HANDAKU_FROM, HANDAKU_TO) ?? ''
  })
  return r === '' ? null : r
}

/** 「小」: や⇄ゃ、つ⇄っ、あ⇄ぁ… */
export function small(ch: string): string | null {
  const r = viaHira(ch, (h) => swap(h, SMALL_FROM, SMALL_TO) ?? '')
  return r === '' ? null : r
}

const chars = (s: string) => Array.from(s)

export type KanaKey = { type: 'char'; ch: string } | { type: 'daku' } | { type: 'handaku' } | { type: 'small' } | { type: 'back' } | { type: 'clear' }

/** ボタンを おしたあとの 文字列。maxLength（文字数）をこえる ぶんは 足さない */
export function pressKana(value: string, key: KanaKey, mode: KanaMode, maxLength = Infinity): string {
  const list = chars(value)
  switch (key.type) {
    case 'char': {
      if (list.length >= maxLength) return value
      return value + (mode === 'katakana' ? toKata(key.ch) : key.ch)
    }
    case 'back':
      return list.slice(0, -1).join('')
    case 'clear':
      return ''
    default: {
      const last = list[list.length - 1]
      if (last === undefined) return value
      const f = key.type === 'daku' ? dakuten : key.type === 'handaku' ? handakuten : small
      const next = f(last)
      return next === null ? value : [...list.slice(0, -1), next].join('')
    }
  }
}
