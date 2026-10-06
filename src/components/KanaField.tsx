import { useState } from 'react'
import { KANA_ROWS, pressKana, type KanaKey, type KanaMode } from '../kana'

/**
 * なまえの入力欄 ＋ 画面の中の ひらがな入力ボタン。
 * iPad の ホーム画面アプリで キーボードが 出ないときの 代わり。キーボードが つかえる ときは いままで どおり 打てる。
 * ボタンは 入力欄の「外」（label の外）に おく（入力欄の 祖先に ボタンや 抑止設定を おかない）。
 */
export function KanaField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  maxLength: number
  placeholder?: string
}) {
  const [mode, setMode] = useState<KanaMode>('hiragana')
  const press = (key: KanaKey) => onChange(pressKana(value, key, mode, maxLength))
  const katakana = mode === 'katakana'
  const toKatakanaLabel = katakana ? 'ひらがなに する' : 'カタカナに する'
  return (
    <div className="kana-field">
      <label className="field">
        <span>{label}</span>
        <input value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </label>
      <div className="kana" role="group" aria-label="ひらがな にゅうりょく">
        <div className="kana__grid">
          {KANA_ROWS.flat().map((ch, i) =>
            ch === null ? (
              <span key={i} />
            ) : (
              <button key={i} type="button" className="kana__key" onClick={() => press({ type: 'char', ch })}>
                {katakana ? String.fromCharCode(ch.charCodeAt(0) + 0x60) : ch}
              </button>
            ),
          )}
        </div>
        <div className="kana__tools">
          <button type="button" className="kana__key kana__key--tool" aria-label="だくてん" onClick={() => press({ type: 'daku' })}>
            ゛
          </button>
          <button type="button" className="kana__key kana__key--tool" aria-label="はんだくてん" onClick={() => press({ type: 'handaku' })}>
            ゜
          </button>
          <button type="button" className="kana__key kana__key--tool" aria-label="ちいさい もじ" onClick={() => press({ type: 'small' })}>
            小
          </button>
          <button type="button" className="kana__key kana__key--tool" aria-label="のばしぼう" onClick={() => press({ type: 'char', ch: 'ー' })}>
            ー
          </button>
          <button type="button" className="kana__key kana__key--tool" aria-label="ひとつ けす" onClick={() => press({ type: 'back' })}>
            ⌫
          </button>
          <button type="button" className="kana__key kana__key--tool" aria-label="ぜんぶ けす" onClick={() => press({ type: 'clear' })}>
            ぜんぶ
            <br />
            けす
          </button>
          <button type="button" className="kana__key kana__key--tool kana__key--wide" aria-pressed={katakana} onClick={() => setMode(katakana ? 'hiragana' : 'katakana')}>
            {toKatakanaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
