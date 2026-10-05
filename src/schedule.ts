// 1日のスケジュール: じこくカード・あいだのブロック・じゆうじかん・時計の扇形
import type { FixedCard, PlanItem, RunState } from './types'
import { minuteOfDay } from './time'

const MIN = 60_000

export const isFixed = (it: PlanItem | undefined): boolean => it?.kind === 'fixed'
/** 1日のおわり（ねる）。endOfDay がなければ、長さ0のじこくカードは1日のおわり（古いデータ） */
export const isEndOfDay = (it: PlanItem | undefined): boolean => isFixed(it) && (it!.endOfDay ?? it!.minutes === 0)
/** 時刻だけのじこくカード（おきる・いえをでる）。長さはなく、1日のおわりでもない */
export const isMoment = (it: PlanItem | undefined): boolean => isFixed(it) && it!.minutes === 0 && !isEndOfDay(it)

/** じこくカードの開始（ms） */
export const fixedStartOf = (it: PlanItem, dayStartMs: number) => dayStartMs + (it.startMin ?? 0) * MIN
/** じこくカードの終わり（ms）。長さなしは開始と同じ */
export const fixedEndOf = (it: PlanItem, dayStartMs: number) => fixedStartOf(it, dayStartMs) + it.minutes * MIN

export interface TimelineRow {
  item: PlanItem
  startMs: number
  endMs: number
  /** スタート時刻より前のブロックのカード（もう過ぎている）。時刻は あてにならない */
  past?: boolean
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
  /** つぎのじこくカードが、スタート時刻より前（もう過ぎたブロック）。警告は出さない */
  past: boolean
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
    past: false,
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
      block.past = fs <= startAt
      block.over = !block.past && block.rows.length > 0 && block.freeMs < 0
      block.passed = !block.past && block.rows.length === 0 && block.freeMs < 0
      if (block.past) for (const r of block.rows) r.past = true
      blocks.push(block)
      const row = { item, startMs: fs, endMs: fe }
      rows.set(item.uid, row)
      if (fe > startAt) endMs = Math.max(endMs, fe)
      if (isEndOfDay(item)) pastEnd = true
      // つぎのブロックは、じこくカードが終わってから。スタートより前にはならない
      block = newBlock(Math.max(fe, startAt), pastEnd)
      used = 0
    } else {
      const startMs = block.startMs + used
      const row = { item, startMs, endMs: startMs + item.minutes * MIN }
      used += item.minutes * MIN
      block.rows.push(row)
      rows.set(item.uid, row)
      if (!block.past) endMs = Math.max(endMs, row.endMs)
    }
  }
  blocks.push(block)
  // 過ぎたブロックのカードは、さいごの時刻に入れない
  endMs = startAt
  for (const b of blocks) {
    if (!b.past) for (const r of b.rows) endMs = Math.max(endMs, r.endMs)
  }
  for (const r of rows.values()) if (isFixed(r.item) && r.endMs > startAt) endMs = Math.max(endMs, r.endMs)
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

/**
 * じこくカードの名前・絵・色・しずか などを、設定のじこくカードにそろえる。
 * （時刻と長さは、よてい・土台ごとに決めるので そのまま）つくりなおして なくなったカードは外す。
 */
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
    const endOfDay = c.endOfDay ?? c.minutes === 0
    const same =
      it.name === c.name &&
      it.emoji === c.emoji &&
      it.color === c.color &&
      !!it.quiet === !!c.quiet &&
      !!it.leaving === !!c.leaving &&
      (it.endOfDay ?? it.minutes === 0) === endOfDay
    if (same) out.push(it)
    else {
      changed = true
      out.push({ ...it, name: c.name, emoji: c.emoji, color: c.color, quiet: !!c.quiet, leaving: !!c.leaving, endOfDay })
    }
  }
  return sortFixedSlots(changed ? out : items)
}

/** ふつうのカードを、ブロックの おわりに入れる（fixedUid は そのブロックをおわらせるじこくカード。null は さいごのブロック） */
export function insertAtBlockEnd(items: PlanItem[], item: PlanItem, fixedUid: string | null): PlanItem[] {
  const at = fixedUid ? items.findIndex((it) => it.uid === fixedUid) : -1
  const next = [...items]
  next.splice(at < 0 ? items.length : at, 0, item)
  return next
}

/** ↑↓ボタン: uid のカードを 1つ上(-1)／下(+1)へ。となりが じこくカードなら、それを こえて となりのブロックへ入る */
export function moveItem(items: PlanItem[], uid: string, dir: -1 | 1): PlanItem[] {
  const from = items.findIndex((i) => i.uid === uid)
  const to = from + dir
  if (from < 0 || to < 0 || to >= items.length || isFixed(items[from])) return items
  const next = [...items]
  next[from] = items[to]
  next[to] = items[from]
  return next
}

/** じこくカードの すぐ下（つぎのブロックの さいしょ）に入れる */
export function insertAfterFixed(items: PlanItem[], item: PlanItem, fixedUid: string): PlanItem[] {
  const at = items.findIndex((it) => it.uid === fixedUid)
  const next = [...items]
  next.splice(at < 0 ? items.length : at + 1, 0, item)
  return next
}

/** タップで入れるとき: 入りきる いちばん早いブロックへ。どこも入らなければ、いちばん早いブロックへ（赤くなる） */
export function insertNormalSmart(items: PlanItem[], item: PlanItem, startAt: number, dayStartMs: number): PlanItem[] {
  const tl = buildTimeline(items, startAt, dayStartMs)
  const usable = tl.blocks.filter((b) => !b.pastEnd && !b.past)
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

const HALF_DAY = 12 * 60 * MIN

/** 文字盤は12時間ぶん。from から先の12時間に入る部分だけ、扇形にする */
function windowSector(s: Sector, from: number): Sector | null {
  const startMs = Math.max(s.startMs, from)
  const endMs = Math.min(s.endMs, from + HALF_DAY)
  return endMs > startMs ? { ...s, startMs, endMs } : null
}

/** 時間割 → 扇形（カード・じこくカード・あまった じゆうじかん）。from（ms）から先の12時間ぶん */
export function timelineSectors(tl: Timeline, from: number, activeUid?: string): Sector[] {
  const raw: Sector[] = []
  for (const b of tl.blocks) {
    if (!b.past) {
      for (const r of b.rows) {
        raw.push({ startMs: r.startMs, endMs: r.endMs, color: r.item.color, kind: 'card', active: r.item.uid === activeUid })
      }
      if (b.limitMs !== null && b.freeMs !== null && b.freeMs > 0) {
        const used = b.rows.length ? b.rows[b.rows.length - 1].endMs : b.startMs
        raw.push({ startMs: used, endMs: b.limitMs, color: '#bfe8d0', kind: 'free' })
      }
    }
    if (b.fixed && b.fixed.minutes > 0) {
      const r = tl.rows.get(b.fixed.uid)!
      raw.push({ startMs: r.startMs, endMs: r.endMs, color: r.item.color, kind: 'fixed', active: r.item.uid === activeUid })
    }
  }
  return raw.map((s) => windowSector(s, from)).filter((s): s is Sector => s !== null)
}

/** じっこう中の時計の扇形: いまから先の予定。いまのカードを強調 */
export function runSectors(r: RunState, now: number): Sector[] {
  if (r.phase === 'done') return []
  const item = r.items[r.index]
  const rest = (from: number, cursor: number) => {
    const tl = buildTimeline(r.items.slice(from), cursor, r.dayStartMs)
    return timelineSectors(tl, cursor)
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
