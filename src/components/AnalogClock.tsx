interface Props {
  now: Date
  size?: number | string
}

/** 大きなアナログ時計 */
export function AnalogClock({ now, size = '100%' }: Props) {
  const s = now.getSeconds()
  const m = now.getMinutes() + s / 60
  const h = (now.getHours() % 12) + m / 60

  return (
    <svg className="clock" viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="とけい">
      <circle cx="100" cy="100" r="96" fill="#fff" stroke="#ffb84d" strokeWidth="8" />
      {Array.from({ length: 60 }, (_, i) => {
        const big = i % 5 === 0
        return (
          <line
            key={i}
            x1="100"
            y1={big ? 12 : 10}
            x2="100"
            y2={big ? 20 : 15}
            stroke={big ? '#6b4e2e' : '#d9c7ad'}
            strokeWidth={big ? 3 : 1.5}
            strokeLinecap="round"
            transform={`rotate(${i * 6} 100 100)`}
          />
        )
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1
        const a = (n * 30 * Math.PI) / 180
        return (
          <text
            key={n}
            x={100 + Math.sin(a) * 72}
            y={100 - Math.cos(a) * 72}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="22"
            fontWeight="800"
            fill="#6b4e2e"
          >
            {n}
          </text>
        )
      })}
      <line x1="100" y1="100" x2="100" y2="60" stroke="#6b4e2e" strokeWidth="8" strokeLinecap="round" transform={`rotate(${h * 30} 100 100)`} />
      <line x1="100" y1="100" x2="100" y2="34" stroke="#ff7a59" strokeWidth="5" strokeLinecap="round" transform={`rotate(${m * 6} 100 100)`} />
      <line x1="100" y1="112" x2="100" y2="28" stroke="#4aa3ff" strokeWidth="2" strokeLinecap="round" transform={`rotate(${s * 6} 100 100)`} />
      <circle cx="100" cy="100" r="6" fill="#6b4e2e" />
    </svg>
  )
}
