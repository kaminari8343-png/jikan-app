import { describe, expect, it } from 'vitest'
import { dayInfo, holidayName, isJapaneseHoliday, pruneOverrides, toggleDayOverride, vacationOf, weekdayOfKey } from './calendar'
import type { DayType, Vacation } from './types'

const summer: Vacation = { id: 'v1', name: 'なつやすみ', from: '2026-07-21', to: '2026-08-31' }

describe('祝日（ネット接続なしの同梱データ）', () => {
  it('日本の祝日を判定できる', () => {
    expect(isJapaneseHoliday('2026-01-01')).toBe(true)
    expect(holidayName('2026-01-01')).toBe('元日')
    expect(holidayName('2026-10-12')).toBe('スポーツの日')
    expect(isJapaneseHoliday('2026-11-03')).toBe(true)
    expect(isJapaneseHoliday('2027-01-01')).toBe(true)
  })
  it('ふつうの平日は祝日ではない', () => {
    expect(isJapaneseHoliday('2026-10-07')).toBe(false)
    expect(holidayName('2026-10-07')).toBeNull()
  })
  it('振替休日も入っている（2026-05-06 は 憲法記念日の振替休日）', () => {
    expect(isJapaneseHoliday('2026-05-06')).toBe(true)
  })
})

describe('がっこうの日・やすみの日', () => {
  it('曜日', () => {
    expect(weekdayOfKey('2026-10-07')).toBe(3) // 水
    expect(weekdayOfKey('2026-10-10')).toBe(6) // 土
    expect(weekdayOfKey('2026-10-11')).toBe(0) // 日
  })
  it('月〜金は がっこうの日', () => {
    for (const k of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) {
      expect(dayInfo(k, [], {})).toMatchObject({ type: 'school', reason: 'weekday' })
    }
  })
  it('土日は やすみの日', () => {
    expect(dayInfo('2026-10-10', [], {})).toMatchObject({ type: 'holiday', reason: 'weekend', note: 'どようび' })
    expect(dayInfo('2026-10-11', [], {})).toMatchObject({ type: 'holiday', reason: 'weekend', note: 'にちようび' })
  })
  it('日本の祝日（平日にあたる日）は やすみの日', () => {
    expect(dayInfo('2026-10-12', [], {})).toMatchObject({ type: 'holiday', reason: 'holiday', note: 'しゅくじつ' }) // 月曜
    expect(dayInfo('2026-11-03', [], {})).toMatchObject({ type: 'holiday', reason: 'holiday' }) // 火曜
  })
  it('長いお休みの期間（両はしをふくむ）は やすみの日。平日でも', () => {
    expect(vacationOf('2026-07-21', [summer])?.name).toBe('なつやすみ')
    expect(vacationOf('2026-08-31', [summer])?.name).toBe('なつやすみ')
    expect(vacationOf('2026-07-20', [summer])).toBeNull()
    expect(vacationOf('2026-09-01', [summer])).toBeNull()
    expect(dayInfo('2026-08-05', [summer], {})).toMatchObject({ type: 'holiday', reason: 'vacation', note: 'なつやすみ' }) // 水曜
    expect(dayInfo('2026-09-01', [summer], {})).toMatchObject({ type: 'school' })
  })
  it('その日だけの手動切りかえが、いちばん優先', () => {
    const o: Record<string, DayType> = { '2026-10-07': 'holiday', '2026-10-10': 'school', '2026-08-05': 'school' }
    expect(dayInfo('2026-10-07', [], o)).toMatchObject({ type: 'holiday', reason: 'manual', auto: 'school' })
    expect(dayInfo('2026-10-10', [], o)).toMatchObject({ type: 'school', reason: 'manual', auto: 'holiday' })
    expect(dayInfo('2026-08-05', [summer], o)).toMatchObject({ type: 'school', reason: 'manual' })
    expect(dayInfo('2026-10-08', [], o)).toMatchObject({ type: 'school', reason: 'weekday' })
  })
  it('toggleDayOverride: ふつうと同じになれば、手動の印は消える', () => {
    let o = toggleDayOverride('2026-10-07', 'holiday', [], {})
    expect(o).toEqual({ '2026-10-07': 'holiday' })
    o = toggleDayOverride('2026-10-07', 'school', [], o)
    expect(o).toEqual({})
  })
  it('pruneOverrides: 過去の日は捨てる', () => {
    const o: Record<string, DayType> = { '2026-10-01': 'holiday', '2026-10-02': 'school', '2026-10-03': 'holiday' }
    expect(pruneOverrides(o, '2026-10-02')).toEqual({ '2026-10-02': 'school', '2026-10-03': 'holiday' })
    const same: Record<string, DayType> = { '2026-10-03': 'holiday' }
    expect(pruneOverrides(same, '2026-10-02')).toBe(same)
  })
})
