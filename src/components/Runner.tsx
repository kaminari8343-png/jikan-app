import { useEffect, useRef, useState } from 'react'
import type { Rating, RunState } from '../types'
import { speakCues } from '../cues'
import { speak, stopSpeaking } from '../speech'
import { say } from '../phrases.logic'
import { formatMinOfDay, formatMmSs } from '../time'
import {
  canExtend,
  currentItem,
  durationMs,
  extendCard,
  isRunning,
  nextItem,
  pause,
  phaseCountdown,
  rateCard,
  remainingMs,
  resume,
  skipCard,
  tick,
  upcomingFixed,
} from '../runner'
import { isFixed, runSectors } from '../schedule'
import { useWakeLock } from '../wakeLock'
import { AnalogClock } from './AnalogClock'

interface PieProps {
  color: string
  emoji: string
  name: string
  timeText: string
  label: string
  /** のこりの わりあい（0〜1） */
  frac: number
  ariaLabel: string
}

/** 円が減っていくビジュアルタイマー */
function PieTimer({ color, emoji, name, timeText, label, frac, ariaLabel }: PieProps) {
  return (
    <div
      className="pie"
      role="timer"
      aria-label={ariaLabel}
      style={{ background: `conic-gradient(${color} 0turn ${frac}turn, #fff ${frac}turn 1turn)` }}
    >
      <div className="pie__inner">
        <span className="pie__emoji">{emoji}</span>
        <span className="pie__name">{name}</span>
        <span className="pie__time">{timeText}</span>
        <span className="pie__label">{label}</span>
      </div>
    </div>
  )
}

export function Runner({ run, onChange, onExit }: { run: RunState; onChange: (r: RunState) => void; onExit: () => void }) {
  // 最新の状態を ref にも持つ（タイマーのコールバックから古い値を読まないため）
  const ref = useRef(run)
  ref.current = run
  const [, force] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<number>(0)

  const apply = (next: RunState) => {
    ref.current = next
    onChange(next)
  }
  const quit = () => window.confirm('やめて もどる？') && (stopSpeaking(), onExit())

  useWakeLock(run.phase !== 'done')
  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  useEffect(() => {
    if (run.phase === 'done') return
    const loop = () => {
      const step = tick(ref.current, Date.now())
      if (step.run !== ref.current) apply(step.run)
      if (step.cues.length) speakCues(step.cues)
      force((n) => n + 1)
    }
    loop()
    const id = setInterval(loop, 250)
    const onVisible = () => document.visibilityState === 'visible' && loop()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.phase === 'done'])

  const nowMs = Date.now()

  if (run.phase === 'done') {
    const endOfDay = run.session.entries.some((e) => e.kind === 'fixed' && e.plannedMinutes === 0)
    return (
      <main className="runner runner--done">
        <div className="done">
          <div className="done__emoji">{endOfDay ? '🌙' : '🎉'}</div>
          <h1>{endOfDay ? 'おやすみなさい' : 'ぜんぶ おわったよ！'}</h1>
          <p>{endOfDay ? 'きょうも おつかれさま' : 'すごいね！'}</p>
          <div className="done__items">
            {run.items.map((i) => (
              <span key={i.uid}>{i.emoji}</span>
            ))}
          </div>
          <button type="button" className="big-btn big-btn--go" onClick={onExit}>
            🏠 もどる
          </button>
        </div>
      </main>
    )
  }

  const item = currentItem(run)!
  const next = nextItem(run)
  const up = upcomingFixed(run)
  const sectors = runSectors(run, nowMs)
  const bg = { background: `color-mix(in srgb, ${item.color} 28%, #fff6e5)` }

  const top = (
    <div className="runner__top">
      <span className="runner__count">
        {run.index + 1} / {run.items.length}
      </span>
      <button type="button" className="icon-btn" aria-label="やめる" onClick={quit}>
        🏠
      </button>
    </div>
  )

  const nextChip = (it: typeof next, lead = 'つぎは') =>
    it ? (
      <div className="runner__next">
        <span>{lead}</span>
        <span className="next-chip" style={{ background: it.color }}>
          <span className="next-chip__emoji">{it.emoji}</span>
          {isFixed(it) && '📌 '}
          {it.name}
          {isFixed(it) && <small>{formatMinOfDay(it.startMin ?? 0)}</small>}
        </span>
      </div>
    ) : (
      <div className="runner__next">
        <span>これが さいごだよ！</span>
      </div>
    )

  const clock = (
    <div className="runner__clock">
      <AnalogClock now={new Date(nowMs)} sectors={sectors} />
    </div>
  )

  // ⭕️❌をえらぶ
  if (run.phase === 'rate') {
    const rate = (rating: Rating) => {
      const step = rateCard(run, rating, Date.now())
      speakCues(step.cues, { interrupt: true })
      apply(step.run)
    }
    const due = up && nowMs >= up.startMs ? up.item : null
    return (
      <main className="runner" style={bg}>
        {top}
        {due && (
          <div className="fixed-banner" role="alert">
            <span>⏰</span>
            <b>
              {formatMinOfDay(due.startMin ?? 0)}だよ！ {due.emoji} {due.name}の じかんだよ
            </b>
          </div>
        )}
        <div className="rate">
          <div className="rate__card" style={{ background: item.color }}>
            <span className="rate__emoji">{item.emoji}</span>
            <span className="rate__name">{item.name}</span>
          </div>
          <h1 className="rate__title">どうだった？</h1>
          <p className="rate__sub">じぶんで つけてみよう</p>
          <div className="rate__buttons">
            <button type="button" className="rate-btn rate-btn--good" onClick={() => rate('good')}>
              <span>⭕</span>
              <small>まる</small>
            </button>
            <button type="button" className="rate-btn rate-btn--bad" onClick={() => rate('bad')}>
              <span>❌</span>
              <small>ばつ</small>
            </button>
          </div>
        </div>
      </main>
    )
  }

  // じゆうじかん（つぎのじこくカードまで）
  if (run.phase === 'free') {
    const cd = phaseCountdown(run, nowMs)!
    return (
      <main className="runner" style={{ background: 'color-mix(in srgb, #bfe8d0 40%, #fff6e5)' }}>
        {top}
        <div className="runner__body">
          {clock}
          <PieTimer
            color="#8fd3b6"
            emoji="🕊️"
            name="じゆうじかん"
            timeText={formatMmSs(cd.remainingMs)}
            label={`${item.name}まで`}
            frac={cd.remainingMs / cd.totalMs}
            ariaLabel={`${item.name}まで あと ${Math.ceil(cd.remainingMs / 60_000)}ふん`}
          />
        </div>
        <p className="runner__hint">すきな ことを して いいよ</p>
        {nextChip(item)}
      </main>
    )
  }

  // じこくカードの最中
  if (run.phase === 'fixed') {
    const cd = phaseCountdown(run, nowMs)!
    return (
      <main className="runner" style={bg}>
        {top}
        <div className="runner__body">
          {clock}
          <PieTimer
            color={item.color}
            emoji={item.emoji}
            name={`📌 ${item.name}`}
            timeText={formatMmSs(cd.remainingMs)}
            label="のこり"
            frac={cd.remainingMs / cd.totalMs}
            ariaLabel={`${item.name} のこり ${Math.ceil(cd.remainingMs / 60_000)}ふん`}
          />
        </div>
        {nextChip(next)}
      </main>
    )
  }

  // ふつうのカードのタイマー
  const total = durationMs(run)
  const remaining = remainingMs(run, nowMs)
  const running = isRunning(run)
  const extendable = canExtend(run, nowMs)

  const extend = () => {
    const step = extendCard(run, Date.now())
    speakCues(step.cues, { interrupt: true })
    if (step.run !== run) apply(step.run)
    else if (!extendable.ok) {
      setNotice(say('cannotExtend', { fixed: extendable.fixed.name }))
      clearTimeout(noticeTimer.current)
      noticeTimer.current = window.setTimeout(() => setNotice(null), 4000)
    }
  }
  const skip = () => {
    const step = skipCard(run, Date.now())
    stopSpeaking()
    step.cues.forEach((c) => speak(say(c.key, c.vars)))
    apply(step.run)
  }

  return (
    <main className="runner" style={bg}>
      {top}
      {up && (
        <p className="runner__until">
          📌 {up.item.name}（{formatMinOfDay(up.item.startMin ?? 0)}）まで あと {Math.max(0, Math.ceil((up.startMs - nowMs) / 60_000))}ふん
        </p>
      )}
      <div className="runner__body">
        {clock}
        <PieTimer
          color={item.color}
          emoji={item.emoji}
          name={item.name}
          timeText={formatMmSs(remaining)}
          label={running ? 'のこり' : 'いちじていし'}
          frac={total > 0 ? remaining / total : 0}
          ariaLabel={`のこり ${Math.ceil(remaining / 60_000)}ふん`}
        />
      </div>

      {notice && (
        <p className="runner__notice" role="status">
          🙅 {notice}
        </p>
      )}

      <div className="runner__controls">
        <button type="button" className="ctrl" onClick={() => apply(running ? pause(run, Date.now()) : resume(run, Date.now()))}>
          <span>{running ? '⏸️' : '▶️'}</span>
          {running ? 'とめる' : 'つづける'}
        </button>
        <button type="button" className={`ctrl${extendable.ok ? '' : ' ctrl--blocked'}`} aria-disabled={!extendable.ok} onClick={extend}>
          <span>➕</span>
          +5ふん
        </button>
        <button type="button" className="ctrl" onClick={skip}>
          <span>⏭️</span>
          スキップ
        </button>
      </div>
      {nextChip(next)}
    </main>
  )
}
