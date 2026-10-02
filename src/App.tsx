import { useEffect, useState } from 'react'
import { PRESET_CARDS } from './cards'
import { AnalogClock } from './components/AnalogClock'
import { CardEditor } from './components/CardEditor'
import { Planner } from './components/Planner'
import { Runner, announceStart } from './components/Runner'
import { PresetsDialog } from './components/PresetsDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { useNow } from './hooks'
import { DEFAULT_SETTINGS, setSpeechSettings, unlockSpeech } from './speech'
import { useStored } from './storage'
import { formatClock } from './time'
import { startRun } from './runner'
import type { CardDef, PlanItem, RunState, SavedPlan, Settings } from './types'
import { load, save } from './storage'

type Dialog = null | 'card' | 'presets' | 'settings'

export function App() {
  const now = useNow(1000)
  const [plan, setPlan] = useStored<PlanItem[]>('plan', [])
  const [customCards, setCustomCards] = useStored<CardDef[]>('customCards', [])
  const [presets, setPresets] = useStored<SavedPlan[]>('presets', [])
  const [settings, setSettings] = useStored<Settings>('settings', DEFAULT_SETTINGS)
  const [dialog, setDialog] = useState<Dialog>(null)
  // じっこう中の状態は、リロードしても続けられるよう保存する
  const [run, setRun] = useState<RunState | null>(() => load<RunState | null>('run', null))
  const updateRun = (r: RunState | null) => {
    setRun(r)
    save('run', r)
  }

  useEffect(() => setSpeechSettings(settings), [settings])

  const cards = [...PRESET_CARDS, ...customCards]

  const start = () => {
    // iOS は、タップのなかで一度しゃべらせないと音が出ない
    unlockSpeech()
    announceStart(plan[0].name, plan[0].minutes)
    updateRun(startRun(plan, Date.now()))
  }

  if (run) return <Runner run={run} onChange={updateRun} onExit={() => updateRun(null)} />

  return (
    <main className="app">
      <header className="top">
        <h1>きょうのよてい</h1>
        <button type="button" className="icon-btn" aria-label="せってい" onClick={() => setDialog('settings')}>
          ⚙️
        </button>
      </header>

      <div className="layout">
        <section className="clock-area">
          <div className="clock-wrap">
            <AnalogClock now={now} />
          </div>
          <p className="now-text">
            いま <b>{formatClock(now)}</b>
          </p>
        </section>

        <div className="main-col">
          <Planner now={now} cards={cards} items={plan} onChange={setPlan} onCreateCard={() => setDialog('card')} />

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
              { id: crypto.randomUUID(), name, items: plan.map(({ uid: _uid, ...rest }) => rest) },
            ])
          }
          onLoad={(p) => {
            setPlan(p.items.map((i) => ({ ...i, uid: crypto.randomUUID() })))
            setDialog(null)
          }}
          onDelete={(id) => setPresets(presets.filter((p) => p.id !== id))}
        />
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          settings={settings}
          onChange={setSettings}
          customCards={customCards}
          onDeleteCard={(id) => setCustomCards(customCards.filter((c) => c.id !== id))}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  )
}
