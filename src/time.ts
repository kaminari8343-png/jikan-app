// 時刻・分の「よみ」まわりのユーティリティ

const DIGITS = ['ぜろ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう']

/** 0〜999 のかな読み（「さんびゃく」などは分では使わないので 100 未満＋100台まで対応） */
export function numberToKana(n: number): string {
  if (n === 0) return 'ぜろ'
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const ones = n % 10
  let s = ''
  if (hundreds) s += hundreds === 1 ? 'ひゃく' : DIGITS[hundreds] + 'ひゃく'
  if (tens) s += tens === 1 ? 'じゅう' : DIGITS[tens] + 'じゅう'
  if (ones) s += DIGITS[ones]
  return s
}

const HOUR_COUNT = ['', 'いち', 'に', 'さん', 'よ', 'ご', 'ろく', 'なな', 'はち', 'く', 'じゅう']

/** 「じかん」つきの時間の読み。例: 1→いちじかん, 4→よじかん, 12→じゅうにじかん */
function hoursToKana(h: number): string {
  const body = h <= 10 ? HOUR_COUNT[h] : h < 20 ? `じゅう${HOUR_COUNT[h - 10]}` : h === 20 ? 'にじゅう' : `にじゅう${HOUR_COUNT[h - 20]}`
  return `${body}じかん`
}

/**
 * 「ふん／ぷん」つきの分の読み。例: 7→ななふん, 10→じゅっぷん, 15→じゅうごふん
 * 60ぷん以上は「じかん」で読む。例: 60→いちじかん, 90→いちじかん さんじゅっぷん, 206→さんじかん ろくふん
 */
export function minutesToKana(n: number): string {
  if (n >= 60) {
    const h = Math.floor(n / 60)
    const m = n % 60
    return m === 0 ? hoursToKana(h) : `${hoursToKana(h)} ${minutesToKana(m)}`
  }
  const ones = n % 10
  const body = n - ones === 0 ? '' : numberToKana(n - ones)
  switch (ones) {
    case 0:
      // 10, 20 ... は「じゅっぷん」「にじゅっぷん」
      return n === 0 ? 'ぜろふん' : body.replace(/(じゅう|ひゃく)$/, (m) => (m === 'じゅう' ? 'じゅっ' : 'ひゃっ')) + 'ぷん'
    case 1:
      return body + 'いっぷん'
    case 3:
      return body + 'さんぷん'
    case 4:
      return body + 'よんぷん'
    case 6:
      return body + 'ろっぷん'
    case 8:
      return body + 'はっぷん'
    default:
      return body + DIGITS[ones] + 'ふん'
  }
}

/** 画面に出す「ふん／ぷん」。例: 7→ふん, 30→ぷん */
export function funSuffix(n: number): 'ふん' | 'ぷん' {
  return [0, 1, 3, 4, 6, 8].includes(n % 10) ? 'ぷん' : 'ふん'
}

/** 画面用: 15 → "15ふん" */
export function formatMinutes(n: number): string {
  return `${n}${funSuffix(n)}`
}

/** 画面用: 時刻 → "5じ30ぷん" */
export function formatClock(d: Date): string {
  const h = d.getHours() % 12 || 12
  const m = d.getMinutes()
  return m === 0 ? `${h}じ` : `${h}じ${m}${funSuffix(m)}`
}

/** 画面用: ミリ秒 → "12:05" */
export function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const HOUR_KANA = [
  'じゅうにじ', 'いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ', 'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ',
]

/** 時刻（0:00からの分）のかな読み。例: 18:30 → ろくじ さんじゅっぷん */
export function clockToKana(minOfDay: number): string {
  const h = Math.floor(minOfDay / 60) % 12
  const m = minOfDay % 60
  return m === 0 ? HOUR_KANA[h] : `${HOUR_KANA[h]} ${minutesToKana(m)}`
}

/** 画面用: 時刻（0:00からの分）→ "6じ30ぷん" */
export function formatMinOfDay(minOfDay: number): string {
  const h = Math.floor(minOfDay / 60) % 12 || 12
  const m = minOfDay % 60
  return m === 0 ? `${h}じ` : `${h}じ${m}${funSuffix(m)}`
}

/** 画面用: 「ごぜん／ごご」つき。例: 18:30 → ごご6じ30ぷん（じこくカード用。12じかん表示だと朝夕が見分けにくいため） */
export function formatMinOfDayAp(minOfDay: number): string {
  return `${minOfDay % 1440 < 720 ? 'ごぜん' : 'ごご'}${formatMinOfDay(minOfDay)}`
}

export function formatClockAp(d: Date): string {
  return formatMinOfDayAp(d.getHours() * 60 + d.getMinutes())
}

/** 0:00からの分 ←→ "HH:MM"（<input type="time"> 用） */
export const minOfDayToInput = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
export function inputToMinOfDay(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(v)
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  return h < 24 && mm < 60 ? h * 60 + mm : null
}

/** ある時刻（ms）の、その日の 0:00（ms） */
export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** ある時刻（ms）の、0:00からの分（秒は小数） */
export function minuteOfDay(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

/** 画面用: 分のながさ → "20ぷん" / "1じかん30ぷん" */
export function formatSpan(min: number): string {
  if (min < 60) return formatMinutes(min)
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}じかん` : `${h}じかん${formatMinutes(m)}`
}

/** n日あと（マイナスは まえ）の同じ時刻（ms） */
export function addDaysMs(ms: number, n: number): number {
  const d = new Date(ms)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000)
}
