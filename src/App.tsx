import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_FIXED_CARDS, MORNING_CARDS, PRESET_CARDS } from './cards'
import { AnalogClock } from './components/AnalogClock'
import { CardEditor } from './components/CardEditor'
import { RenameDialog } from './components/RenameDialog'
import { Planner } from './components/Planner'
import { Runner } from './components/Runner'
import { speakCues } from './cues'
import { buildTimeline, isFixed, syncFixed, timelineSectors } from './schedule'
import { dayInfo, pruneOverrides, toggleDayOverride, weekdayOfKey } from './calendar'
import { prunePlans, syncAllPlans, withDayPlan, type Plans } from './plans'
import { migrateFixedCards, normalizeTemplates, planFromTemplate, purgeFixedCard, templateFor } from './templates'
import { DayBar, type DayTab } from './components/DayBar'
import { UpdateBanner } from './components/UpdateBanner'
import { BUILD, formatBuild } from './buildInfo'
import { PresetsDialog } from './components/PresetsDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { useNow } from './hooks'
import { setSpeechSettings, unlockSpeech } from './speech'
import { normalizeSettings } from './voiceSettings'
import { useStored } from './storage'
import { addDaysMs, formatClock, startOfDay } from './time'
import { abortRun, normalizeRun, startRun } from './runner'
import { dateKey, upsertSession } from './history'
import { HistoryScreen } from './components/HistoryScreen'
import type { CardDef, DayType, FixedCard, HistorySession, PlanItem, RunState, SavedPlan, Settings, Templates, Vacation } from './types'
import { load, save } from './storage'

type Dialog = null | 'card' | 'presets' | 'settings' | 'rename'
type Screen = 'plan' | 'history'

const NO_ITEMS: PlanItem[] = []
const MIN = 60_000

export function App() {
  const now = useNow(1000)
  const [customCards, setCustomCards] = useStored<CardDef[]>('customCards', [])
  const [presets, setPresets] = useStored<SavedPlan[]>('presets', [])
  // じこくカード: 保存されていた古い形式は、読みこむときに いまの形（しずか・でかける・1日のおわり）にそろえる
  const [fixedCards, setFixedCards] = useState<FixedCard[]>(() => {
    const stored = load<FixedCard[] | null>('fixedCards', null)
    if (!stored) return DEFAULT_FIXED_CARDS
    return migrateFixedCards(stored, load<number>('fixedCardsV', 1) < 2)
  })
  const [templates, setTemplates] = useState<Templates>(() => normalizeTemplates(load<unknown>('templates', null)))
  const [vacations, setVacations] = useStored<Vacation[]>('vacations', [])
  const [dayOverrides, setDayOverrides] = useStored<Record<string, DayType>>('dayOverrides', {})
  const [plans, setPlans] = useState<Plans>(() => load<Plans>('plans', {}))
  /** その日のよていを つくったときの種類（がっこう／やすみ）。あとで種類がかわったときの案内に使う */
  const [planTypes, setPlanTypes] = useState<Record<string, DayType>>(() => load<Record<string, DayType>>('planTypes', {}))
  // 前のバージョンの「きょうの よてい」（日ごとではない保存）。きょうの よていが まだ無いときだけ引きつぐ
  const [legacyPlan] = useState(() => load<PlanItem[] | null>('plan', null))
  const [tab, setTab] = useState<DayTab>('today')
  /** 日ごとの、スタート時刻（0:00からの分）。ない日は 「いま」（あしたは さいしょのじこくカード） */
  const [startMins, setStartMins] = useState<Record<string, number | null>>({})
  // 声の設定: 前のバージョンの保存データも、いまの形（キャラ・調整）にそろえて読みこむ
  const [settings, setSettings] = useState<Settings>(() => normalizeSettings(load<unknown>('settings', null)))
  const [dialog, setDialog] = useState<Dialog>(null)
  const [renameUid, setRenameUid] = useState<string | null>(null)
  // ダイアログは 全画面のページ。ひらく前の スクロール位置をおぼえて、とじたら もどす
  const savedScroll = useRef<number | null>(null)
  const openDialog = (d: Exclude<Dialog, null>) => {
    savedScroll.current = window.scrollY
    setDialog(d)
  }
  useEffect(() => {
    if (dialog === null && savedScroll.current !== null) {
      const y = savedScroll.current
      savedScroll.current = null
      requestAnimationFrame(() => window.scrollTo(0, y))
    }
  }, [dialog])
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

  useEffect(() => {
    save('fixedCards', fixedCards)
    save('fixedCardsV', 2)
  }, [fixedCards])
  useEffect(() => save('templates', templates), [templates])
  useEffect(() => save('settings', settings), [settings])
  useEffect(() => save('plans', plans), [plans])
  useEffect(() => save('planTypes', planTypes), [planTypes])

  const nowMs = now.getTime()
  const todayKey = dateKey(nowMs)
  const tomorrowMs = addDaysMs(nowMs, 1)
  const tomorrowKey = dateKey(tomorrowMs)
  const isToday = tab === 'today'
  const selKey = isToday ? todayKey : tomorrowKey
  const dayStartMs = startOfDay(isToday ? nowMs : tomorrowMs)

  /** その日の土台（がっこうの日／やすみの日、曜日ごとの上書きも見て）から、よていをつくる */
  const makePlan = (key: string, typeOverride?: DayType): PlanItem[] => {
    const type = typeOverride ?? dayInfo(key, vacations, dayOverrides).type
    return planFromTemplate(templateFor(templates, type, weekdayOfKey(key)), fixedCards)
  }

  // 日がかわったら（またはタブを開いたら）、その日のよていが まだ無ければ 土台から ならべる。過ぎた日は捨てる
  useEffect(() => {
    setPlans((p) => {
      let next = prunePlans(p, todayKey)
      next = withDayPlan(next, todayKey, () => (legacyPlan && legacyPlan.length > 0 ? syncFixed(legacyPlan, fixedCards) : makePlan(todayKey)))
      if (tab === 'tomorrow') next = withDayPlan(next, tomorrowKey, () => makePlan(tomorrowKey))
      return next
    })
    setDayOverrides((o) => pruneOverrides(o, todayKey))
    // つくったときの種類を おぼえる（まだ おぼえていない日だけ）
    setPlanTypes((pt) => {
      const keep = Object.fromEntries(Object.entries(pt).filter(([k]) => k >= todayKey))
      for (const k of tab === 'tomorrow' ? [todayKey, tomorrowKey] : [todayKey]) {
        if (!keep[k]) keep[k] = dayInfo(k, vacations, dayOverrides).type
      }
      return keep
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, tomorrowKey, tab, templates, vacations, dayOverrides, fixedCards])
  useEffect(() => {
    if (plans[todayKey]) save('plan', null) // 前のバージョンの保存は、もう いらない
  }, [plans, todayKey])

  // 親が設定画面でじこくカードを直したら、よていの中のじこくカードにも反映する（時刻・長さは そのまま）
  useEffect(() => setPlans((p) => syncAllPlans(p, fixedCards)), [fixedCards])

  const plan = plans[selKey] ?? NO_ITEMS
  const setPlan = (items: PlanItem[]) => setPlans((p) => ({ ...p, [selKey]: items }))
  const info = dayInfo(selKey, vacations, dayOverrides)
  const startMin = startMins[selKey] ?? null
  const defaultStartMin = plan.find((i) => isFixed(i))?.startMin ?? 0
  // きょうの「いま」は、秒を切りすてた分単位でそろえる（のこり時間が 5ふん → 4ぷん と ずれないように）
  const startAt = isToday
    ? startMin === null
      ? Math.floor(nowMs / MIN) * MIN
      : dayStartMs + startMin * MIN
    : dayStartMs + (startMin ?? defaultStartMin) * MIN
  const timeline = useMemo(() => buildTimeline(plan, startAt, dayStartMs), [plan, startAt, dayStartMs])
  const sectors = useMemo(() => timelineSectors(timeline, startAt), [timeline, startAt])

  const changeDayType = (to: DayType) => {
    if (plan.length > 0 && !window.confirm('よていを どだいから つくりなおすよ。いい？')) return
    setDayOverrides(toggleDayOverride(selKey, to, vacations, dayOverrides))
    setPlans((p) => ({ ...p, [selKey]: makePlan(selKey, to) }))
    setPlanTypes((pt) => ({ ...pt, [selKey]: to }))
  }
  const rebuildDay = () => {
    if (plan.length > 0 && !window.confirm('よていを どだいから つくりなおすよ。いい？')) return
    setPlans((p) => ({ ...p, [selKey]: makePlan(selKey) }))
    setPlanTypes((pt) => ({ ...pt, [selKey]: info.type }))
  }
  const updateFixedCards = (list: FixedCard[]) => {
    const removed = fixedCards.filter((c) => !list.some((x) => x.id === c.id))
    if (removed.length) setTemplates((t) => removed.reduce((acc, c) => purgeFixedCard(acc, c.id), t))
    setFixedCards(list)
  }

  const cards = [...PRESET_CARDS, ...MORNING_CARDS, ...customCards]

  const start = () => {
    // iOS は、タップのなかで一度しゃべらせないと音が出ない
    unlockSpeech()
    // スタート時刻をかえていても、じっこうは「いま」からはじまる（じこくカードの時刻は、そのまま）
    const step = startRun(plans[todayKey] ?? NO_ITEMS, Date.now())
    speakCues(step.cues)
    updateRun(step.run)
  }

  if (run) return <Runner run={run} onChange={updateRun} onExit={exitRun} />

  if (screen === 'history') {
    return (
      <>
        <UpdateBanner />
        <HistoryScreen sessions={history} now={now} onBack={() => setScreen('plan')} />
      </>
    )
  }

  const renaming = plan.find((i) => i.uid === renameUid)

  // ダイアログがひらいている間は、そのページだけを出す（うしろの よてい画面・ドラッグ部品は ない）
  if (dialog) {
    return (
      <>
        {dialog === 'card' && (
          <CardEditor
            onClose={() => setDialog(null)}
            onSave={(c) => {
              setCustomCards([...customCards, c])
              setDialog(null)
            }}
          />
        )}
        {dialog === 'rename' && renaming && (
          <RenameDialog
            item={renaming}
            onClose={() => setDialog(null)}
            onSave={(name) => {
              setPlan(plan.map((i) => (i.uid === renaming.uid ? { ...i, name } : i)))
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
              setStartMins((s) => ({ ...s, [selKey]: p.startMin ?? null }))
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
            onFixedCards={updateFixedCards}
            templates={templates}
            onTemplates={setTemplates}
            vacations={vacations}
            onVacations={setVacations}
            allCards={cards}
            customCards={customCards}
            onDeleteCard={(id) => setCustomCards(customCards.filter((c) => c.id !== id))}
            onClose={() => setDialog(null)}
          />
        )}
      </>
    )
  }

  return (
    <main className="app">
      <UpdateBanner />
      <header className="top">
        <h1>{isToday ? 'きょうのよてい' : 'あしたのよてい'}</h1>
        <div className="top__buttons">
          <button type="button" className="pill-btn" onClick={() => setScreen('history')}>
            📅 りれき
          </button>
          <button type="button" className="icon-btn" aria-label="せってい" onClick={() => openDialog('settings')}>
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
          <DayBar tab={tab} onTab={setTab} dateKey={selKey} info={info} onChangeType={changeDayType} onRebuild={rebuildDay} planType={planTypes[selKey]} />
          <Planner
            now={now}
            cards={cards}
            fixedCards={fixedCards}
            items={plan}
            timeline={timeline}
            startMin={startMin}
            startAt={startAt}
            dayStartMs={dayStartMs}
            isToday={isToday}
            nowMs={nowMs}
            defaultStartMin={defaultStartMin}
            onStartMin={(m) => setStartMins((s) => ({ ...s, [selKey]: m }))}
            onChange={setPlan}
            onCreateCard={() => openDialog('card')}
            onRename={(uid) => {
              setRenameUid(uid)
              openDialog('rename')
            }}
          />

          <div className="actions">
            <button type="button" className="big-btn big-btn--sub" onClick={() => openDialog('presets')}>
              ⭐ いつものよてい
            </button>
            {isToday ? (
              <button type="button" className="big-btn big-btn--go" disabled={plan.length === 0} onClick={start}>
                ▶ スタート
              </button>
            ) : (
              <p className="tomorrow-note">🌙 あしたに なったら スタートできるよ。いまは よていを つくるだけ！</p>
            )}
          </div>
        </div>
      </div>

      <p className="build-info">バージョン {formatBuild(BUILD)}</p>
    </main>
  )
}
