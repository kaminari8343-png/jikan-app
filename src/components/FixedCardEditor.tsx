import { useState } from 'react'
import type { FixedCard } from '../types'
import { CARD_COLORS } from '../cards'
import { formatMinOfDay, formatMinutes, inputToMinOfDay, minOfDayToInput } from '../time'
import { Modal } from './Modal'
import { StepButton } from './StepButton'

const FIXED_EMOJIS = ['🍚', '🛁', '😴', '🦷', '🚿', '🌙', '📺', '🍎', '🎹', '🏊', '🚌', '🏫', '🎒', '📚', '⏰', '🧹']
const MAX_LEN = 240

/** じこくカードの追加・編集（親が設定画面から開く） */
export function FixedCardEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: FixedCard | null
  onSave: (c: FixedCard) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? FIXED_EMOJIS[0])
  const [color, setColor] = useState(initial?.color ?? CARD_COLORS[1])
  const [startMin, setStartMin] = useState(initial?.startMin ?? 18 * 60)
  const [noLength, setNoLength] = useState(initial ? initial.minutes === 0 : false)
  const [minutes, setMinutes] = useState(initial && initial.minutes > 0 ? initial.minutes : 30)

  const clamp = (n: number) => Math.min(MAX_LEN, Math.max(1, n))
  const ok = name.trim().length > 0

  return (
    <Modal title={initial ? 'じこくカードを なおす' : 'じこくカードを つくる'} onClose={onClose}>
      <div className="editor-preview">
        <div className="card card--fixed" style={{ background: color }}>
          <span className="card__pin">📌</span>
          <span className="card__emoji">{emoji}</span>
          <span className="card__name">{name || 'なまえ'}</span>
          <span className="card__sub">{formatMinOfDay(startMin)}{noLength ? 'から' : '〜'}</span>
        </div>
      </div>

      <label className="field">
        <span>なまえ</span>
        <input value={name} maxLength={10} placeholder="れい: ゆうごはん" onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="field">
        <span>はじまる じこく</span>
        <input
          type="time"
          className="time-input"
          value={minOfDayToInput(startMin)}
          onChange={(e) => {
            const v = inputToMinOfDay(e.target.value)
            if (v !== null) setStartMin(v)
          }}
        />
      </label>

      <div className="field">
        <span>ながさ</span>
        <label className="toggle">
          <input type="checkbox" checked={noLength} onChange={(e) => setNoLength(e.target.checked)} />
          <span>ながさなし（1日の おわり。れい: ねる）</span>
        </label>
        {!noLength && (
          <span className="stepper stepper--light">
            <StepButton label="−" ariaLabel="へらす" direction={-1} onStep={(d) => setMinutes((m) => clamp(m + d))} />
            <span className="stepper__value">{formatMinutes(minutes)}</span>
            <StepButton label="＋" ariaLabel="ふやす" direction={1} onStep={(d) => setMinutes((m) => clamp(m + d))} />
          </span>
        )}
      </div>

      <div className="field">
        <span>え</span>
        <div className="choice-grid">
          {FIXED_EMOJIS.map((e) => (
            <button key={e} type="button" className={`choice${e === emoji ? ' choice--on' : ''}`} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>いろ</span>
        <div className="choice-grid">
          {CARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`いろ ${c}`}
              className={`choice choice--color${c === color ? ' choice--on' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="big-btn big-btn--go"
        disabled={!ok}
        onClick={() =>
          onSave({
            id: initial?.id ?? `fixed-${crypto.randomUUID()}`,
            name: name.trim(),
            emoji,
            color,
            startMin,
            minutes: noLength ? 0 : minutes,
          })
        }
      >
        {initial ? 'ほぞん' : 'つくる'}
      </button>
    </Modal>
  )
}
