import { useEffect, useState } from 'react'
import type { CardDef, HistorySession, Settings } from '../types'
import { buildBackup, dateKey, mergeHistory, parseBackup } from '../history'
import { DEFAULT_SETTINGS, isSpeechSupported, speakTest } from '../speech'
import { say } from '../phrases.logic'
import { SAMPLE } from '../phrases'
import { Modal } from './Modal'

/** テストさいせいのボタン一覧: 実際に話すセリフをそのまま出す */
const TESTS: { label: string; text: () => string }[] = [
  { label: 'はじまり', text: () => say('start', { name: SAMPLE.name, minutes: SAMPLE.minutes }) },
  { label: 'はんぶん', text: () => say('half', { minutes: SAMPLE.halfMinutes }) },
  { label: 'あと5ふん', text: () => say('remaining5', { minutes: SAMPLE.five }) },
  { label: 'あと1ぷん', text: () => say('remaining1', { minutes: SAMPLE.one }) },
  {
    label: 'おわり',
    text: () => `${say('end', { name: SAMPLE.name })} ${say('next', { next: SAMPLE.next })}`,
  },
  { label: 'ぜんぶおわり', text: () => say('allDone') },
  { label: '+5ふん', text: () => say('extended', { minutes: 5 }) },
]

export function SettingsDialog({
  settings,
  onChange,
  history,
  onImportHistory,
  customCards,
  onDeleteCard,
  onClose,
}: {
  settings: Settings
  onChange: (s: Settings) => void
  history: HistorySession[]
  onImportHistory: (h: HistorySession[]) => void
  customCards: CardDef[]
  onDeleteCard: (id: string) => void
  onClose: () => void
}) {
  const [voices, setVoices] = useState<string[]>([])
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
    const read = () =>
      setVoices(speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ja')).map((v) => v.name))
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
        {voices.length > 0 && <small>つかう声: にほんご（{voices.length}しゅるい）</small>}
      </div>

      <Slider label="はやさ" min={0.6} max={1.3} step={0.05} value={settings.rate} onChange={(v) => set('rate', v)} />
      <Slider label="たかさ" min={0.8} max={1.8} step={0.05} value={settings.pitch} onChange={(v) => set('pitch', v)} />
      <Slider label="おおきさ" min={0.2} max={1} step={0.1} value={settings.volume} onChange={(v) => set('volume', v)} />
      <button type="button" className="link-btn" onClick={() => onChange(DEFAULT_SETTINGS)}>
        もとに もどす
      </button>

      <div className="field">
        <span>テストさいせい（読みまちがいが ないか きいてね）</span>
        <div className="test-grid">
          {TESTS.map((t) => (
            <button key={t.label} type="button" className="big-btn big-btn--sub" onClick={() => speakTest(t.text())}>
              ▶ {t.label}
            </button>
          ))}
        </div>
        <small>セリフは src/phrases.ts で かえられます</small>
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
