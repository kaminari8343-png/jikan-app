import { useState } from 'react'
import type { CardDef, DayType, FixedCard, TemplateItem, Templates, Vacation } from '../types'
import { DAY_LABEL } from '../calendar'
import { WEEKDAYS } from '../history'
import { formatMinOfDayAp, formatSpan, inputToMinOfDay, minOfDayToInput } from '../time'
import {
  addFixedToTemplate,
  hasWeekdayOverride,
  insertTemplateNormal,
  isEnd,
  moveTemplateItem,
  removeTemplateItem,
  templateFor,
  updateTemplateFixed,
  updateTemplateMinutes,
} from '../templates'
import { Modal } from './Modal'
import { StepButton } from './StepButton'

const MAX_LEN = 600

/** どだい（がっこうの日・やすみの日）と、曜日ごとの上書き、ながい やすみ の せってい（おうちのひと用） */
export function TemplatesDialog({
  templates,
  onTemplates,
  fixedCards,
  cards,
  vacations,
  onVacations,
  onClose,
}: {
  templates: Templates
  onTemplates: (t: Templates) => void
  fixedCards: FixedCard[]
  cards: CardDef[]
  vacations: Vacation[]
  onVacations: (v: Vacation[]) => void
  onClose: () => void
}) {
  const [type, setType] = useState<DayType>('school')
  /** null = ふだん / 0〜6 = その曜日だけ */
  const [wd, setWd] = useState<number | null>(null)

  const overridden = wd !== null && hasWeekdayOverride(templates, type, wd)
  const items: TemplateItem[] = wd === null ? templates[type] : templateFor(templates, type, wd)

  const setItems = (next: TemplateItem[]) => {
    if (wd === null) onTemplates({ ...templates, [type]: next })
    else onTemplates({ ...templates, weekday: { ...templates.weekday, [type]: { ...templates.weekday[type], [String(wd)]: next } } })
  }
  const resetWeekday = () => {
    if (wd === null) return
    const rest = { ...templates.weekday[type] }
    delete rest[String(wd)]
    onTemplates({ ...templates, weekday: { ...templates.weekday, [type]: rest } })
  }

  const usedFixed = new Set(items.filter((i) => i.kind === 'fixed').map((i) => i.cardId))
  const addableFixed = fixedCards.filter((c) => !usedFixed.has(c.id)).sort((a, b) => a.startMin - b.startMin)
  const normalCards = cards

  const insertSelect = (beforeIndex: number) => (
    <select
      className="slot-select"
      aria-label="ここに カードを いれる"
      value=""
      onChange={(e) => {
        const c = normalCards.find((x) => x.id === e.target.value)
        if (c) setItems(insertTemplateNormal(items, c, beforeIndex))
      }}
    >
      <option value="">＋ ここに カードを いれる</option>
      {normalCards.map((c) => (
        <option key={c.id} value={c.id}>
          {c.emoji} {c.name}（{formatSpan(c.minutes)}）
        </option>
      ))}
    </select>
  )

  return (
    <Modal title="どだいと ながい やすみ" onClose={onClose}>
      <div className="tabs" role="tablist">
        {(['school', 'holiday'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={type === t} className={`tab${type === t ? ' tab--on' : ''}`} onClick={() => { setType(t); setWd(null) }}>
            {t === 'school' ? '📚' : '🏖️'} {DAY_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="field">
        <span>どの ひの どだい？</span>
        <div className="wd-chips">
          <button type="button" className={`chip-btn${wd === null ? ' chip-btn--on' : ''}`} onClick={() => setWd(null)}>
            ふだん
          </button>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button key={d} type="button" className={`chip-btn${wd === d ? ' chip-btn--on' : ''}`} onClick={() => setWd(d)} aria-label={`${WEEKDAYS[d]}ようび`}>
              {WEEKDAYS[d]}
              {hasWeekdayOverride(templates, type, d) && <span className="chip-btn__dot">●</span>}
            </button>
          ))}
        </div>
        {wd !== null && (
          <small>
            {overridden
              ? `${WEEKDAYS[wd]}ようびだけの ちがう どだいを つかっているよ（●）`
              : `いまは「ふだん」と おなじ。さわると ${WEEKDAYS[wd]}ようびだけの どだいに なるよ`}
          </small>
        )}
        {overridden && (
          <button type="button" className="link-btn" onClick={() => window.confirm('ふだんの どだいに もどす？') && resetWeekday()}>
            ふだんの どだいに もどす
          </button>
        )}
      </div>

      <div className="tpl-list">
        {items.map((it, idx) => {
          const fixed = it.kind === 'fixed'
          const end = fixed && isEnd(it)
          const moment = fixed && !end && it.minutes === 0
          return (
            <div key={`${it.cardId}-${idx}`}>
              {fixed && insertSelect(idx)}
              <div className={`tpl-row${fixed ? ' tpl-row--fixed' : ''}`} style={{ borderLeftColor: it.color }}>
                <span className="tpl-row__name">
                  {fixed && '📌 '}
                  <span className="tpl-row__emoji">{it.emoji}</span> {it.name}
                  {it.quiet && ' 🔕'}
                  {it.leaving && ' 🚪'}
                </span>
                {fixed ? (
                  <>
                    <input
                      type="time"
                      className="time-input time-input--small"
                      aria-label={`${it.name} のじこく`}
                      value={minOfDayToInput(it.startMin ?? 0)}
                      onChange={(e) => {
                        const v = inputToMinOfDay(e.target.value)
                        if (v !== null) setItems(updateTemplateFixed(items, idx, { startMin: v }))
                      }}
                    />
                    {end ? (
                      <small className="tpl-row__note">1日の おわり</small>
                    ) : moment ? (
                      <small className="tpl-row__note">じこくだけ</small>
                    ) : (
                      <>
                        <span className="tpl-row__to">〜</span>
                        <input
                          type="time"
                          className="time-input time-input--small"
                          aria-label={`${it.name} のおわる じこく`}
                          value={minOfDayToInput(((it.startMin ?? 0) + it.minutes) % 1440)}
                          onChange={(e) => {
                            const v = inputToMinOfDay(e.target.value)
                            if (v === null) return
                            const len = v - (it.startMin ?? 0)
                            if (len >= 1) setItems(updateTemplateFixed(items, idx, { minutes: Math.min(MAX_LEN, len) }))
                          }}
                        />
                        <small className="tpl-row__note">（{formatSpan(it.minutes)}）</small>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="stepper stepper--light stepper--small">
                      <StepButton label="−" ariaLabel={`${it.name} へらす`} direction={-1} onStep={(d) => setItems(updateTemplateMinutes(items, idx, Math.min(MAX_LEN, Math.max(1, it.minutes + d))))} />
                      <span className="stepper__value">{formatSpan(it.minutes)}</span>
                      <StepButton label="＋" ariaLabel={`${it.name} ふやす`} direction={1} onStep={(d) => setItems(updateTemplateMinutes(items, idx, Math.min(MAX_LEN, Math.max(1, it.minutes + d))))} />
                    </span>
                    <button type="button" className="mini-btn" aria-label={`${it.name} をうえへ`} onClick={() => setItems(moveTemplateItem(items, idx, -1))}>
                      ▲
                    </button>
                    <button type="button" className="mini-btn" aria-label={`${it.name} をしたへ`} onClick={() => setItems(moveTemplateItem(items, idx, 1))}>
                      ▼
                    </button>
                  </>
                )}
                <button type="button" className="mini-btn" aria-label={`${it.name} をけす`} onClick={() => setItems(removeTemplateItem(items, idx))}>
                  ✕
                </button>
              </div>
              {fixed && !end && !moment && (
                <small className="tpl-row__time">
                  {formatMinOfDayAp(it.startMin ?? 0)} 〜 {formatMinOfDayAp(((it.startMin ?? 0) + it.minutes) % 1440)}
                </small>
              )}
            </div>
          )
        })}
        {insertSelect(items.length)}
      </div>

      <div className="field">
        <span>📌 じこくカードを ついか</span>
        <select
          className="slot-select"
          aria-label="じこくカードを ついか"
          value=""
          onChange={(e) => {
            const c = fixedCards.find((x) => x.id === e.target.value)
            if (c) setItems(addFixedToTemplate(items, c))
          }}
        >
          <option value="">＋ じこくカードを えらぶ</option>
          {addableFixed.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}（{formatMinOfDayAp(c.startMin)}）
            </option>
          ))}
        </select>
        <small>じこくカードの つくりかた・なおしかたは「せってい」の じこくカードで</small>
      </div>

      <VacationEditor vacations={vacations} onChange={onVacations} />
    </Modal>
  )
}

/** なつやすみ など、ながい やすみ（その期間は ぜんぶ やすみの日） */
function VacationEditor({ vacations, onChange }: { vacations: Vacation[]; onChange: (v: Vacation[]) => void }) {
  const [name, setName] = useState('なつやすみ')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const ok = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to

  return (
    <div className="field">
      <span>🏖️ ながい やすみ（なつやすみ など）</span>
      <small>この きかんは、ぜんぶ「やすみの日」になります</small>
      <ul className="preset-list">
        {[...vacations]
          .sort((a, b) => a.from.localeCompare(b.from))
          .map((v) => (
            <li key={v.id} className="preset">
              <span className="preset__main preset__main--static">
                <b>{v.name}</b>
                <small>
                  {v.from} 〜 {v.to}
                </small>
              </span>
              <button type="button" className="icon-btn" aria-label={`${v.name} をけす`} onClick={() => window.confirm(`「${v.name}」を けしていい？`) && onChange(vacations.filter((x) => x.id !== v.id))}>
                🗑️
              </button>
            </li>
          ))}
      </ul>
      <input value={name} maxLength={10} aria-label="やすみの なまえ" onChange={(e) => setName(e.target.value)} />
      <div className="row">
        <label className="date-field">
          <small>はじまり</small>
          <input type="date" className="time-input" aria-label="やすみの はじまり" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="date-field">
          <small>おわり</small>
          <input type="date" className="time-input" aria-label="やすみの おわり" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <button
        type="button"
        className="big-btn big-btn--sub"
        disabled={!ok}
        onClick={() => {
          onChange([...vacations, { id: crypto.randomUUID(), name: name.trim(), from, to }])
          setFrom('')
          setTo('')
        }}
      >
        ＋ ながい やすみを ついか
      </button>
    </div>
  )
}
