import type { DayInfo } from '../calendar'
import { DAY_LABEL } from '../calendar'
import type { DayType } from '../types'
import { weekdayOf } from '../history'

export type DayTab = 'today' | 'tomorrow'

/** 「きょう／あした」のタブと、がっこうの日・やすみの日の表示（その日だけ手動で切りかえもできる） */
export function DayBar({
  tab,
  onTab,
  dateKey,
  info,
  onChangeType,
  onRebuild,
  planType,
}: {
  tab: DayTab
  onTab: (t: DayTab) => void
  dateKey: string
  info: DayInfo
  onChangeType: (to: DayType) => void
  onRebuild: () => void
  /** そのよていを つくったときの種類。いまの種類とちがうときは、つくりなおしを すすめる */
  planType?: DayType
}) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const other: DayType = info.type === 'school' ? 'holiday' : 'school'
  return (
    <section className="daybar" aria-label="ひづけ">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'today'} className={`tab${tab === 'today' ? ' tab--on' : ''}`} onClick={() => onTab('today')}>
          ☀️ きょう
        </button>
        <button type="button" role="tab" aria-selected={tab === 'tomorrow'} className={`tab${tab === 'tomorrow' ? ' tab--on' : ''}`} onClick={() => onTab('tomorrow')}>
          🌙 あした
        </button>
      </div>
      <div className={`daybar__info daybar__info--${info.type}`}>
        <div className="daybar__title">
          <span className="daybar__type">
            {info.type === 'school' ? '📚' : '🏖️'} {DAY_LABEL[info.type]}
          </span>
          <span className="daybar__date">
            {m}がつ{d}にち（{weekdayOf(y, m - 1, d)}ようび）
          </span>
        </div>
        <div className="daybar__note">
          {info.note}
          {info.reason === 'manual' && `（ふだんは ${DAY_LABEL[info.auto]}）`}
        </div>
        {planType && planType !== info.type && (
          <div className="daybar__hint" role="status">
            <span>⚠️ この日は {DAY_LABEL[info.type]}に なったよ。よていは {DAY_LABEL[planType]}の まま</span>
            <button type="button" className="pill-btn pill-btn--small" onClick={onRebuild}>
              🔄 {DAY_LABEL[info.type]}の どだいで つくりなおす
            </button>
          </div>
        )}
        <div className="daybar__buttons">
          <button type="button" className="pill-btn pill-btn--small" onClick={() => onChangeType(other)}>
            {other === 'holiday' ? '🏖️ この日は やすみに する' : '📚 この日は がっこうに する'}
          </button>
          <button type="button" className="pill-btn pill-btn--small" onClick={onRebuild}>
            🔄 どだいから つくりなおす
          </button>
        </div>
      </div>
    </section>
  )
}
