// 「じっこう中」の時間計算。setInterval のカウントではなく、タイムスタンプの差で計算する。
import type { HistoryEntry, PlanItem, Rating, RunState } from './types'
import { closeSession } from './history'

const MIN = 60_000
export const EXTEND_MS = 5 * MIN

function newEntry(item: PlanItem, now: number): HistoryEntry {
  return {
    name: item.name,
    emoji: item.emoji,
    color: item.color,
    plannedMinutes: item.minutes,
    startedAt: now,
    endedAt: null,
    result: null,
    extensions: 0,
    rating: null,
  }
}

/** いまのカードの記録だけを書きかえる */
function patchEntry(r: RunState, patch: Partial<HistoryEntry>): RunState {
  const entries = r.session.entries.map((e, i) => (i === r.index ? { ...e, ...patch } : e))
  return { ...r, session: { ...r.session, entries } }
}

export function startRun(items: PlanItem[], now: number, id: string = crypto.randomUUID()): RunState {
  return {
    items,
    index: 0,
    accumMs: 0,
    runningSince: now,
    extraMs: 0,
    fired: [],
    phase: 'timer',
    session: { id, startedAt: now, status: 'running', entries: [newEntry(items[0], now)] },
  }
}

/** localStorage から読んだ値が、いまの形式のじっこう中の状態か調べる（古い形式は捨てる） */
export function normalizeRun(raw: unknown): RunState | null {
  const r = raw as Partial<RunState> | null
  if (!r || typeof r !== 'object' || !Array.isArray(r.items) || !r.session || !Array.isArray(r.session.entries)) return null
  if (r.phase !== 'timer' && r.phase !== 'rate' && r.phase !== 'done') return null
  if (typeof r.index !== 'number' || r.index < 0 || r.index >= r.items.length || r.session.entries.length !== r.index + 1) return null
  return r as RunState
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
  const next = patchEntry({ ...r, extraMs: r.extraMs + EXTEND_MS }, { extensions: r.session.entries[r.index].extensions + 1 })
  const el = elapsedMs(next, now)
  const future = new Set(scheduleEvents(durationMs(next)).filter((e) => e.atMs > el).map((e) => e.key))
  return { ...next, fired: next.fired.filter((k) => k === 'half' || !future.has(k as EventKey)) }
}

/** 時間がきた（done）、またはスキップした（skipped）。⭕️❌をえらぶ画面へ。タイマーはここで止まる */
export function finishCard(r: RunState, how: 'done' | 'skipped', now: number): RunState {
  // 時間切れは、タブが止まっていて気づくのが遅れても、ほんとうの終了時刻で記録する
  const scheduledEnd = r.runningSince != null ? r.runningSince + (durationMs(r) - r.accumMs) : now
  const endedAt = how === 'done' ? Math.min(now, scheduledEnd) : now
  const done = patchEntry(r, { result: how, endedAt })
  return { ...done, phase: 'rate', accumMs: 0, runningSince: null, fired: [] }
}

/** ⭕️／❌をえらんだ。つぎのカードがあれば、そのタイマーをはじめる。なければ おしまい */
export function rateCard(r: RunState, rating: Rating, now: number): RunState {
  if (r.phase !== 'rate') return r
  const rated = patchEntry(r, { rating })
  const nextIdx = r.index + 1
  if (nextIdx >= r.items.length) {
    return { ...rated, phase: 'done', session: { ...rated.session, status: 'finished' } }
  }
  return {
    ...rated,
    index: nextIdx,
    accumMs: 0,
    runningSince: now,
    extraMs: 0,
    fired: [],
    phase: 'timer',
    session: { ...rated.session, entries: [...rated.session.entries, newEntry(r.items[nextIdx], now)] },
  }
}

/** やめて もどる（さいごまで終わっていなければ「とちゅうでやめた」） */
export function abortRun(r: RunState) {
  return closeSession(r.session, r.phase)
}
