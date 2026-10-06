// りれき: 記録の集計・はなまる判定・バックアップ
import type { HistoryEntry, HistorySession, RunState } from './types'

export const WEEKDAYS = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** その日のキー（端末の日付）。例: 2026-10-02 */
export function dateKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function dateKeyOf(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`
}

/** 「スタートした日」ごとにまとめる。同じ日の中は、はじめた順 */
export function groupByDay(sessions: HistorySession[]): Map<string, HistorySession[]> {
  const map = new Map<string, HistorySession[]>()
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const k = dateKey(s.startedAt)
    map.set(k, [...(map.get(k) ?? []), s])
  }
  return map
}

export type DayMark = 'hanamaru' | 'maru' | null

/**
 * はなまるのルール
 * - その日の予定をさいごまでやって、ぜんぶ⭕️ → 花丸
 * - さいごまでやったが、❌がまざっている → 丸
 * - とちゅうでやめた日 → 印なし
 *
 * 1日に何回かスタートしたときは、ぜんぶの回を合わせて見る。
 * ただし、なにも評価しないうちにやめた回（まちがえてスタートしたなど）は数えない。
 * じこくカード・じゆうじかん・じかんぎれ（はじめられなかったカード）は判定に入れない（❌にもしない）。
 */
export function dayMark(sessions: HistorySession[]): DayMark {
  const counted = sessions.filter((s) => s.status === 'finished' || s.entries.some((e) => e.rating !== null))
  if (counted.length === 0) return null
  if (counted.some((s) => s.status !== 'finished')) return null
  // じこくカード・じゆうじかん・じかんぎれは、判定に入れない
  const judged = counted.flatMap((s) => s.entries).filter(isJudged)
  if (judged.length === 0) return null
  return judged.every((e) => e.rating === 'good') ? 'hanamaru' : 'maru'
}

/** はなまるの判定に入れる記録（ふつうのカードで、じかんぎれではないもの） */
export const isJudged = (e: HistoryEntry) => (e.kind ?? 'normal') === 'normal' && e.result !== 'timeout'

/** その日の記録を、時刻順の1本の一覧にする */
export function dayEntries(sessions: HistorySession[]): { session: HistorySession; entry: HistoryEntry }[] {
  return sessions
    .flatMap((session) => session.entries.map((entry) => ({ session, entry })))
    .sort((a, b) => a.entry.startedAt - b.entry.startedAt)
}

/** 月のカレンダー。日曜はじまり。月のはじめ前・おわり後は null */
export function monthGrid(year: number, month0: number): (number | null)[] {
  const first = new Date(year, month0, 1).getDay()
  const days = new Date(year, month0 + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function weekdayOf(year: number, month0: number, day: number): string {
  return WEEKDAYS[new Date(year, month0, day).getDay()]
}

/** 「もうやめた」ときの記録の閉じかた（さいごまで終わっていれば finished） */
export function closeSession(session: HistorySession, phase: RunState['phase']): HistorySession {
  return { ...session, status: phase === 'done' ? 'finished' : 'aborted' }
}

/** 同じ id なら置きかえ、なければ追加 */
export function upsertSession(list: HistorySession[], session: HistorySession): HistorySession[] {
  const i = list.findIndex((s) => s.id === session.id)
  if (i < 0) return [...list, session]
  const next = [...list]
  next[i] = session
  return next
}

// ---- バックアップ（JSON） ----

const BACKUP_APP = 'jikan-app'
const BACKUP_VERSION = 1

export function buildBackup(sessions: HistorySession[], now = Date.now()): string {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now, history: sessions }, null, 2)
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

function parseEntry(v: unknown): HistoryEntry | null {
  if (!v || typeof v !== 'object') return null
  const e = v as Record<string, unknown>
  if (!isStr(e.name) || !isStr(e.emoji) || !isNum(e.plannedMinutes) || !isNum(e.startedAt)) return null
  if (e.endedAt !== null && !isNum(e.endedAt)) return null
  if (e.result !== null && !['done', 'skipped', 'cutoff', 'timeout'].includes(e.result as string)) return null
  if (e.kind !== undefined && !['normal', 'fixed', 'free'].includes(e.kind as string)) return null
  if (e.rating !== null && e.rating !== 'good' && e.rating !== 'bad') return null
  return {
    ...(e.kind !== undefined ? { kind: e.kind as HistoryEntry['kind'] } : {}),
    name: e.name.slice(0, 40),
    emoji: e.emoji.slice(0, 16),
    color: isStr(e.color) && /^#[0-9a-fA-F]{3,8}$/.test(e.color) ? e.color : '#b0bec5',
    plannedMinutes: e.plannedMinutes,
    startedAt: e.startedAt,
    endedAt: e.endedAt as number | null,
    result: e.result as HistoryEntry['result'],
    extensions: isNum(e.extensions) ? Math.max(0, Math.floor(e.extensions)) : 0,
    rating: e.rating as HistoryEntry['rating'],
    ...(e.trial === true ? { trial: true } : {}),
    ...(isNum(e.activeMs) ? { activeMs: e.activeMs } : {}),
    ...(isNum(e.savedMs) ? { savedMs: e.savedMs } : {}),
    ...(isNum(e.coins) ? { coins: Math.max(0, Math.floor(e.coins)) } : {}),
    ...(e.record === true ? { record: true } : {}),
  }
}

function parseSession(v: unknown): HistorySession | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  if (!isStr(s.id) || !isNum(s.startedAt) || !Array.isArray(s.entries)) return null
  if (s.status !== 'running' && s.status !== 'finished' && s.status !== 'aborted') return null
  const entries = s.entries.map(parseEntry)
  if (entries.some((e) => e === null)) return null
  return {
    id: s.id,
    startedAt: s.startedAt,
    // 読みこんだ「じっこう中」は、もう動いていないのでやめた扱いにする
    status: s.status === 'running' ? 'aborted' : s.status,
    entries: entries as HistoryEntry[],
  }
}

export type ParsedBackup = { ok: true; sessions: HistorySession[]; skipped: number } | { ok: false; error: string }

/** 書き出したJSONを検査して読みこむ。こわれたデータは取りこまない */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'ファイルが よめなかったよ' }
  }
  const d = data as { app?: unknown; history?: unknown } | null
  if (!d || typeof d !== 'object' || d.app !== BACKUP_APP || !Array.isArray(d.history)) {
    return { ok: false, error: 'このアプリの きろくファイルじゃないみたい' }
  }
  const sessions: HistorySession[] = []
  let skipped = 0
  for (const raw of d.history) {
    const s = parseSession(raw)
    if (s) sessions.push(s)
    else skipped++
  }
  return { ok: true, sessions, skipped }
}

/** 取りこみ: いまの記録は消さず、ないものだけ足す（同じ id は、いまのを残す） */
export function mergeHistory(current: HistorySession[], incoming: HistorySession[]): { merged: HistorySession[]; added: number } {
  const ids = new Set(current.map((s) => s.id))
  const fresh = incoming.filter((s) => !ids.has(s.id))
  return { merged: [...current, ...fresh].sort((a, b) => a.startedAt - b.startedAt), added: fresh.length }
}
