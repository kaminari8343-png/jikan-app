import { useEffect, useState } from 'react'
import type { CardDef, FixedCard, HistorySession, Settings, Templates, Vacation } from '../types'
import { formatMinOfDayAp, formatSpan } from '../time'
import { FixedCardEditor } from './FixedCardEditor'
import { TemplatesDialog } from './TemplatesDialog'
import { buildBackup, dateKey, mergeHistory, parseBackup } from '../history'
import { isSpeechSupported, listJaVoices, speakTest } from '../speech'
import { say } from '../phrases.logic'
import { SAMPLE, type Character } from '../phrases'
import { resolveCharacter } from '../voiceSettings'
import { READINGS } from '../readings'
import { PRESET_CARDS } from '../cards'
import { CharacterPicker } from './CharacterPicker'
import { Modal } from './Modal'

/** テストさいせいのボタン一覧: えらんだキャラの、実際に話すセリフをそのまま出す */
const TESTS: { label: string; text: (ch: Character) => string }[] = [
  { label: 'はじまり', text: (ch) => say('start', { name: SAMPLE.name, minutes: SAMPLE.minutes }, ch) },
  { label: 'はんぶん', text: (ch) => say('half', { minutes: SAMPLE.halfMinutes }, ch) },
  { label: 'あと5ふん', text: (ch) => say('remaining5', { minutes: SAMPLE.five }, ch) },
  { label: 'あと1ぷん', text: (ch) => say('remaining1', { minutes: SAMPLE.one }, ch) },
  {
    label: 'おわり',
    text: (ch) => `${say('end', { name: SAMPLE.name }, ch)} ${say('next', { next: SAMPLE.next }, ch)}`,
  },
  { label: 'ふりかえり', text: (ch) => say('ask', { name: SAMPLE.name }, ch) },
  { label: 'まる', text: (ch) => say('rateGood', {}, ch) },
  { label: 'ばつ', text: (ch) => say('rateBad', {}, ch) },
  { label: 'ぜんぶおわり', text: (ch) => say('allDone', {}, ch) },
  { label: '+5ふん', text: (ch) => say('extended', { minutes: 5 }, ch) },
  { label: 'じこくになった', text: (ch) => say('fixedStart', { fixed: SAMPLE.fixed, clock: SAMPLE.clock }, ch) },
  { label: '5ふんまえ', text: (ch) => say('fixedSoon', { fixed: SAMPLE.fixed, minutes: SAMPLE.five }, ch) },
  { label: 'じゆうじかん', text: (ch) => say('freeStart', { fixed: SAMPLE.fixed, minutes: SAMPLE.free }, ch) },
  { label: 'じかんぎれ', text: (ch) => say('timeoutNote', {}, ch) },
  { label: 'のばせない', text: (ch) => say('cannotExtend', { fixed: SAMPLE.fixed }, ch) },
  { label: 'おやすみ', text: (ch) => say('endOfDay', {}, ch) },
  { label: 'でかける 10ぷんまえ', text: (ch) => say('leaveSoon', { fixed: 'いえをでる', minutes: 10 }, ch) },
  { label: 'でかける 1ぷんまえ', text: (ch) => say('leaveSoon', { fixed: 'いえをでる', minutes: 1 }, ch) },
  { label: 'いってらっしゃい', text: (ch) => say('leaveNow', {}, ch) },
]

/** 読みかたを 登録してあるカード（パレットのカードのうち、readings.ts に名前がのっているもの）。ためしにきく ボタンに なる */
const READING_TESTS = PRESET_CARDS.filter((c) => c.name in READINGS)

export function SettingsDialog({
  settings,
  onChange,
  history,
  onImportHistory,
  customCards,
  onDeleteCard,
  fixedCards,
  onFixedCards,
  templates,
  onTemplates,
  vacations,
  onVacations,
  allCards,
  onClose,
}: {
  settings: Settings
  onChange: (s: Settings) => void
  history: HistorySession[]
  onImportHistory: (h: HistorySession[]) => void
  customCards: CardDef[]
  onDeleteCard: (id: string) => void
  fixedCards: FixedCard[]
  onFixedCards: (c: FixedCard[]) => void
  templates: Templates
  onTemplates: (t: Templates) => void
  vacations: Vacation[]
  onVacations: (v: Vacation[]) => void
  /** どだいに入れられる ふつうのカード（パレットのカード＋じぶんでつくったカード） */
  allCards: CardDef[]
  onClose: () => void
}) {
  const [voices, setVoices] = useState<string[]>([])
  const active = resolveCharacter(settings, dateKey(Date.now()))
  const [showTemplates, setShowTemplates] = useState(false)
  const [editingFixed, setEditingFixed] = useState<FixedCard | 'new' | null>(null)
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const exportHistory = () => {
    const blob = new Blob([buildBackup(history)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jikan-kiroku-${dateKey(Date.now())}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setBackupMsg({ ok: true, text: `${history.length}かい ぶんの きろくを ほぞんしたよ` })
  }

  const importHistory = async (file: File | undefined) => {
    if (!file) return
    const parsed = parseBackup(await file.text())
    if (!parsed.ok) return setBackupMsg({ ok: false, text: parsed.error })
    const { merged, added } = mergeHistory(history, parsed.sessions)
    onImportHistory(merged)
    setBackupMsg({
      ok: true,
      text: `${added}かい ぶん よみこんだよ${parsed.skipped ? `（よめない きろくが ${parsed.skipped}こ あったよ）` : ''}`,
    })
  }
  useEffect(() => {
    if (!isSpeechSupported()) return
    const read = () => setVoices(listJaVoices().map((v) => v.name))
    read()
    speechSynthesis.addEventListener?.('voiceschanged', read)
    return () => speechSynthesis.removeEventListener?.('voiceschanged', read)
  }, [])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v })

  return (
    <Modal title="せってい" onClose={onClose}>
      <div className="field">
        <span>こえ</span>
        <label className="toggle">
          <input type="checkbox" checked={settings.voiceOn} onChange={(e) => set('voiceOn', e.target.checked)} />
          <span>{settings.voiceOn ? '🔊 しゃべる' : '🔇 しゃべらない'}</span>
        </label>
        {!isSpeechSupported() && <small className="warn">このブラウザは こえが つかえません</small>}
        {isSpeechSupported() && voices.length === 0 && (
          <small className="warn">にほんごの こえが みつかりません（端末の設定で日本語の声を追加してください）</small>
        )}
        {voices.length > 0 && <small>つかえる声: にほんご（{voices.length}しゅるい）</small>}
        <Slider label="おおきさ" min={0.2} max={1} step={0.1} value={settings.volume} onChange={(v) => set('volume', v)} />
      </div>

      <CharacterPicker settings={settings} onChange={onChange} />

      <div className="field">
        <span>
          テストさいせい（読みまちがいが ないか きいてね）　{active.emoji} {active.name}
        </span>
        <div className="test-grid">
          {TESTS.map((t) => (
            <button key={t.label} type="button" className="big-btn big-btn--sub" onClick={() => speakTest(t.text(active), active)}>
              ▶ {t.label}
            </button>
          ))}
        </div>
        <small>えらんだ キャラの セリフで ならすよ。セリフは src/phrases/ の キャラごとの ファイルで かえられます</small>
      </div>

      <div className="field">
        <span>カードの よみかた（まちがって よまれないか きいてね）　{active.emoji} {active.name}</span>
        <div className="test-grid">
          {READING_TESTS.map((card) => (
            <button
              key={card.id}
              type="button"
              className="big-btn big-btn--sub"
              aria-label={`${card.name} の よみかた`}
              onClick={() => speakTest(say('start', { name: card.name, minutes: card.minutes }, active), active)}
            >
              {card.emoji} {card.name}
            </button>
          ))}
        </div>
        <small>よみかたは src/readings.ts に とうろくしてあります（ふえたカードは そこに たすだけ）</small>
      </div>

      <div className="field">
        <span>📌 じこくカード（おうちのひと用）</span>
        <small>じかんが きまっている よてい。よていの なかで、じこくじゅんに ならびます</small>
        <ul className="preset-list">
          {[...fixedCards]
            .sort((a, b) => a.startMin - b.startMin)
            .map((c) => (
              <li key={c.id} className="preset">
                <span className="preset__main preset__main--static" style={{ borderLeft: `12px solid ${c.color}` }}>
                  <span className="preset__items">{c.emoji}</span>
                  <b>{c.name}</b>
                  <small>
                    {formatMinOfDayAp(c.startMin)}
                    {(c.endOfDay ?? c.minutes === 0) ? ' から（1日の おわり）' : c.minutes === 0 ? '' : ` 〜 ${formatSpan(c.minutes)}`}
                    {c.quiet && ' 🔕'}
                    {c.leaving && ' 🚪'}
                  </small>
                </span>
                <button type="button" className="icon-btn" aria-label={`${c.name} をなおす`} onClick={() => setEditingFixed(c)}>
                  ✏️
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${c.name} をけす`}
                  onClick={() => window.confirm(`「${c.name}」を けしていい？`) && onFixedCards(fixedCards.filter((x) => x.id !== c.id))}
                >
                  🗑️
                </button>
              </li>
            ))}
        </ul>
        <button type="button" className="big-btn big-btn--sub" onClick={() => setEditingFixed('new')}>
          ＋ じこくカードを ついか
        </button>
      </div>

      <div className="field">
        <span>📆 まいにちの どだい（がっこうの日・やすみの日）</span>
        <small>月〜金は がっこうの日、土日と 日本の しゅくじつは やすみの日。じこくや カードを かえたり、曜日ごとに ちがう どだいに できます</small>
        <button type="button" className="big-btn big-btn--sub" onClick={() => setShowTemplates(true)}>
          📆 どだいと ながい やすみを ひらく
        </button>
      </div>

      <div className="field">
        <span>きろくの バックアップ</span>
        <div className="test-grid">
          <button type="button" className="big-btn big-btn--sub" onClick={exportHistory}>
            💾 きろくを ほぞん（かきだし）
          </button>
          <label className="big-btn big-btn--sub file-btn">
            📂 きろくを よみこむ
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void importHistory(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {backupMsg && <small className={backupMsg.ok ? 'ok' : 'warn'}>{backupMsg.text}</small>}
        <small>Safariの データを けしたり、たんまつを かえるときのために ときどき ほぞんしてね</small>
      </div>

      {customCards.length > 0 && (
        <div className="field">
          <span>じぶんで つくった カード</span>
          <ul className="preset-list">
            {customCards.map((c) => (
              <li key={c.id} className="preset">
                <span className="preset__main preset__main--static">
                  <span className="preset__items">{c.emoji}</span>
                  <b>{c.name}</b>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${c.name} をけす`}
                  onClick={() => window.confirm(`「${c.name}」を けしていい？`) && onDeleteCard(c.id)}
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showTemplates && (
        <TemplatesDialog
          templates={templates}
          onTemplates={onTemplates}
          fixedCards={fixedCards}
          cards={allCards}
          vacations={vacations}
          onVacations={onVacations}
          onClose={() => setShowTemplates(false)}
        />
      )}
      {editingFixed && (
        <FixedCardEditor
          initial={editingFixed === 'new' ? null : editingFixed}
          onClose={() => setEditingFixed(null)}
          onSave={(c) => {
            onFixedCards(fixedCards.some((x) => x.id === c.id) ? fixedCards.map((x) => (x.id === c.id ? c : x)) : [...fixedCards, c])
            setEditingFixed(null)
          }}
        />
      )}
    </Modal>
  )
}

function Slider(props: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="field field--slider">
      <span>{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  )
}
