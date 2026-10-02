import { describe, expect, it } from 'vitest'
import { DEFAULT_FIXED_CARDS } from './cards'
import {
  addFixedToTemplate,
  defaultTemplates,
  fixedTemplateItem,
  hasWeekdayOverride,
  insertTemplateNormal,
  migrateFixedCards,
  moveTemplateItem,
  normalizeTemplates,
  planFromTemplate,
  purgeFixedCard,
  removeTemplateItem,
  templateFor,
  updateTemplateFixed,
  updateTemplateMinutes,
} from './templates'
import { buildTimeline, isEndOfDay, isMoment } from './schedule'
import type { FixedCard, PlanItem } from './types'

const hm = (h: number, m = 0) => h * 60 + m
const MIN = 60_000
const DAY = new Date(2026, 9, 7).getTime()

describe('はじめの土台', () => {
  const t = defaultTemplates()
  const fixedOf = (items: ReturnType<typeof defaultTemplates>['school']) => items.filter((i) => i.kind === 'fixed')

  it('がっこうの日: おきる・いえをでる・がっこう・ゆうごはん・おふろ・ねる', () => {
    const f = fixedOf(t.school).map((i) => [i.name, i.startMin, i.minutes])
    expect(f).toEqual([
      ['おきる', hm(6, 30), 0],
      ['いえをでる', hm(7, 20), 0],
      ['がっこう', hm(7, 20), 460], // 7:20〜15:00
      ['ゆうごはん', hm(18, 30), 30],
      ['おふろ', hm(19, 30), 30],
      ['ねる', hm(21), 0],
    ])
    expect(hm(7, 20) + 460).toBe(hm(15))
  })
  it('やすみの日: あさごはん・ひるごはん・ゆうごはん・おふろ・ねる（夜の時刻はがっこうの日と同じ）', () => {
    const f = fixedOf(t.holiday).map((i) => [i.name, i.startMin, i.minutes])
    expect(f).toEqual([
      ['あさごはん', hm(7, 30), 30],
      ['ひるごはん', hm(12), 30],
      ['ゆうごはん', hm(18, 30), 30],
      ['おふろ', hm(19, 30), 30],
      ['ねる', hm(21), 0],
    ])
    const eve = (items: typeof t.school) => fixedOf(items).filter((i) => ['ゆうごはん', 'おふろ', 'ねる'].includes(i.name)).map((i) => [i.startMin, i.minutes])
    expect(eve(t.holiday)).toEqual(eve(t.school))
  })
  it('がっこう・ごはん・おふろは「しずか」オン。いえをでる は オフで「でかける」カード', () => {
    const all = [...t.school, ...t.holiday].filter((i) => i.kind === 'fixed')
    for (const i of all) {
      const quietNames = ['がっこう', 'あさごはん', 'ひるごはん', 'ゆうごはん', 'おふろ']
      expect(!!i.quiet, i.name).toBe(quietNames.includes(i.name))
    }
    const leave = t.school.find((i) => i.name === 'いえをでる')!
    expect(leave.quiet).toBe(false)
    expect(leave.leaving).toBe(true)
  })
  it('おきる・いえをでる は時刻だけのカード、ねる は1日のおわり', () => {
    const get = (n: string) => t.school.find((i) => i.name === n)! as PlanItem
    expect(isMoment(get('おきる'))).toBe(true)
    expect(isMoment(get('いえをでる'))).toBe(true)
    expect(isEndOfDay(get('おきる'))).toBe(false)
    expect(isEndOfDay(get('ねる'))).toBe(true)
    expect(isMoment(get('がっこう'))).toBe(false)
  })
  it('がっこうの日は、おきる〜いえをでる のあいだに あさのカードが最初から並ぶ（5〜15ふん）', () => {
    const names = t.school.map((i) => i.name)
    const a = names.indexOf('おきる')
    const b = names.indexOf('いえをでる')
    const morning = t.school.slice(a + 1, b)
    expect(morning.map((i) => i.name)).toEqual(['きがえ', 'あさごはん', 'はみがき', 'トイレ', 'もちものチェック'])
    for (const m of morning) {
      expect(m.kind).toBeUndefined()
      expect(m.minutes).toBeGreaterThanOrEqual(5)
      expect(m.minutes).toBeLessThanOrEqual(15)
    }
    // 7:20 までに おさまる（朝のブロックに 余裕がある）
    const items = planFromTemplate(t.school, DEFAULT_FIXED_CARDS)
    const tl = buildTimeline(items, DAY + hm(6, 30) * MIN, DAY)
    const block = tl.blocks.find((bl) => bl.fixed?.name === 'いえをでる')!
    expect(block.rows).toHaveLength(5)
    expect(block.over).toBe(false)
    expect(block.freeMs).toBeGreaterThanOrEqual(0)
  })
})

describe('曜日ごとの上書き', () => {
  it('上書きがなければ ふだんの土台、あれば そちら', () => {
    const t = defaultTemplates()
    expect(templateFor(t, 'school', 3)).toBe(t.school)
    expect(hasWeekdayOverride(t, 'school', 3)).toBe(false)
    // 水曜は がっこう 7:20〜14:00
    const wed = t.school.map((i) => (i.name === 'がっこう' ? { ...i, minutes: 400 } : i))
    const t2 = { ...t, weekday: { ...t.weekday, school: { '3': wed } } }
    expect(templateFor(t2, 'school', 3)).toBe(wed)
    expect(templateFor(t2, 'school', 2)).toBe(t2.school)
    expect(templateFor(t2, 'holiday', 3)).toBe(t2.holiday)
    expect(hasWeekdayOverride(t2, 'school', 3)).toBe(true)
    const school = templateFor(t2, 'school', 3).find((i) => i.name === 'がっこう')!
    expect(school.startMin! + school.minutes).toBe(hm(14))
  })
  it('normalizeTemplates: こわれた保存データでも、ふだんの土台にもどる', () => {
    expect(normalizeTemplates(null)).toEqual(defaultTemplates())
    expect(normalizeTemplates({ school: 'x', weekday: { school: { '9': [], '2': [] } } }).weekday.school).toEqual({ '2': [] })
  })
})

describe('土台 → その日のよてい', () => {
  it('新しい uid がつき、じこくカードは設定の最新（しずかなど）にそろう', () => {
    const cards = DEFAULT_FIXED_CARDS.map((c) => (c.id === 'school' ? { ...c, name: 'がっこう（小）', quiet: false } : c))
    const a = planFromTemplate(defaultTemplates().school, cards)
    const b = planFromTemplate(defaultTemplates().school, cards)
    expect(new Set(a.map((i) => i.uid)).size).toBe(a.length)
    expect(a[0].uid).not.toBe(b[0].uid)
    expect(a.find((i) => i.cardId === 'school')).toMatchObject({ name: 'がっこう（小）', quiet: false, startMin: hm(7, 20), minutes: 460 })
  })
  it('設定から消されたじこくカードは入らない', () => {
    const cards = DEFAULT_FIXED_CARDS.filter((c) => c.id !== 'bath')
    expect(planFromTemplate(defaultTemplates().school, cards).some((i) => i.cardId === 'bath')).toBe(false)
  })
})

describe('土台の編集', () => {
  const base = () => defaultTemplates().holiday
  const card: FixedCard = { id: 'piano', name: 'ピアノ', emoji: '🎹', color: '#fff', startMin: hm(16), minutes: 30 }

  it('じこくカードを足すと、時刻順のところに入る', () => {
    const next = addFixedToTemplate(base(), card)
    expect(next.map((i) => i.name)).toEqual(['あさごはん', 'ひるごはん', 'ピアノ', 'ゆうごはん', 'おふろ', 'ねる'])
  })
  it('時刻を変えると、時刻順に並びなおす（長さも変えられる）', () => {
    const items = base()
    const idx = items.findIndex((i) => i.name === 'あさごはん')
    const moved = updateTemplateFixed(items, idx, { startMin: hm(13) })
    expect(moved.map((i) => i.name)).toEqual(['ひるごはん', 'あさごはん', 'ゆうごはん', 'おふろ', 'ねる'])
    expect(updateTemplateFixed(items, idx, { minutes: 45 })[idx].minutes).toBe(45)
  })
  it('ふつうのカードを入れる・長さを変える・動かす・消す', () => {
    let items = defaultTemplates().school
    const i0 = items.findIndex((i) => i.name === 'はみがき')
    items = updateTemplateMinutes(items, i0, 8)
    expect(items[i0].minutes).toBe(8)
    items = moveTemplateItem(items, i0, -1)
    expect(items.slice(i0 - 1, i0 + 1).map((i) => i.name)).toEqual(['はみがき', 'あさごはん'])
    // じこくカードは動かせない
    const f = items.findIndex((i) => i.kind === 'fixed')
    expect(moveTemplateItem(items, f, 1)).toBe(items)
    items = insertTemplateNormal(items, { id: 'x', name: 'テレビ', emoji: '📺', color: '#999', minutes: 5 }, items.findIndex((i) => i.name === 'いえをでる'))
    expect(items.map((i) => i.name).slice(-8, -5)).toContain('テレビ')
    items = removeTemplateItem(items, items.findIndex((i) => i.name === 'テレビ'))
    expect(items.some((i) => i.name === 'テレビ')).toBe(false)
  })
  it('設定のじこくカードを消すと、土台（曜日の上書きも）からも外れる', () => {
    const t = defaultTemplates()
    const t2 = { ...t, weekday: { school: { '3': t.school }, holiday: {} } }
    const p = purgeFixedCard(t2, 'bath')
    expect(p.school.some((i) => i.cardId === 'bath')).toBe(false)
    expect(p.holiday.some((i) => i.cardId === 'bath')).toBe(false)
    expect(p.weekday.school['3'].some((i) => i.cardId === 'bath')).toBe(false)
    expect(p.school.some((i) => i.cardId === 'dinner')).toBe(true)
  })
  it('fixedTemplateItem: 時刻・長さを上書きできる', () => {
    expect(fixedTemplateItem(DEFAULT_FIXED_CARDS[2], { minutes: 400 })).toMatchObject({ name: 'がっこう', minutes: 400, startMin: hm(7, 20), quiet: true })
  })
})

describe('保存されていたじこくカードの移行', () => {
  const old: FixedCard[] = [
    { id: 'dinner', name: 'ゆうごはん', emoji: '🍚', color: '#f4a259', startMin: hm(18, 30), minutes: 30 },
    { id: 'bath', name: 'おふろ', emoji: '🛁', color: '#5bc0eb', startMin: hm(19, 30), minutes: 30 },
    { id: 'bed', name: 'ねる', emoji: '😴', color: '#8d7be0', startMin: hm(21), minutes: 0 },
    { id: 'piano', name: 'ピアノ', emoji: '🎹', color: '#fff', startMin: hm(17), minutes: 0 }, // 古い形式: 長さ0 = 1日のおわり
  ]
  it('ごはん・おふろは しずかオン。ねるは1日のおわり。自分でつくった長さ0のカードも（古い意味のまま）1日のおわり', () => {
    const m = migrateFixedCards(old, false)
    expect(m.find((c) => c.id === 'dinner')).toMatchObject({ quiet: true, endOfDay: false })
    expect(m.find((c) => c.id === 'bath')?.quiet).toBe(true)
    expect(m.find((c) => c.id === 'bed')).toMatchObject({ endOfDay: true, quiet: false })
    expect(m.find((c) => c.id === 'piano')).toMatchObject({ endOfDay: true, quiet: false })
    expect(m).toHaveLength(4)
  })
  it('はじめから入っているカード（おきる・いえをでる・がっこう…）で、無いものを足す。あるものは足さない', () => {
    const m = migrateFixedCards(old, true)
    expect(m.map((c) => c.id).sort()).toEqual(['bath', 'bed', 'breakfast', 'dinner', 'leave', 'lunch', 'piano', 'school', 'wake'])
    expect(migrateFixedCards(m, true)).toHaveLength(m.length)
  })
  it('親が直した時刻・名前は、移行しても そのまま', () => {
    const edited = old.map((c) => (c.id === 'dinner' ? { ...c, name: 'ばんごはん', startMin: hm(19) } : c))
    expect(migrateFixedCards(edited, true).find((c) => c.id === 'dinner')).toMatchObject({ name: 'ばんごはん', startMin: hm(19) })
  })
})
