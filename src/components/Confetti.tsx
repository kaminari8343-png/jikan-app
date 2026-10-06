import { useMemo } from 'react'

const COLORS = ['#ff6b6b', '#ffd84d', '#4dd0e1', '#8fd3b6', '#c4a1ff', '#ff9eb5', '#8ab4ff']

/** 紙ふぶき。画面の上から ひらひら おちて、さいごは きえる（さわれない・音なし） */
export function Confetti({ count = 44 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.8 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
        rot: Math.floor(Math.random() * 360),
        w: 8 + Math.floor(Math.random() * 8),
      })),
    [count],
  )
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti__piece"
          style={{ left: `${p.left}%`, width: p.w, height: p.w * 1.6, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }}
        />
      ))}
    </div>
  )
}
