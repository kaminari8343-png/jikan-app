import { useMemo, useState } from 'react'
import type { HistoryEntry, HistorySession } from '../types'
import { dateKey, dateKeyOf, dayEntries, dayMark, groupByDay, monthGrid, weekdayOf, WEEKDAYS, type DayMark } from '../history'
import { formatMinutes } from '../time'

const MARK_ICON: Record<Exclude<DayMark, null>, string> = { hanamaru: '💮', maru: '⭕' }

/** 12時間表記の「4:00」 */
function hm(ms: number) {
  const d = new Date(ms)
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function HistoryScreen({ sessions, now, onBack }: { sessions: HistorySession[]; now: Date; onBack: () => void }) {
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(dateKey(now.getTime()))
  const days = useMemo(() => groupByDay(sessions), [sessions])
  const cells = monthGrid(year, month)
  const todayKey = dateKey(now.getTime())

  const move = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const [sy, sm, sd] = selected.split('-').map(Number)
  const selSessions = days.get(selected) ?? []
  const list = dayEntries(selSessions)

  return (
    <main className="app history">
      <header className="top">
        <h1>りれき</h1>
        <button type="button" className="pill-btn" onClick={onBack}>
          🏠 もどる
        </button>
      </header>

      <section className="cal" aria-label="カレンダー">
        <div className="cal__head">
          <button type="button" className="icon-btn" aria-label="まえの つき" onClick={() => move(-1)}>
            ◀
          </button>
          <h2>
            {year}ねん {month + 1}がつ
          </h2>
          <button type="button" className="icon-btn" aria-label="つぎの つき" onClick={() => move(1)}>
            ▶
          </button>
        </div>
        <div className="cal__grid">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`cal__wd${i === 0 ? ' cal__wd--sun' : i === 6 ? ' cal__wd--sat' : ''}`}>
              {w}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />
            const key = dateKeyOf(year, month, day)
            const daySessions = days.get(key)
            const mark = daySessions ? dayMark(daySessions) : null
            return (
              <button
                key={i}
                type="button"
                className={`cal__day${key === selected ? ' cal__day--sel' : ''}${key === todayKey ? ' cal__day--today' : ''}`}
                aria-label={`${month + 1}がつ${day}にち${mark === 'hanamaru' ? ' はなまる' : mark === 'maru' ? ' まる' : ''}`}
                onClick={() => setSelected(key)}
              >
                <span className="cal__num">{day}</span>
                <span className="cal__mark" aria-hidden>
                  {mark ? MARK_ICON[mark] : daySessions ? '・' : ''}
                </span>
              </button>
            )
          })}
        </div>
        <p className="cal__legend">
          💮 ぜんぶ ⭕でおわった　⭕ ❌が まざってた　・ とちゅうで やめた　（じこくカード・じゆうじかん・じかんぎれは かぞえないよ）
        </p>
      </section>

      <section className="day" aria-label="えらんだ ひの きろく">
        <h2 className="day__title">
          {sm}がつ{sd}にち（{weekdayOf(sy, sm - 1, sd)}ようび）
        </h2>
        {list.length === 0 ? (
          <p className="day__empty">この ひの きろくは ないよ</p>
        ) : (
          <ul className="day__list">
            {list.map(({ session, entry }, i) => (
              <li key={`${session.id}-${i}`}>
                {(i === 0 || list[i - 1].session.id !== session.id) && selSessions.length > 1 && (
                  <div className="day__session">
                    {selSessions.indexOf(session) + 1}かいめ（{hm(session.startedAt)}から）
                    {session.status !== 'finished' && <b> とちゅうで やめた</b>}
                  </div>
                )}
                <EntryRow entry={entry} />
              </li>
            ))}
          </ul>
        )}
        {selSessions.length === 1 && selSessions[0].status !== 'finished' && list.length > 0 && (
          <p className="day__note">とちゅうで やめたよ</p>
        )}
      </section>
    </main>
  )
}

function EntryRow({ entry }: { entry: HistoryEntry }) {
  const kind = entry.kind ?? 'normal'
  const timeout = entry.result === 'timeout'
  const judged = kind === 'normal' && !timeout
  return (
    <div className={`entry${kind === 'fixed' ? ' entry--fixed' : ''}${kind === 'free' ? ' entry--free' : ''}${timeout ? ' entry--timeout' : ''}`} style={{ borderLeftColor: entry.color }}>
      <div className="entry__main">
        <span className="entry__time">
          {timeout ? 'じかんぎれ' : `${hm(entry.startedAt)}〜${entry.endedAt != null ? hm(entry.endedAt) : ''}`}
        </span>
        <span className="entry__emoji">{entry.emoji}</span>
        <span className="entry__name">
          {kind === 'fixed' && '📌 '}
          {entry.name}
        </span>
        {judged && (
          <span className="entry__rating" aria-label={entry.rating === 'good' ? 'まる' : entry.rating === 'bad' ? 'ばつ' : 'つけてない'}>
            {entry.rating === 'good' ? '⭕' : entry.rating === 'bad' ? '❌' : '−'}
          </span>
        )}
      </div>
      <div className="entry__chips">
        {kind === 'free' && <span className="chip chip--free">じゆうじかん</span>}
        {kind === 'fixed' && <span className="chip chip--fixed">じこくカード</span>}
        {kind === 'fixed' && entry.plannedMinutes > 0 && <span className="chip">{formatMinutes(entry.plannedMinutes)}</span>}
        {kind === 'normal' && <span className="chip">よてい {formatMinutes(entry.plannedMinutes)}</span>}
        {timeout && <span className="chip chip--skip">はじめられなかった</span>}
        {kind === 'normal' && entry.result === 'skipped' && <span className="chip chip--skip">スキップ</span>}
        {kind === 'normal' && entry.result === 'done' && <span className="chip chip--done">さいごまで やった</span>}
        {kind === 'normal' && entry.result === 'cutoff' && <span className="chip chip--skip">じこくカードで ちゅうだん</span>}
        {kind === 'normal' && entry.result === null && <span className="chip chip--skip">とちゅうで やめた</span>}
        {entry.extensions > 0 && <span className="chip">+5ふん × {entry.extensions}</span>}
      </div>
    </div>
  )
}
