import { useState } from 'react'
import type { CardDef } from '../types'
import { CARD_COLORS, CARD_EMOJIS, MAX_MINUTES, MIN_MINUTES } from '../cards'
import { formatMinutes } from '../time'
import { Modal } from './Modal'
import { StepButton } from './StepButton'
import { KanaField } from './KanaField'

/** 「＋じぶんでつくる」: 名前・絵文字・色・はじめの時間をきめる */
export function CardEditor({ onSave, onClose }: { onSave: (c: CardDef) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(CARD_EMOJIS[0])
  const [color, setColor] = useState(CARD_COLORS[4])
  const [minutes, setMinutes] = useState(10)

  const clamp = (n: number) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, n))
  const ok = name.trim().length > 0

  return (
    <Modal title="じぶんの カードを つくる" onClose={onClose}>
      <div className="editor-preview">
        <div className="card" style={{ background: color }}>
          <span className="card__emoji">{emoji}</span>
          <span className="card__name">{name || 'なまえ'}</span>
        </div>
      </div>

      <KanaField label="なまえ" value={name} maxLength={10} placeholder="れい: ピアノ" onChange={setName} />

      <div className="field">
        <span>え</span>
        <div className="choice-grid">
          {CARD_EMOJIS.map((e) => (
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

      <div className="field">
        <span>じかん</span>
        <span className="stepper stepper--light">
          <StepButton label="−" ariaLabel="へらす" direction={-1} onStep={(d) => setMinutes((m) => clamp(m + d))} />
          <span className="stepper__value">{formatMinutes(minutes)}</span>
          <StepButton label="＋" ariaLabel="ふやす" direction={1} onStep={(d) => setMinutes((m) => clamp(m + d))} />
        </span>
      </div>

      <button
        type="button"
        className="big-btn big-btn--go"
        disabled={!ok}
        onClick={() =>
          onSave({ id: `custom-${crypto.randomUUID()}`, name: name.trim(), emoji, color, minutes, custom: true })
        }
      >
        つくる
      </button>
    </Modal>
  )
}
