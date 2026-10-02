// 土台（テンプレート）: がっこうの日・やすみの日の「いつもの並び」
import { DEFAULT_FIXED_CARDS, MORNING_CARDS } from './cards'
import { insertFixed, isEndOfDay, isFixed, sortFixedSlots, syncFixed } from './schedule'
import type { DayType, FixedCard, PlanItem, TemplateItem, Templates } from './types'

const byId = <T extends { id: string }>(list: T[], id: string): T => {
  const c = list.find((x) => x.id === id)
  if (!c) throw new Error(`カードが見つかりません: ${id}`)
  return c
}

/** 設定のじこくカード → 土台の中身（時刻・長さは、わたした値か、カードのふだんの値） */
export function fixedTemplateItem(card: FixedCard, over: { startMin?: number; minutes?: number } = {}): TemplateItem {
  return {
    cardId: card.id,
    name: card.name,
    emoji: card.emoji,
    color: card.color,
    kind: 'fixed',
    startMin: over.startMin ?? card.startMin,
    minutes: over.minutes ?? card.minutes,
    quiet: !!card.quiet,
    leaving: !!card.leaving,
    endOfDay: card.endOfDay ?? card.minutes === 0,
  }
}

const fx = (id: string): TemplateItem => fixedTemplateItem(byId(DEFAULT_FIXED_CARDS, id))
const nm = (id: string): TemplateItem => {
  const c = byId(MORNING_CARDS, id)
  return { cardId: c.id, name: c.name, emoji: c.emoji, color: c.color, minutes: c.minutes }
}

/** はじめの土台 */
export function defaultTemplates(): Templates {
  return {
    school: [
      fx('wake'),
      nm('dress'),
      nm('breakfast-eat'),
      nm('brush'),
      nm('toilet'),
      nm('check-bag'),
      fx('leave'),
      fx('school'),
      fx('dinner'),
      fx('bath'),
      fx('bed'),
    ],
    holiday: [fx('breakfast'), fx('lunch'), fx('dinner'), fx('bath'), fx('bed')],
    weekday: { school: {}, holiday: {} },
  }
}

/** その日の土台。曜日ごとの上書き（0=にち … 6=ど）があればそちら */
export function templateFor(t: Templates, type: DayType, weekday: number): TemplateItem[] {
  return t.weekday[type][String(weekday)] ?? t[type]
}

export const hasWeekdayOverride = (t: Templates, type: DayType, weekday: number) => String(weekday) in t.weekday[type]

/** 土台 → その日のよてい（新しい uid をつけ、じこくカードは設定の最新にそろえる） */
export function planFromTemplate(items: TemplateItem[], fixedCards: FixedCard[]): PlanItem[] {
  const plan = items.map((i) => ({ ...i, uid: crypto.randomUUID() }))
  return syncFixed(plan, fixedCards)
}

/** よてい → 土台の形（uid をとる） */
export function itemsToTemplate(items: PlanItem[]): TemplateItem[] {
  return items.map(({ uid: _uid, ...rest }) => rest)
}

const withUids = (items: TemplateItem[]): PlanItem[] => items.map((it, k) => ({ ...it, uid: `t${k}` }))

/** 土台に、じこくカードを足す（時刻順の ところへ） */
export function addFixedToTemplate(items: TemplateItem[], card: FixedCard): TemplateItem[] {
  return itemsToTemplate(insertFixed(withUids(items), { ...fixedTemplateItem(card), uid: 'new' }))
}

/** 土台のじこくカードの時刻・長さを変えて、時刻順に ならべなおす */
export function updateTemplateFixed(items: TemplateItem[], index: number, patch: { startMin?: number; minutes?: number }): TemplateItem[] {
  return itemsToTemplate(sortFixedSlots(withUids(items.map((it, i) => (i === index ? { ...it, ...patch } : it)))))
}

/** 土台の ふつうのカードの長さを変える */
export function updateTemplateMinutes(items: TemplateItem[], index: number, minutes: number): TemplateItem[] {
  return items.map((it, i) => (i === index ? { ...it, minutes } : it))
}

/** 土台に ふつうのカードを入れる（beforeIndex の まえ。items.length ならさいごに） */
export function insertTemplateNormal(items: TemplateItem[], card: { id: string; name: string; emoji: string; color: string; minutes: number }, beforeIndex: number): TemplateItem[] {
  const next = [...items]
  next.splice(beforeIndex, 0, { cardId: card.id, name: card.name, emoji: card.emoji, color: card.color, minutes: card.minutes })
  return next
}

/** 土台の ふつうのカードを、ひとつ上／下へ（じこくカードは動かせない） */
export function moveTemplateItem(items: TemplateItem[], index: number, delta: -1 | 1): TemplateItem[] {
  const to = index + delta
  if (to < 0 || to >= items.length || items[index].kind === 'fixed') return items
  const next = [...items]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

export const removeTemplateItem = (items: TemplateItem[], index: number): TemplateItem[] => items.filter((_, i) => i !== index)

/** 設定のじこくカードを けしたとき、土台からも外す */
export function purgeFixedCard(t: Templates, cardId: string): Templates {
  const drop = (items: TemplateItem[]) => items.filter((i) => !(isFixed(i as PlanItem) && i.cardId === cardId))
  const dropAll = (rec: Record<string, TemplateItem[]>) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, drop(v)]))
  return { school: drop(t.school), holiday: drop(t.holiday), weekday: { school: dropAll(t.weekday.school), holiday: dropAll(t.weekday.holiday) } }
}

/** 保存データを、いまの形にそろえる（こわれた・古いデータでも落ちないように） */
export function normalizeTemplates(raw: unknown): Templates {
  const d = defaultTemplates()
  const r = raw as Partial<Templates> | null
  if (!r || typeof r !== 'object') return d
  const list = (v: unknown, fallback: TemplateItem[]) => (Array.isArray(v) ? (v as TemplateItem[]) : fallback)
  const rec = (v: unknown) =>
    v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v as object).filter(([k, x]) => /^[0-6]$/.test(k) && Array.isArray(x)))
      : {}
  return {
    school: list(r.school, d.school),
    holiday: list(r.holiday, d.holiday),
    weekday: { school: rec(r.weekday?.school) as Templates['weekday']['school'], holiday: rec(r.weekday?.holiday) as Templates['weekday']['holiday'] },
  }
}

/**
 * 保存されていたじこくカードを、いまの形にそろえる。
 * - しずか・でかけるカード・1日のおわり の印がなければ、ふだんの値でおぎなう
 * - addMissing: はじめから入っているカード（おきる・いえをでる・がっこう…）で、まだ無いものを足す
 */
export function migrateFixedCards(stored: FixedCard[], addMissing: boolean): FixedCard[] {
  const out: FixedCard[] = stored.map((c) => {
    const d = DEFAULT_FIXED_CARDS.find((x) => x.id === c.id)
    return {
      ...c,
      quiet: c.quiet ?? d?.quiet ?? false,
      leaving: c.leaving ?? d?.leaving ?? false,
      endOfDay: c.endOfDay ?? (c.minutes === 0 ? (d?.endOfDay ?? true) : false),
    }
  })
  if (addMissing) for (const d of DEFAULT_FIXED_CARDS) if (!out.some((c) => c.id === d.id)) out.push({ ...d })
  return out
}

export const isEnd = (i: TemplateItem) => isEndOfDay(i as PlanItem)
