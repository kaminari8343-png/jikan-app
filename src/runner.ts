// 「じっこう中」の時間計算。setInterval のカウントではなく、タイムスタンプの差で計算する。
import type { PlanItem, RunState } from './types'

const MIN = 60_000
export const EXTEND_MS = 5 * MIN

export function startRun(items: PlanItem[], now: number): RunState {
  return { items, index: 0, accumMs: 0, runningSince: now, extraMs: 0, fired: [], finished: false }
}

export const currentItem = (r: RunState): PlanItem | undefined => r.items[r.index]
export const nextItem = (r: RunState): PlanItem | undefined => r.items[r.index + 1]

export const durationMs = (r: RunState) => (currentItem(r)?.minutes ?? 0) * MIN + r.extraMs

/** いまのカードで経過した時間（一時停止中は止まる。バックグラウンドでもズレない） */
export const elapsedMs = (r: RunState, now: number) => r.accumMs + (r.runningSince != null ? now - r.runningSince : 0)

export const remainingMs = (r: RunState, now: number) => Math.max(0, durationMs(r) - elapsedMs(r, now))

export const isRunning = (r: RunState) => r.runningSince != null

export type EventKey = 'half' | 'remaining5' | 'remaining1'
export interface RunEvent {
  key: EventKey
  atMs: number
  /** セリフに入れる「あと◯ふん」 */
  minutes: number
}

/** そのカードの長さで、どこでお知らせするか */
export function scheduleEvents(totalMs: number): RunEvent[] {
  const total = totalMs / MIN
  const out: RunEvent[] = []
  const half: RunEvent | null = total >= 4 ? { key: 'half', atMs: totalMs / 2, minutes: Math.floor(total / 2) } : null
  if (half) out.push(half)
  const extra: RunEvent[] = []
  if (total >= 8) extra.push({ key: 'remaining5', atMs: totalMs - 5 * MIN, minutes: 5 })
  if (total >= 3) extra.push({ key: 'remaining1', atMs: totalMs - MIN, minutes: 1 })
  // はんぶんのお知らせと近すぎるものは、うるさいのでやめる
  for (const e of extra) if (!half || Math.abs(e.atMs - half.atMs) >= 45_000) out.push(e)
  return out.sort((a, b) => a.atMs - b.atMs)
}

/** 時間がきたお知らせ（まだ話していないもの） */
export function dueEvents(r: RunState, now: number): RunEvent[] {
  const el = elapsedMs(r, now)
  return scheduleEvents(durationMs(r)).filter((e) => e.atMs <= el && !r.fired.includes(e.key))
}

export function markFired(r: RunState, events: RunEvent[]): RunState {
  return events.length ? { ...r, fired: [...r.fired, ...events.map((e) => e.key)] } : r
}

export function pause(r: RunState, now: number): RunState {
  return r.runningSince == null ? r : { ...r, accumMs: elapsedMs(r, now), runningSince: null }
}

export function resume(r: RunState, now: number): RunState {
  return r.runningSince != null ? r : { ...r, runningSince: now }
}

/** +5ふん。のびた分の「あと5ふん／1ぷん」は、もういちど話せるようにする */
export function extend(r: RunState, now: number): RunState {
  const next = { ...r, extraMs: r.extraMs + EXTEND_MS }
  const el = elapsedMs(next, now)
  const future = new Set(scheduleEvents(durationMs(next)).filter((e) => e.atMs > el).map((e) => e.key))
  return { ...next, fired: next.fired.filter((k) => k === 'half' || !future.has(k as EventKey)) }
}

/** つぎのカードへ（さいごなら おしまい） */
export function advance(r: RunState, now: number): RunState {
  if (r.index + 1 >= r.items.length) return { ...r, finished: true, accumMs: 0, runningSince: null, fired: [] }
  const wasRunning = isRunning(r)
  return { ...r, index: r.index + 1, accumMs: 0, runningSince: wasRunning ? now : null, extraMs: 0, fired: [] }
}
