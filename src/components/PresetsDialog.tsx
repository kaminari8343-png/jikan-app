import { useState } from 'react'
import type { PlanItem, SavedPlan } from '../types'
import { formatMinutes } from '../time'
import { Modal } from './Modal'

/** 「いつものよてい」: よく使う並びをほぞん／よびだし */
export function PresetsDialog({
  current,
  presets,
  onSave,
  onLoad,
  onDelete,
  onClose,
}: {
  current: PlanItem[]
  presets: SavedPlan[]
  onSave: (name: string) => void
  onLoad: (p: SavedPlan) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('いつもの')

  return (
    <Modal title="いつものよてい" onClose={onClose}>
      <div className="field">
        <span>いまの ならびを ほぞんする</span>
        <div className="row">
          <input value={name} maxLength={10} onChange={(e) => setName(e.target.value)} aria-label="ほぞんするなまえ" />
          <button
            type="button"
            className="big-btn big-btn--sub"
            disabled={current.length === 0 || !name.trim()}
            onClick={() => onSave(name.trim())}
          >
            💾 ほぞん
          </button>
        </div>
        {current.length === 0 && <small>さきに カードを ならべてね</small>}
      </div>

      <div className="field">
        <span>ほぞんした よてい</span>
        {presets.length === 0 && <small>まだ ないよ</small>}
        <ul className="preset-list">
          {presets.map((p) => (
            <li key={p.id} className="preset">
              <button type="button" className="preset__main" onClick={() => onLoad(p)}>
                <b>{p.name}</b>
                <span className="preset__items">
                  {p.items.map((i, k) => (
                    <span key={k} title={`${i.name} ${formatMinutes(i.minutes)}`}>
                      {i.emoji}
                    </span>
                  ))}
                </span>
                <span className="preset__go">よびだす</span>
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`${p.name} をけす`}
                onClick={() => window.confirm(`「${p.name}」を けしていい？`) && onDelete(p.id)}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
