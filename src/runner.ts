// 「じっこう中」の動き。時間は setInterval のカウントではなく、タイムスタンプの差で計算する。
// 状態の変化はぜんぶ「純粋な関数」で、{ run: つぎの状態, cues: 話すセリフ } を返す（テストしやすいように）。
import type { HistoryEntry, HistorySession, PlanItem, Rating, RunState } from './types'
import type { PhraseKey } from './phrases'
import type { PhraseVars } from './phrases.logic'
import { closeSession } from './history'
import { fixedEndOf, fixedStartOf, isFixed } from './schedule'
import { startOfDay } from './time'

const MIN = 60_000
export const EXTEND_MS = 5 * MIN
/** タブが止まっていて遅れたお知らせは、これより古ければ話さない */
const LATE_MS = 20_000

/** 話すセリフ（キー＋穴うめ）。話す係は Runner。 */
export interface Cue {
  key: PhraseKey
  vars?: PhraseVars
}
export interface Step {
  run: RunState
  cues: Cue[]
}

export const currentItem = (r: RunState): PlanItem | undefined => r.items[r.index]
export const nextItem = (r: RunState): PlanItem | undefined => r.items[r.index + 1]

export const durationMs = (r: RunState) => (currentItem(r)?.minutes ?? 0) * MIN + r.extraMs

/** いまのカードで経過した時間（一時停止中は止まる。バックグラウンドでもズレない） */
export const elapsedMs = (r: RunState, now: number) => r.accumMs + (r.runningSince != null ? now - r.runningSince : 0)

export const remainingMs = (r: RunState, now: number) => Math.max(0, durationMs(r) - elapsedMs(r, now))

export const isRunning = (r: RunState) => r.runningSince != null

/** あと何ミリ秒で、つぎのじこくカード（r.index のあとの）か。なければ null */
function nextFixedIndex(items: PlanItem[], from: number): number {
  for (let j = from; j < items.length; j++) if (isFixed(items[j])) return j
  return -1
}

/** いまのカードのあとの、つぎのじこくカード */
export function upcomingFixed(r: RunState): { item: PlanItem; startMs: number } | null {
  const from = r.phase === 'free' ? r.index : r.index + 1
  const j = nextFixedIndex(r.items, from)
  return j < 0 ? null : { item: r.items[j], startMs: fixedStartOf(r.items[j], r.dayStartMs) }
}

/** じゆうじかん・じこくカードの最中の、カウントダウン */
export function phaseCountdown(r: RunState, now: number): { totalMs: number; remainingMs: number } | null {
  const item = currentItem(r)
  if (!item) return null
  if (r.phase === 'free') {
    const startedAt = r.session.entries[r.cur]?.startedAt ?? now
    const end = fixedStartOf(item, r.dayStartMs)
    return { totalMs: Math.max(1, end - startedAt), remainingMs: Math.max(0, end - now) }
  }
  if (r.phase === 'fixed') {
    const end = fixedEndOf(item, r.dayStartMs)
    return { totalMs: Math.max(1, item.minutes * MIN), remainingMs: Math.max(0, end - now) }
  }
  return null
}

// ---- 記録 ----

function normalEntry(item: PlanItem, now: number): HistoryEntry {
  return {
    kind: 'normal',
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

const fixedEntry = (item: PlanItem, now: number): HistoryEntry => ({ ...normalEntry(item, now), kind: 'fixed' })

const freeEntry = (now: number, minutes: number): HistoryEntry => ({
  kind: 'free',
  name: 'じゆうじかん',
  emoji: '🕊️',
  color: '#bfe8d0',
  plannedMinutes: minutes,
  startedAt: now,
  endedAt: null,
  result: null,
  extensions: 0,
  rating: null,
})

/** じかんぎれ: そのブロックで はじめられなかったカード。評価はつけない */
const timeoutEntry = (item: PlanItem, at: number): HistoryEntry => ({
  ...normalEntry(item, at),
  endedAt: at,
  result: 'timeout',
})

/** いまの記録だけを書きかえる */
function patchEntry(r: RunState, patch: Partial<HistoryEntry>): RunState {
  if (r.cur < 0) return r
  const entries = r.session.entries.map((e, i) => (i === r.cur ? { ...e, ...patch } : e))
  return { ...r, session: { ...r.session, entries } }
}

/** 記録を足して、それを「いまの記録」にする */
function pushEntry(r: RunState, entry: HistoryEntry): RunState {
  return { ...r, session: { ...r.session, entries: [...r.session.entries, entry] }, cur: r.session.entries.length }
}

/** 「:」つき（fix: soon:）のお知らせは、つぎのカードになっても おぼえておく */
const keepFired = (fired: string[]) => fired.filter((k) => k.includes(':'))

// ---- はじめる・つぎへ進む ----

function finishRun(r: RunState, cues: Cue[], endOfDay: boolean): Step {
  const done: RunState = {
    ...r,
    phase: 'done',
    runningSince: null,
    accumMs: 0,
    session: { ...r.session, status: 'finished' },
  }
  cues.push({ key: endOfDay ? 'endOfDay' : 'allDone' })
  return { run: done, cues }
}

/**
 * items[i] から先へ進める（いまの時刻 now で）。
 * - ふつうのカード: つぎのじこくカードの時刻をすぎていたら、そのブロックの残りは「じかんぎれ」
 * - じこくカード: まだなら「じゆうじかん」、時刻なら そのカードをはじめる
 */
function enterFrom(r0: RunState, i0: number, now: number, opts: { first?: boolean; arrived?: boolean } = {}): Step {
  let r = r0
  let i = i0
  const cues: Cue[] = []
  for (;;) {
    const item = r.items[i]
    if (!item) return finishRun(r, cues, false)

    if (isFixed(item)) {
      const start = fixedStartOf(item, r.dayStartMs)
      const end = fixedEndOf(item, r.dayStartMs)
      const vars = { fixed: item.name, clock: item.startMin }
      if (item.minutes === 0) {
        if (now >= start) {
          // 1日のおわり（ねる）。のこりのカードは じかんぎれ
          r = pushEntry({ ...r, index: i }, { ...fixedEntry(item, now), endedAt: now, result: 'done' })
          let timedOut = false
          for (let k = i + 1; k < r.items.length; k++) {
            if (!isFixed(r.items[k])) {
              r = pushEntry(r, timeoutEntry(r.items[k], start))
              timedOut = true
            }
          }
          if (opts.arrived) cues.push({ key: 'fixedStart', vars })
          if (timedOut) cues.push({ key: 'timeoutNote' })
          return finishRun(r, cues, true)
        }
      } else if (now >= end) {
        i++ // もう終わっている時間のじこくカードは とばす
        continue
      } else if (now >= start) {
        r = pushEntry(
          { ...r, index: i, phase: 'fixed', accumMs: 0, runningSince: null, extraMs: 0, fired: keepFired(r.fired) },
          fixedEntry(item, now),
        )
        cues.push(
          opts.arrived ? { key: 'fixedStart', vars } : { key: 'start', vars: { name: item.name, minutes: item.minutes } },
        )
        return { run: r, cues }
      }
      // まだ時刻じゃない → じゆうじかん
      // 「あと◯ふん」は、秒のずれで1ふん少なく言わないよう、四捨五入する
      const freeMs = start - now
      const freeMin = Math.round(freeMs / MIN)
      r = pushEntry(
        { ...r, index: i, phase: 'free', accumMs: 0, runningSince: null, extraMs: 0, fired: keepFired(r.fired) },
        freeEntry(now, freeMin),
      )
      if (freeMs >= MIN) cues.push({ key: 'freeStart', vars: { fixed: item.name, minutes: freeMin } })
      return { run: r, cues }
    }

    // ふつうのカード
    const j = nextFixedIndex(r.items, i + 1)
    if (j >= 0) {
      const deadline = fixedStartOf(r.items[j], r.dayStartMs)
      if (deadline <= now) {
        for (let k = i; k < j; k++) r = pushEntry(r, timeoutEntry(r.items[k], deadline))
        cues.push({ key: 'timeoutNote' })
        i = j
        continue
      }
    }
    r = pushEntry(
      { ...r, index: i, phase: 'timer', accumMs: 0, runningSince: now, extraMs: 0, fired: keepFired(r.fired) },
      normalEntry(item, now),
    )
    if (!opts.first) cues.push({ key: 'next', vars: { next: item.name } })
    cues.push({ key: 'start', vars: { name: item.name, minutes: item.minutes } })
    return { run: r, cues }
  }
}

export function startRun(items: PlanItem[], now: number, id: string = crypto.randomUUID()): Step {
  const base: RunState = {
    items,
    index: 0,
    accumMs: 0,
    runningSince: null,
    extraMs: 0,
    fired: [],
    phase: 'timer',
    session: { id, startedAt: now, status: 'running', entries: [] },
    cur: -1,
    dayStartMs: startOfDay(now),
  }
  return enterFrom(base, 0, now, { first: true })
}

/** localStorage から読んだ値が、いまの形式のじっこう中の状態か調べる（古い形式は捨てる） */
export function normalizeRun(raw: unknown): RunState | null {
  const r = raw as Partial<RunState> | null
  if (!r || typeof r !== 'object' || !Array.isArray(r.items) || !r.session || !Array.isArray(r.session.entries)) return null
  if (!['timer', 'rate', 'free', 'fixed', 'done'].includes(r.phase as string)) return null
  if (typeof r.dayStartMs !== 'number' || typeof r.cur !== 'number') return null
  if (typeof r.index !== 'number' || r.index < 0 || r.index >= r.items.length) return null
  if (r.cur >= r.session.entries.length) return null
  return r as RunState
}

// ---- お知らせ（はんぶん・あと5ふん・あと1ぷん） ----

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

// ---- 一時停止・延長・スキップ・評価 ----

export function pause(r: RunState, now: number): RunState {
  return r.phase !== 'timer' || r.runningSince == null ? r : { ...r, accumMs: elapsedMs(r, now), runningSince: null }
}

export function resume(r: RunState, now: number): RunState {
  return r.phase !== 'timer' || r.runningSince != null ? r : { ...r, runningSince: now }
}

/** 「+5ふん」できるか。つぎのじこくカードの時刻をこえるならダメ */
export function canExtend(r: RunState, now: number): { ok: true } | { ok: false; fixed: PlanItem } {
  const up = upcomingFixed(r)
  if (up && now + remainingMs(r, now) + EXTEND_MS > up.startMs) return { ok: false, fixed: up.item }
  return { ok: true }
}

/** +5ふん。のびた分の「あと5ふん／1ぷん」は、もういちど話せるようにする */
export function extendCard(r: RunState, now: number): Step {
  if (r.phase !== 'timer') return { run: r, cues: [] }
  const can = canExtend(r, now)
  if (!can.ok) return { run: r, cues: [{ key: 'cannotExtend', vars: { fixed: can.fixed.name } }] }
  const count = (r.session.entries[r.cur]?.extensions ?? 0) + 1
  const next = patchEntry({ ...r, extraMs: r.extraMs + EXTEND_MS }, { extensions: count })
  const el = elapsedMs(next, now)
  const future = new Set(scheduleEvents(durationMs(next)).filter((e) => e.atMs > el).map((e) => e.key as string))
  const run = { ...next, fired: next.fired.filter((k) => k === 'half' || !future.has(k)) }
  return { run, cues: [{ key: 'extended', vars: { minutes: EXTEND_MS / MIN } }] }
}

/** 時間がきた（done）／スキップした（skipped）／じこくカードで止めた（cutoff）。⭕️❌をえらぶ画面へ */
export function finishCard(r: RunState, how: 'done' | 'skipped' | 'cutoff', now: number): RunState {
  // 時間切れは、タブが止まっていて気づくのが遅れても、ほんとうの終了時刻で記録する
  const scheduledEnd = r.runningSince != null ? r.runningSince + (durationMs(r) - r.accumMs) : now
  const endedAt = how === 'done' ? Math.min(now, scheduledEnd) : now
  const done = patchEntry(r, { result: how, endedAt })
  return { ...done, phase: 'rate', accumMs: 0, runningSince: null, fired: keepFired(r.fired) }
}

export function skipCard(r: RunState, now: number): Step {
  if (r.phase !== 'timer') return { run: r, cues: [] }
  const item = currentItem(r)!
  return { run: finishCard(r, 'skipped', now), cues: [{ key: 'ask', vars: { name: item.name } }] }
}

/** ⭕️／❌をえらんだ。つぎへ進める（じこくカードの時刻をすぎていれば、のこりは じかんぎれ） */
export function rateCard(r: RunState, rating: Rating, now: number): Step {
  if (r.phase !== 'rate') return { run: r, cues: [] }
  const rated = patchEntry(r, { rating })
  const next = enterFrom(rated, r.index + 1, now)
  return { run: next.run, cues: [{ key: rating === 'good' ? 'rateGood' : 'rateBad' }, ...next.cues] }
}

/** やめて もどる（さいごまで終わっていなければ「とちゅうでやめた」） */
export function abortRun(r: RunState, now: number = Date.now()): HistorySession {
  const entries = r.session.entries.map((e, i) =>
    i === r.cur && r.phase !== 'done' && (e.kind === 'free' || e.kind === 'fixed') && e.endedAt === null
      ? { ...e, endedAt: now, result: 'done' as const }
      : e,
  )
  return closeSession({ ...r.session, entries }, r.phase)
}

// ---- 時間がたつたびの処理 ----

/**
 * 250ms ごとなどに呼ぶ。時刻 now で起きるべきことを、ぜんぶ進める。
 * （画面が止まっていた間の分も、タイムスタンプの差でまとめて追いつく）
 */
export function tick(r: RunState, now: number): Step {
  if (r.phase === 'done') return { run: r, cues: [] }
  const item = currentItem(r)!
  const cues: Cue[] = []
  let run = r

  // じゆうじかん → じこくカードの時刻
  if (run.phase === 'free') {
    const start = fixedStartOf(item, run.dayStartMs)
    if (now >= start) {
      const closed = patchEntry(run, { endedAt: start, result: 'done' })
      return enterFrom(closed, run.index, now, { arrived: true })
    }
  }

  // じこくカードの時刻（5分前のお知らせ・時間になったら いまのカードを止める）
  if (run.phase === 'timer' || run.phase === 'rate' || run.phase === 'free') {
    const up = upcomingFixed(run)
    if (up) {
      const { item: f, startMs } = up
      if (now >= startMs) {
        const key = `fix:${f.uid}`
        if (!run.fired.includes(key)) {
          cues.push({ key: 'fixedStart', vars: { fixed: f.name, clock: f.startMin } })
          run = { ...run, fired: [...run.fired, key] }
        }
        if (run.phase === 'timer') {
          cues.push({ key: 'ask', vars: { name: item.name } })
          return { run: finishCard(run, 'cutoff', now), cues }
        }
        return { run, cues }
      }
      const soonAt = startMs - 5 * MIN
      const soonKey = `soon:${f.uid}`
      if (now >= soonAt && !run.fired.includes(soonKey)) {
        run = { ...run, fired: [...run.fired, soonKey] }
        if (now - soonAt < LATE_MS) cues.push({ key: 'fixedSoon', vars: { fixed: f.name, minutes: 5 } })
      }
    }
  }

  // ふつうのカードの時間
  if (run.phase === 'timer' && isRunning(run)) {
    if (elapsedMs(run, now) >= durationMs(run)) {
      cues.push({ key: 'end', vars: { name: item.name } }, { key: 'ask', vars: { name: item.name } })
      return { run: finishCard(run, 'done', now), cues }
    }
    const due = dueEvents(run, now)
    if (due.length) {
      // 遅れたお知らせは、さいごの1つだけ話す（古いものは話さない）
      const last = due[due.length - 1]
      if (elapsedMs(run, now) - last.atMs < LATE_MS) cues.push({ key: last.key, vars: { minutes: last.minutes } })
      run = markFired(run, due)
    }
  }

  // じこくカードの終わり
  if (run.phase === 'fixed') {
    const end = fixedEndOf(item, run.dayStartMs)
    if (now >= end) {
      const closed = patchEntry(run, { endedAt: end, result: 'done' })
      const next = enterFrom(closed, run.index + 1, now)
      return { run: next.run, cues: [{ key: 'end', vars: { name: item.name } }, ...next.cues] }
    }
  }

  return { run, cues }
}
