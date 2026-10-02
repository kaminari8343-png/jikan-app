import { useEffect, useRef, useState } from 'react'
import type { RunState } from '../types'
import { say } from '../phrases.logic'
import { speak, speakNow, stopSpeaking } from '../speech'
import { formatMmSs } from '../time'
import {
  EXTEND_MS,
  advance,
  currentItem,
  dueEvents,
  durationMs,
  elapsedMs,
  extend,
  isRunning,
  markFired,
  nextItem,
  pause,
  remainingMs,
  resume,
} from '../runner'
import { useWakeLock } from '../wakeLock'

/** はじまりのセリフ */
export function announceStart(name: string, minutes: number) {
  speak(say('start', { name, minutes }))
}

export function Runner({ run, onChange, onExit }: { run: RunState; onChange: (r: RunState) => void; onExit: () => void }) {
  // 最新の状態を ref にも持つ（タイマーのコールバックから古い値を読まないため）
  const ref = useRef(run)
  ref.current = run
  const [, force] = useState(0)

  const apply = (next: RunState) => {
    ref.current = next
    onChange(next)
  }

  useWakeLock(!run.finished)

  useEffect(() => {
    if (run.finished) return
    const tick = () => {
      let r = ref.current
      const now = Date.now()
      const item = currentItem(r)
      if (!item || !isRunning(r)) return

      if (elapsedMs(r, now) >= durationMs(r)) {
        // カード終了
        const nxt = nextItem(r)
        speak(say('end', { name: item.name }))
        r = advance(r, now)
        if (nxt) {
          speak(say('next', { next: nxt.name }))
          announceStart(nxt.name, nxt.minutes)
        } else {
          speak(say('allDone'))
        }
        apply(r)
        return
      }

      const due = dueEvents(r, now)
      if (due.length) {
        // 画面が止まっていて遅れたお知らせは、さいごの1つだけ話す（20びょうより古いものは話さない）
        const last = due[due.length - 1]
        if (elapsedMs(r, now) - last.atMs < 20_000) {
          speak(say(last.key, { minutes: last.minutes }))
        }
        apply(markFired(r, due))
      }
      force((n) => n + 1)
    }
    tick()
    const id = setInterval(tick, 250)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.finished])

  if (run.finished) {
    return (
      <main className="runner runner--done">
        <div className="done">
          <div className="done__emoji">🎉</div>
          <h1>ぜんぶ おわったよ！</h1>
          <p>すごいね！</p>
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
  const now = Date.now()
  const total = durationMs(run)
  const remaining = remainingMs(run, now)
  const frac = total > 0 ? remaining / total : 0
  const running = isRunning(run)
  const minLeft = Math.ceil(remaining / 60_000)

  const skip = () => {
    const nxt = nextItem(run)
    stopSpeaking()
    if (nxt) announceStart(nxt.name, nxt.minutes)
    else speakNow(say('allDone'))
    apply(advance(run, Date.now()))
  }

  return (
    <main className="runner" style={{ background: `color-mix(in srgb, ${item.color} 28%, #fff6e5)` }}>
      <div className="runner__top">
        <span className="runner__count">
          {run.index + 1} / {run.items.length}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="やめる"
          onClick={() => window.confirm('やめて もどる？') && (stopSpeaking(), onExit())}
        >
          🏠
        </button>
      </div>

      <div className="runner__now">
        <div
          className="pie"
          role="timer"
          aria-label={`のこり ${minLeft}ふん`}
          style={{ background: `conic-gradient(${item.color} 0turn ${frac}turn, #fff ${frac}turn 1turn)` }}
        >
          <div className="pie__inner">
            <span className="pie__emoji">{item.emoji}</span>
            <span className="pie__name">{item.name}</span>
            <span className="pie__time">{formatMmSs(remaining)}</span>
            <span className="pie__label">{running ? 'のこり' : 'いちじていし'}</span>
          </div>
        </div>
      </div>

      <div className="runner__controls">
        <button type="button" className="ctrl" onClick={() => apply(running ? pause(run, Date.now()) : resume(run, Date.now()))}>
          <span>{running ? '⏸️' : '▶️'}</span>
          {running ? 'とめる' : 'つづける'}
        </button>
        <button
          type="button"
          className="ctrl"
          onClick={() => {
            speakNow(say('extended', { minutes: EXTEND_MS / 60_000 }))
            apply(extend(run, Date.now()))
          }}
        >
          <span>➕</span>
          +5ふん
        </button>
        <button type="button" className="ctrl" onClick={skip}>
          <span>⏭️</span>
          スキップ
        </button>
      </div>

      <div className="runner__next">
        {next ? (
          <>
            <span>つぎは</span>
            <span className="next-chip" style={{ background: next.color }}>
              <span className="next-chip__emoji">{next.emoji}</span>
              {next.name}
            </span>
          </>
        ) : (
          <span>これが さいごだよ！</span>
        )}
      </div>
    </main>
  )
}
