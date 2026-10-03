import { useEffect, useState } from 'react'
import { dateKey } from '../history'
import { CHARACTERS, SAMPLE, getCharacter, type Character, type CharacterId } from '../phrases'
import { say } from '../phrases.logic'
import { listJaVoices, speakTest, voiceFor, type JaVoice } from '../speech'
import { resolveCharacter, type Settings } from '../voiceSettings'
import { characterOfDay } from '../dailyCharacter'

const GENDER_LABEL = { female: 'おんなのひと', male: 'おとこのひと', unknown: 'ふめい' } as const

/** 端末の日本語の声の一覧（あとから増えることがあるので、voiceschanged で読みなおす） */
function useJaVoices(): JaVoice[] {
  const [voices, setVoices] = useState<JaVoice[]>(() => listJaVoices())
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const read = () => setVoices(listJaVoices())
    read()
    speechSynthesis.addEventListener?.('voiceschanged', read)
    return () => speechSynthesis.removeEventListener?.('voiceschanged', read)
  }, [])
  return voices
}

/** そのキャラの「ためしにきく」のセリフ（はじまりのセリフ） */
export const sampleLine = (ch: Character) => say('start', { name: SAMPLE.name, minutes: SAMPLE.minutes }, ch)

/** こえのキャラクターをえらぶ（子ども用の大きなボタン）と、親用の こえの ちょうせい */
export function CharacterPicker({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const today = dateKey(Date.now())
  const active = resolveCharacter(settings, today)
  const todays = getCharacter(characterOfDay(today))
  const voices = useJaVoices()
  const tuning = settings.tuning[active.id]

  const setTuning = (id: CharacterId, patch: Partial<NonNullable<Settings['tuning'][CharacterId]>>) => {
    const next = { ...settings.tuning[id], ...patch }
    for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] === undefined || next[k] === '') delete next[k]
    const rest = { ...settings.tuning }
    if (Object.keys(next).length) rest[id] = next
    else delete rest[id]
    onChange({ ...settings, tuning: rest })
  }

  const pick = voiceFor(active)

  return (
    <div className="field">
      <span>こえの キャラクター</span>
      <div className="char-grid" role="radiogroup" aria-label="こえの キャラクター">
        {CHARACTERS.map((ch) => (
          <div key={ch.id} className={`char-card${settings.character === ch.id ? ' char-card--on' : ''}`}>
            <button
              type="button"
              role="radio"
              aria-checked={settings.character === ch.id}
              className="char-btn"
              onClick={() => onChange({ ...settings, character: ch.id })}
            >
              <span className="char-btn__emoji">{ch.emoji}</span>
              <b>{ch.name}</b>
              <small>{ch.blurb}</small>
            </button>
            <button type="button" className="char-try" aria-label={`${ch.name} を ためしにきく`} onClick={() => speakTest(sampleLine(ch), ch)}>
              ▶ ためしにきく
            </button>
          </div>
        ))}
        <div className={`char-card${settings.character === 'random' ? ' char-card--on' : ''}`}>
          <button
            type="button"
            role="radio"
            aria-checked={settings.character === 'random'}
            className="char-btn"
            onClick={() => onChange({ ...settings, character: 'random' })}
          >
            <span className="char-btn__emoji">🎲</span>
            <b>まいにち かわる</b>
            <small>
              きょうは {todays.emoji} {todays.name}
            </small>
          </button>
          <button type="button" className="char-try" aria-label="きょうの キャラを ためしにきく" onClick={() => speakTest(sampleLine(todays), todays)}>
            ▶ ためしにきく
          </button>
        </div>
      </div>

      <details className="char-tune">
        <summary>
          🔧 こえの ちょうせい（おうちのひと用）　{active.emoji} {active.name}
        </summary>
        <label className="field">
          <span>つかう こえ</span>
          <select
            className="slot-select"
            aria-label="つかう こえ"
            value={tuning?.voice ?? ''}
            onChange={(e) => setTuning(active.id, { voice: e.target.value })}
          >
            <option value="">じどう（おすすめ）</option>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}（{GENDER_LABEL[v.gender]}）
              </option>
            ))}
          </select>
        </label>
        {pick.voice ? (
          <small>
            いま つかっている こえ: {pick.voice.name}
            {pick.substituted && (active.voice.gender === 'male' ? '（おとこのひとの こえが ないので、おんなのひとの こえを ひくくして つかっているよ）' : '（おんなのひとの こえが ないので、ほかの こえで だいようしているよ）')}
          </small>
        ) : (
          <small className="warn">にほんごの こえが みつかりません（端末の設定で日本語の声を追加してください）</small>
        )}
        <label className="field field--slider">
          <span>たかさ</span>
          <input type="range" min={0.1} max={2} step={0.05} aria-label="たかさ" value={tuning?.pitch ?? active.pitch} onChange={(e) => setTuning(active.id, { pitch: Number(e.target.value) })} />
        </label>
        <label className="field field--slider">
          <span>はやさ</span>
          <input type="range" min={0.5} max={1.8} step={0.05} aria-label="はやさ" value={tuning?.rate ?? active.rate} onChange={(e) => setTuning(active.id, { rate: Number(e.target.value) })} />
        </label>
        <div className="row">
          <button type="button" className="big-btn big-btn--sub" onClick={() => speakTest(sampleLine(active), active)}>
            ▶ ためしにきく
          </button>
          <button type="button" className="link-btn" onClick={() => setTuning(active.id, { voice: '', pitch: undefined, rate: undefined })}>
            もとに もどす
          </button>
        </div>
      </details>
    </div>
  )
}
