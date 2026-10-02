// 1日のスケジュール: じこくカード・あいだのブロック・じゆうじかん・時計の扇形
import type { FixedCard, PlanItem, RunState } from './types'
import { minuteOfDay } from './time'

const MIN = 60_000

export const isFixed = (it: PlanItem | undefined): boolean => it?.kind === 'fixed'

/** じこくカードの開始（ms） */
export const fixedStartOf = (it: PlanItem, dayStartMs: number) => dayStartMs + (it.startMin ?? 0) * MIN
/** じこくカードの終わり（ms）。長さなしは開始と同じ */
export const fixedEndOf = (it: PlanItem, dayStartMs: number) => fixedStartOf(it, dayStartMs) + it.minutes * MIN

export interface TimelineRow {
  item: PlanItem
  startMs: number
  endMs: number
}

/** じこくカードにはさまれた「あいだの時間」。ふつうのカードを積んでいく */
export interface Block {
  rows: TimelineRow[]
  /** このブロックのはじまり（ms） */
  startMs: number
  /** つぎのじこくカードの時刻（ms）。さいごのブロックは null（かぎりなし） */
  limitMs: number | null
  /** このブロックをおわらせる、つぎのじこくカード */
  fixed: PlanItem | null
  /** カードを積んだあとの のこり（ms）。マイナスは入りきらない。かぎりなしは null */
  freeMs: number | null
  /** カードが入りきらない */
  over: boolean
  /** じこくカードの時刻が、もうすぎている（カードは置かれていない） */
  passed: boolean
  /** ねる（1日のおわり）のあとにあるブロック */
  pastEnd: boolean
}

export interface Timeline {
  blocks: Block[]
  /** uid → 時刻（ふつうのカードもじこくカードも） */
  rows: Map<string, TimelineRow>
  /** さいごの予定の終わり（ms） */
  endMs: number
}

/**
 * items（ふつうのカードとじこくカードがならんだ列）から、時刻つきの時間割をつくる。
 * - startAt: スタート時刻（ms）
 * - じこくカードは時刻順にならんでいる前提
 */
export function buildTimeline(items: PlanItem[], startAt: number, dayStartMs: number): Timeline {
  const blocks: Block[] = []
  const rows = new Map<string, TimelineRow>()
  let endMs = startAt

  const newBlock = (startMs: number, pastEnd: boolean): Block => ({
    rows: [],
    startMs,
    limitMs: null,
    fixed: null,
    freeMs: null,
    over: false,
    passed: false,
    pastEnd,
  })
  let block = newBlock(startAt, false)
  let used = 0
  let pastEnd = false

  for (const item of items) {
    if (isFixed(item)) {
      const fs = fixedStartOf(item, dayStartMs)
      const fe = fixedEndOf(item, dayStartMs)
      block.limitMs = fs
      block.fixed = item
      block.freeMs = fs - (block.startMs + used)
      block.over = block.rows.length > 0 && block.freeMs < 0
      block.passed = block.rows.length === 0 && block.freeMs < 0
      blocks.push(block)
      const row = { item, startMs: fs, endMs: fe }
      rows.set(item.uid, row)
      endMs = Math.max(endMs, fe)
      if (item.minutes === 0) pastEnd = true
      // つぎのブロックは、じこくカードが終わってから。スタートより前にはならない
      block = newBlock(Math.max(fe, startAt), pastEnd)
      used = 0
    } else {
      const startMs = block.startMs + used
      const row = { item, startMs, endMs: startMs + item.minutes * MIN }
      used += item.minutes * MIN
      block.rows.push(row)
      rows.set(item.uid, row)
      endMs = Math.max(endMs, row.endMs)
    }
  }
  blocks.push(block)
  return { blocks, rows, endMs }
}

// ---- 列の操作 ----

/** じこくカードを、時刻順にそろえる（ふつうのカードの位置は、そのまま） */
export function sortFixedSlots(items: PlanItem[]): PlanItem[] {
  const slots: number[] = []
  items.forEach((it, i) => isFixed(it) && slots.push(i))
  const sorted = slots.map((i) => items[i]).sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0))
  if (sorted.every((it, k) => it === items[slots[k]])) return items
  const out = [...items]
  slots.forEach((slot, k) => (out[slot] = sorted[k]))
  return out
}

/**
 * じこくカードを入れる。時刻がつぎに遅いじこくカードの まえ（なければ さいごに）。
 * そうすると、いままでのカードは「そのじこくカードの まえのブロック」に残る。
 */
export function insertFixed(items: PlanItem[], item: PlanItem): PlanItem[] {
  const at = items.findIndex((it) => isFixed(it) && (it.startMin ?? 0) > (item.startMin ?? 0))
  const next = [...items]
  next.splice(at < 0 ? items.length : at, 0, item)
  return next
}

/** じこくカードにそろえて、名前・時刻などを更新。つくりなおして なくなったカードは外す */
export function syncFixed(items: PlanItem[], cards: FixedCard[]): PlanItem[] {
  let changed = false
  const out: PlanItem[] = []
  for (const it of items) {
    if (!isFixed(it)) {
      out.push(it)
      continue
    }
    const c = cards.find((x) => x.id === it.cardId)
    if (!c) {
      changed = true
      continue
    }
    const same =
      it.name === c.name && it.emoji === c.emoji && it.color === c.color && it.minutes === c.minutes && it.startMin === c.startMin
    if (same) out.push(it)
    else {
      changed = true
      out.push({ ...it, name: c.name, emoji: c.emoji, color: c.color, minutes: c.minutes, startMin: c.startMin })
    }
  }
  const base = changed ? out : items
  return sortFixedSlots(base)
}

/** ふつうのカードを、ブロックの おわりに入れる（fixedUid は そのブロックをおわらせるじこくカード。null は さいごのブロック） */
export function insertAtBlockEnd(items: PlanItem[], item: PlanItem, fixedUid: string | null): PlanItem[] {
  const at = fixedUid ? items.findIndex((it) => it.uid === fixedUid) : -1
  const next = [...items]
  next.splice(at < 0 ? items.length : at, 0, item)
  return next
}

/** タップで入れるとき: 入りきる いちばん早いブロックへ。どこも入らなければ、いちばん早いブロックへ（赤くなる） */
export function insertNormalSmart(items: PlanItem[], item: PlanItem, startAt: number, dayStartMs: number): PlanItem[] {
  const tl = buildTimeline(items, startAt, dayStartMs)
  const usable = tl.blocks.filter((b) => !b.pastEnd)
  const fits = usable.find((b) => b.freeMs === null || b.freeMs - item.minutes * MIN >= 0)
  const target = fits ?? usable[0]
  return insertAtBlockEnd(items, item, target?.fixed?.uid ?? null)
}

// ---- 時計の扇形 ----

export interface Sector {
  startMs: number
  endMs: number
  color: string
  kind: 'card' | 'fixed' | 'free'
  /** いまのカード（強調する） */
  active?: boolean
}

/** 時間割 → 扇形（カード・じこくカード・あまった じゆうじかん） */
export function timelineSectors(tl: Timeline, activeUid?: string): Sector[] {
  const out: Sector[] = []
  for (const b of tl.blocks) {
    for (const r of b.rows) {
      out.push({ startMs: r.startMs, endMs: r.endMs, color: r.item.color, kind: 'card', active: r.item.uid === activeUid })
    }
    if (b.limitMs !== null && b.freeMs !== null && b.freeMs > 0) {
      const used = b.rows.length ? b.rows[b.rows.length - 1].endMs : b.startMs
      out.push({ startMs: used, endMs: b.limitMs, color: '#bfe8d0', kind: 'free' })
    }
    if (b.fixed && b.fixed.minutes > 0) {
      const r = tl.rows.get(b.fixed.uid)!
      out.push({ startMs: r.startMs, endMs: r.endMs, color: r.item.color, kind: 'fixed', active: r.item.uid === activeUid })
    }
  }
  return out
}

/** じっこう中の時計の扇形: いまから先の予定。いまのカードを強調 */
export function runSectors(r: RunState, now: number): Sector[] {
  if (r.phase === 'done') return []
  const item = r.items[r.index]
  const rest = (from: number, cursor: number) => {
    const tl = buildTimeline(r.items.slice(from), cursor, r.dayStartMs)
    return timelineSectors(tl)
  }
  if (r.phase === 'timer') {
    const elapsed = r.accumMs + (r.runningSince != null ? now - r.runningSince : 0)
    const total = item.minutes * MIN + r.extraMs
    const end = now + Math.max(0, total - elapsed)
    return [{ startMs: now - elapsed, endMs: end, color: item.color, kind: 'card', active: true }, ...rest(r.index + 1, end)]
  }
  if (r.phase === 'rate') return rest(r.index + 1, now)
  if (r.phase === 'free') {
    return rest(r.index, now).map((s) => (s.kind === 'free' && s.startMs <= now + 1 ? { ...s, active: true } : s))
  }
  // fixed
  const fe = fixedEndOf(item, r.dayStartMs)
  const cur: Sector[] =
    item.minutes > 0 ? [{ startMs: fixedStartOf(item, r.dayStartMs), endMs: fe, color: item.color, kind: 'fixed', active: true }] : []
  return [...cur, ...rest(r.index + 1, Math.max(fe, now))]
}

/** 文字盤の角度（12時が0度、時計まわり） */
export function dialAngle(ms: number): number {
  return ((minuteOfDay(ms) % 720) / 720) * 360
}
