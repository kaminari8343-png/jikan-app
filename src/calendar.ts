// がっこうの日・やすみの日の判定
// 月〜金 = がっこうの日 / 土日・日本の祝日 = やすみの日。長いお休み（親が登録）と、その日だけの手動切りかえが優先。
// 祝日は、アプリに同梱した @holiday-jp/holiday_jp のデータで判定する（ネット接続は いらない）。
import holiday_jp from '@holiday-jp/holiday_jp'
import type { DayType, Vacation } from './types'
import { dateKey } from './history'

export const DAY_LABEL: Record<DayType, string> = { school: 'がっこうの日', holiday: 'やすみの日' }

export type DayReason = 'manual' | 'vacation' | 'holiday' | 'weekend' | 'weekday'

export interface DayInfo {
  type: DayType
  reason: DayReason
  /** 手動で切りかえていないときの種類 */
  auto: DayType
  /** 画面に出す理由（ひらがな）。例: 「しゅくじつ」「なつやすみ」 */
  note: string
}

const WEEKDAY_NOTE = ['にちようび', 'げつようび', 'かようび', 'すいようび', 'もくようび', 'きんようび', 'どようび']

/** "YYYY-MM-DD" → 曜日（0=にち … 6=ど） */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** 日本の祝日なら、その名前（なければ null） */
export function holidayName(key: string): string | null {
  const table = holiday_jp.holidays as unknown as Record<string, { name: string } | undefined>
  return table[key]?.name ?? null
}

export const isJapaneseHoliday = (key: string) => holidayName(key) !== null

/** 長いお休みの期間に入っていれば、その名前 */
export function vacationOf(key: string, vacations: Vacation[]): Vacation | null {
  // "YYYY-MM-DD" は文字列のまま大小くらべできる
  return vacations.find((v) => v.from <= key && key <= v.to) ?? null
}

/** 手動の切りかえをのぞいた、ふつうの判定 */
function autoInfo(key: string, vacations: Vacation[]): Omit<DayInfo, 'auto'> {
  const vac = vacationOf(key, vacations)
  if (vac) return { type: 'holiday', reason: 'vacation', note: vac.name }
  if (isJapaneseHoliday(key)) return { type: 'holiday', reason: 'holiday', note: 'しゅくじつ' }
  const wd = weekdayOfKey(key)
  if (wd === 0 || wd === 6) return { type: 'holiday', reason: 'weekend', note: WEEKDAY_NOTE[wd] }
  return { type: 'school', reason: 'weekday', note: WEEKDAY_NOTE[wd] }
}

/** その日は がっこうの日？ やすみの日？（overrides = その日だけの手動切りかえ） */
export function dayInfo(key: string, vacations: Vacation[], overrides: Record<string, DayType>): DayInfo {
  const auto = autoInfo(key, vacations)
  const manual = overrides[key]
  if (manual) return { type: manual, reason: 'manual', auto: auto.type, note: 'じぶんで えらんだよ' }
  return { ...auto, auto: auto.type }
}

/** 手動切りかえを まぜた、あたらしい overrides（ふつうの判定と同じになるなら、手動の印は消す） */
export function toggleDayOverride(
  key: string,
  to: DayType,
  vacations: Vacation[],
  overrides: Record<string, DayType>,
): Record<string, DayType> {
  const next = { ...overrides }
  if (autoInfo(key, vacations).type === to) delete next[key]
  else next[key] = to
  return next
}

/** 今日より前の手動切りかえは、いらないので捨てる */
export function pruneOverrides(overrides: Record<string, DayType>, todayKey: string): Record<string, DayType> {
  const keys = Object.keys(overrides)
  const keep = keys.filter((k) => k >= todayKey)
  if (keep.length === keys.length) return overrides
  return Object.fromEntries(keep.map((k) => [k, overrides[k]]))
}

export const todayKeyOf = (ms: number) => dateKey(ms)
