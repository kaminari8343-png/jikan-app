import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_FIXED_CARDS, PRESET_CARDS } from './cards'
import { AnalogClock } from './components/AnalogClock'
import { CardEditor } from './components/CardEditor'
import { Planner } from './components/Planner'
import { Runner } from './components/Runner'
import { speakCues } from './cues'
import { buildTimeline, syncFixed, timelineSectors } from './schedule'
import { PresetsDialog } from './components/PresetsDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { useNow } from './hooks'
import { DEFAULT_SETTINGS, setSpeechSettings, unlockSpeech } from './speech'
import { useStored } from './storage'
import { formatClock, startOfDay } from './time'
import { abortRun, normalizeRun, startRun } from './runner'
import { upsertSession } from './history'
import { HistoryScreen } from './components/HistoryScreen'
import type { CardDef, FixedCard, HistorySession, PlanItem, RunState, SavedPlan, Settings } from './types'
import { load, save } from './storage'

type Dialog = null | 'card' | 'presets' | 'settings'
type Screen = 'plan' | 'history'

export function App() {
  const now = useNow(1000)
  const [plan, setPlan] = useStored<PlanItem[]>('plan', [])
  const [customCards, setCustomCards] = useStored<CardDef[]>('customCards', [])
  const [presets, setPresets] = useStored<SavedPlan[]>('presets', [])
  const [fixedCards, setFixedCards] = useStored<FixedCard[]>('fixedCards', DEFAULT_FIXED_CARDS)
  /** スタート時刻（0:00からの分）。null は「いま」 */
  const [startMin, setStartMin] = useState<number | null>(null)
  const [settings, setSettings] = useStored<Settings>('settings', DEFAULT_SETTINGS)
  const [dialog, setDialog] = useState<Dialog>(null)
  // じっこう中の状態は、リロードしても続けられるよう保存する
  const [run, setRun] = useState<RunState | null>(() => normalizeRun(load<unknown>('run', null)))
  const [history, setHistory] = useStored<HistorySession[]>('history', [])
  const [screen, setScreen] = useState<Screen>('plan')
  const updateRun = (r: RunState | null) => {
    setRun(r)
    save('run', r)
    // 記録は、状態が変わるたびにその回のぶんを更新して残す
    if (r) setHistory((h) => upsertSession(h, r.session))
  }
  const exitRun = () => {
    if (run) setHistory((h) => upsertSession(h, abortRun(run)))
    updateRun(null)
  }

  useEffect(() => setSpeechSettings(settings), [settings])

  // 親が設定画面でじこくカードを直したら、よていの中のじこくカードにも反映する
  useEffect(() => {
    setPlan((p) => syncFixed(p, fixedCards))
  }, [fixedCards, setPlan])

  const dayStartMs = startOfDay(now.getTime())
  // 「いま」のときは、秒を切りすてた分単位でそろえる（のこり時間が 5ふん → 4ぷん と ずれないように）
  const startAt = startMin === null ? Math.floor(now.getTime() / 60_000) * 60_000 : dayStartMs + startMin * 60_000
  const timeline = useMemo(() => buildTimeline(plan, startAt, dayStartMs), [plan, startAt, dayStartMs])
  const sectors = useMemo(() => timelineSectors(timeline), [timeline])

  const cards = [...PRESET_CARDS, ...customCards]

  const start = () => {
    // iOS は、タップのなかで一度しゃべらせないと音が出ない
    unlockSpeech()
    // スタート時刻をかえていても、じっこうは「いま」からはじまる（じこくカードの時刻は、そのまま）
    const step = startRun(plan, Date.now())
    speakCues(step.cues)
    updateRun(step.run)
  }

  if (run) return <Runner run={run} onChange={updateRun} onExit={exitRun} />

  if (screen === 'history') return <HistoryScreen sessions={history} now={now} onBack={() => setScreen('plan')} />

  return (
    <main className="app">
      <header className="top">
        <h1>きょうのよてい</h1>
        <div className="top__buttons">
          <button type="button" className="pill-btn" onClick={() => setScreen('history')}>
            📅 りれき
          </button>
          <button type="button" className="icon-btn" aria-label="せってい" onClick={() => setDialog('settings')}>
            ⚙️
          </button>
        </div>
      </header>

      <div className="layout">
        <section className="clock-area">
          <div className="clock-wrap">
            <AnalogClock now={now} sectors={sectors} />
          </div>
          <p className="now-text">
            いま <b>{formatClock(now)}</b>
          </p>
        </section>

        <div className="main-col">
          <Planner
            now={now}
            cards={cards}
            fixedCards={fixedCards}
            items={plan}
            timeline={timeline}
            startMin={startMin}
            startAt={startAt}
            dayStartMs={dayStartMs}
            onStartMin={setStartMin}
            onChange={setPlan}
            onCreateCard={() => setDialog('card')}
          />

          <div className="actions">
            <button type="button" className="big-btn big-btn--sub" onClick={() => setDialog('presets')}>
              ⭐ いつものよてい
            </button>
            <button type="button" className="big-btn big-btn--go" disabled={plan.length === 0} onClick={start}>
              ▶ スタート
            </button>
          </div>
        </div>
      </div>

      {dialog === 'card' && (
        <CardEditor
          onClose={() => setDialog(null)}
          onSave={(c) => {
            setCustomCards([...customCards, c])
            setDialog(null)
          }}
        />
      )}
      {dialog === 'presets' && (
        <PresetsDialog
          current={plan}
          presets={presets}
          onClose={() => setDialog(null)}
          onSave={(name) =>
            setPresets([
              ...presets,
              { id: crypto.randomUUID(), name, startMin, items: plan.map(({ uid: _uid, ...rest }) => rest) },
            ])
          }
          onLoad={(p) => {
            // じこくカードは、いまの設定（時刻・名前）にそろえる
            setPlan(syncFixed(p.items.map((i) => ({ ...i, uid: crypto.randomUUID() })), fixedCards))
            setStartMin(p.startMin ?? null)
            setDialog(null)
          }}
          onDelete={(id) => setPresets(presets.filter((p) => p.id !== id))}
        />
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          settings={settings}
          onChange={setSettings}
          history={history}
          onImportHistory={setHistory}
          fixedCards={fixedCards}
          onFixedCards={setFixedCards}
          customCards={customCards}
          onDeleteCard={(id) => setCustomCards(customCards.filter((c) => c.id !== id))}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  )
}
