import { useEffect, useState, type ReactNode } from 'react'
import { LOCK_MS, MAX_TRIES, isPinFormat, loadPin, makePin, makeResetChallenge, savePin, verifyPin, type StoredPin } from '../pin'
import { Modal } from './Modal'

/**
 * おとなの せってい の入口。4けたの あんしょうばんごうを いれると ひらく。
 * 入力欄は つかわず、画面の 大きな 数字ボタンで いれる（iOS のホーム画面アプリでも キーボードの 心配がない）。
 * はじめて ひらくときは、あんしょうばんごうを きめる（2かい いれて たしかめる）。
 */
export function PinGate({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const [stored, setStored] = useState<StoredPin | null>(() => loadPin())
  const [unlocked, setUnlocked] = useState(false)
  if (unlocked) return <>{children}</>
  return <Gate stored={stored} onStored={setStored} onUnlock={() => setUnlocked(true)} onClose={onClose} />
}

type Mode = 'enter' | 'set1' | 'set2' | 'reset'

function Gate({ stored, onStored, onUnlock, onClose }: { stored: StoredPin | null; onStored: (p: StoredPin | null) => void; onUnlock: () => void; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(stored ? 'enter' : 'set1')
  const [digits, setDigits] = useState('')
  const [first, setFirst] = useState('')
  const [msg, setMsg] = useState('')
  const [tries, setTries] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [challenge, setChallenge] = useState(() => makeResetChallenge())
  const [answer, setAnswer] = useState('')

  useEffect(() => {
    if (lockedUntil <= Date.now()) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [lockedUntil])
  const waitSec = Math.max(0, Math.ceil((lockedUntil - now) / 1000))

  const press = (d: string) => {
    if (waitSec > 0) return
    if (mode === 'reset') return setAnswer((a) => (a + d).slice(0, 6))
    const next = (digits + d).slice(0, 4)
    setDigits(next)
    if (next.length < 4) return
    // 4けた そろった
    setTimeout(() => submit(next), 120)
  }
  const back = () => (mode === 'reset' ? setAnswer((a) => a.slice(0, -1)) : setDigits((x) => x.slice(0, -1)))

  const submit = (pin: string) => {
    if (!isPinFormat(pin)) return
    if (mode === 'set1') {
      setFirst(pin)
      setDigits('')
      setMode('set2')
      setMsg('')
    } else if (mode === 'set2') {
      if (pin === first) {
        const p = makePin(pin)
        savePin(p)
        onStored(p)
        onUnlock()
      } else {
        setDigits('')
        setFirst('')
        setMode('set1')
        setMsg('ばんごうが ちがったよ。もういちど はじめから きめてね')
      }
    } else if (verifyPin(pin, stored)) {
      onUnlock()
    } else {
      const t = tries + 1
      setDigits('')
      if (t >= MAX_TRIES) {
        setTries(0)
        setLockedUntil(Date.now() + LOCK_MS)
        setNow(Date.now())
        setMsg('なんども まちがえたので、すこし まってね')
      } else {
        setTries(t)
        setMsg('ばんごうが ちがうよ')
      }
    }
  }

  const resetDone = () => {
    if (Number(answer) === challenge.answer) {
      savePin(null)
      onStored(null)
      setAnswer('')
      setDigits('')
      setFirst('')
      setMsg('あんしょうばんごうを けしたよ。あたらしく きめてね')
      setMode('set1')
    } else {
      setMsg('こたえが ちがうよ')
      setAnswer('')
      setChallenge(makeResetChallenge())
    }
  }

  const title = mode === 'set1' ? 'ばんごうを きめる' : mode === 'set2' ? 'もういちど いれてね' : mode === 'reset' ? 'ばんごうを わすれたとき' : 'おとなの せってい'
  const shown = mode === 'reset' ? answer : digits.padEnd(4, '・').replace(/\d/g, '●')
  return (
    <Modal title={title} onClose={onClose}>
      <div className="pin">
        {mode === 'set1' && <p>おとなの せっていを ひらく 4けたの ばんごうを きめてね（こどもには ひみつ）</p>}
        {mode === 'set2' && <p>おなじ ばんごうを もういちど いれてね</p>}
        {mode === 'enter' && <p>4けたの ばんごうを いれてね</p>}
        {mode === 'reset' && (
          <p>
            おとなの かた: つぎの けいさんの こたえを いれると、ばんごうを けして つくりなおせます
            <br />
            <b className="pin__q">{challenge.question} ＝ ?</b>
          </p>
        )}
        <div className="pin__display" role="status" aria-label={mode === 'reset' ? 'こたえ' : 'ばんごう'}>
          {shown || '　'}
        </div>
        <p className="pin__msg" role="alert">
          {waitSec > 0 ? `あと ${waitSec}びょう まってね` : msg}
        </p>
        <div className="pin__pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className="pin__key" onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button type="button" className="pin__key pin__key--sub" onClick={back} aria-label="ひとつ けす">
            ⌫
          </button>
          <button type="button" className="pin__key" onClick={() => press('0')}>
            0
          </button>
          {mode === 'reset' ? (
            <button type="button" className="pin__key pin__key--ok" onClick={resetDone} aria-label="けってい">
              ✓
            </button>
          ) : (
            <span />
          )}
        </div>
        {mode === 'enter' && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode('reset')
              setMsg('')
              setAnswer('')
            }}
          >
            ばんごうを わすれたとき
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="link-btn" onClick={() => { setMode('enter'); setMsg('') }}>
            ばんごうを いれる がめんに もどる
          </button>
        )}
      </div>
    </Modal>
  )
}
