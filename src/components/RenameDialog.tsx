import { useState } from 'react'
import type { PlanItem } from '../types'
import { Modal } from './Modal'

/** 予定に入れたカード 1枚だけの なまえを つける（れい: しゅくだい →「さんすう」） */
export function RenameDialog({ item, onSave, onClose }: { item: PlanItem; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(item.name)
  const ok = name.trim().length > 0
  return (
    <Modal title="なまえを かえる" onClose={onClose}>
      <div className="editor-preview">
        <div className="card" style={{ background: item.color }}>
          <span className="card__emoji">{item.emoji}</span>
          <span className="card__name">{name || 'なまえ'}</span>
        </div>
      </div>
      <label className="field">
        <span>このカードだけの なまえ</span>
        <input value={name} maxLength={12} placeholder="れい: さんすう" onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="hint">ほかの カードは そのまま。こえも「{name.trim() || 'なまえ'}、はじまるよー」と よむよ。</p>
      <button type="button" className="big-btn big-btn--go" disabled={!ok} onClick={() => onSave(name.trim())}>
        これにする
      </button>
    </Modal>
  )
}
