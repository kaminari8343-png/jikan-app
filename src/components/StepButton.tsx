import { useEffect, useRef } from 'react'

interface Props {
  label: string
  ariaLabel: string
  /** delta は +1 / -1（タップ）、+5 / -5（長押しのあいだ くりかえし） */
  onStep: (delta: number) => void
  direction: 1 | -1
  disabled?: boolean
}

const HOLD_MS = 450
const REPEAT_MS = 320

/** −／＋ボタン。タップで1分、長押しで5分ずつ */
export function StepButton({ label, ariaLabel, onStep, direction, disabled }: Props) {
  const holdTimer = useRef<number>(0)
  const repeatTimer = useRef<number>(0)
  const held = useRef(false)
  const stepRef = useRef(onStep)
  stepRef.current = onStep

  const stop = () => {
    clearTimeout(holdTimer.current)
    clearInterval(repeatTimer.current)
  }
  useEffect(() => stop, [])

  const start = (e: React.PointerEvent) => {
    // 親のカードがドラッグを始めないようにする
    e.stopPropagation()
    if (disabled) return
    held.current = false
    stop()
    holdTimer.current = window.setTimeout(() => {
      held.current = true
      stepRef.current(direction * 5)
      repeatTimer.current = window.setInterval(() => stepRef.current(direction * 5), REPEAT_MS)
    }, HOLD_MS)
  }
  const end = (e: React.PointerEvent) => {
    e.stopPropagation()
    const wasHeld = held.current
    const wasActive = holdTimer.current !== 0
    stop()
    holdTimer.current = 0
    if (!wasHeld && wasActive && !disabled && e.type === 'pointerup') stepRef.current(direction)
    held.current = false
  }

  return (
    <button
      type="button"
      className="step-btn"
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // キーボード操作（detail === 0）のときだけ、ここで1分動かす
        if (e.detail === 0 && !disabled) onStep(direction)
      }}
    >
      {label}
    </button>
  )
}
