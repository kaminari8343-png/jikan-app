import { useState } from 'react'
import type { FixedCard } from '../types'
import { CARD_COLORS } from '../cards'
import { formatMinOfDayAp, formatMinutes, inputToMinOfDay, minOfDayToInput } from '../time'
import { Modal } from './Modal'
import { StepButton } from './StepButton'

const FIXED_EMOJIS = ['🍚', '🛁', '😴', '🦷', '🚿', '🌙', '📺', '🍎', '🎹', '🏊', '🚌', '🏫', '🎒', '📚', '⏰', '🧹']
const MAX_LEN = 600

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
  const [mode, setMode] = useState<'span' | 'moment' | 'end'>(
    !initial ? 'span' : initial.minutes > 0 ? 'span' : (initial.endOfDay ?? true) ? 'end' : 'moment',
  )
  const [quiet, setQuiet] = useState(!!initial?.quiet)
  const [leaving, setLeaving] = useState(!!initial?.leaving)
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
          <span className="card__sub">{formatMinOfDayAp(startMin)}{mode === 'end' ? 'から' : mode === 'span' ? '〜' : ''}</span>
        </div>
      </div>

      <label className="field">
        <span>なまえ</span>
        <input value={name} maxLength={10} placeholder="れい: ゆうごはん" onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="field">
        <span>はじまる じこく（ふだんの じこく）</span>
        <input
          type="time"
          className="time-input"
          value={minOfDayToInput(startMin)}
          onChange={(e) => {
            const v = inputToMinOfDay(e.target.value)
            if (v !== null) setStartMin(v)
          }}
        />
        <small>よていに ならべたときの はじめの じこくです。まいにちの どだいの じこくは「どだい」で かえます</small>
      </label>

      <div className="field">
        <span>ながさ</span>
        <div className="radio-group">
          {(
            [
              ['span', 'ながさが ある', 'れい: ゆうごはん 30ぷん'],
              ['moment', 'じこくだけ', 'れい: おきる、いえをでる'],
              ['end', '1日の おわり', 'れい: ねる'],
            ] as const
          ).map(([v, label, hint]) => (
            <label key={v} className={`radio${mode === v ? ' radio--on' : ''}`}>
              <input type="radio" name="len-mode" checked={mode === v} onChange={() => setMode(v)} />
              <b>{label}</b>
              <small>{hint}</small>
            </label>
          ))}
        </div>
        {mode === 'span' && (
          <span className="stepper stepper--light">
            <StepButton label="−" ariaLabel="へらす" direction={-1} onStep={(d) => setMinutes((m) => clamp(m + d))} />
            <span className="stepper__value">{formatMinutes(minutes)}</span>
            <StepButton label="＋" ariaLabel="ふやす" direction={1} onStep={(d) => setMinutes((m) => clamp(m + d))} />
          </span>
        )}
      </div>

      <div className="field">
        <span>おしらせ</span>
        <label className="toggle">
          <input type="checkbox" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} />
          <span>🔕 しずか（はじまり・おわりを しゃべらない。5ふんまえは しゃべる）</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={leaving} onChange={(e) => setLeaving(e.target.checked)} />
          <span>🚪 でかけるカード（10・5・1ぷんまえに しらせて、「いってらっしゃい！」）</span>
        </label>
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
            minutes: mode === 'span' ? minutes : 0,
            quiet,
            leaving,
            endOfDay: mode === 'end',
          })
        }
      >
        {initial ? 'ほぞん' : 'つくる'}
      </button>
    </Modal>
  )
}
