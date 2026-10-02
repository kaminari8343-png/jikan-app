import { dialAngle, type Sector } from '../schedule'

interface Props {
  now: Date
  size?: number | string
  /** 予定ごとの色の扇形（円グラフ） */
  sectors?: Sector[]
}

const R = 90

const point = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180
  return [100 + Math.sin(a) * r, 100 - Math.cos(a) * r] as const
}

/** 扇形のパス。12時間以上なら、ひとまわり */
function sectorPath(s: Sector): string | null {
  const span = Math.min((s.endMs - s.startMs) / 60_000, 719.9) / 720 * 360
  if (span < 0.3) return null
  const a0 = dialAngle(s.startMs)
  const [x0, y0] = point(a0)
  const [x1, y1] = point(a0 + span)
  return `M100 100 L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${span > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
}

/** 大きなアナログ時計。文字盤に、予定ごとの色の扇形をかさねる */
export function AnalogClock({ now, size = '100%', sectors = [] }: Props) {
  const s = now.getSeconds()
  const m = now.getMinutes() + s / 60
  const h = (now.getHours() % 12) + m / 60
  const hasActive = sectors.some((x) => x.active)

  return (
    <svg className="clock" viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="とけい">
      <circle cx="100" cy="100" r="96" fill="#fff" stroke="#ffb84d" strokeWidth="8" />
      <g className="clock__sectors">
        {sectors.map((sec, i) => {
          const d = sectorPath(sec)
          if (!d) return null
          const strong = sec.active
          return (
            <path
              key={i}
              d={d}
              fill={sec.color}
              fillOpacity={sec.kind === 'free' ? 0.45 : strong ? 0.95 : hasActive ? 0.42 : 0.65}
              stroke={strong ? '#6b4e2e' : '#fff'}
              strokeWidth={strong ? 2.5 : 1}
              strokeLinejoin="round"
            />
          )
        })}
      </g>
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
            stroke="#fff"
            strokeWidth="3"
            paintOrder="stroke"
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
