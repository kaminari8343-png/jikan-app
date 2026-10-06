// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PinGate } from './components/PinGate'
import { hashPin, isPinFormat, loadPin, makePin, makeResetChallenge, verifyPin } from './pin'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('あんしょうばんごう（ロジック）', () => {
  it('4けたの すうじだけ', () => {
    expect(isPinFormat('1234')).toBe(true)
    for (const bad of ['123', '12345', 'abcd', '12 4', '']) expect(isPinFormat(bad)).toBe(false)
  })
  it('ほぞんする のは ハッシュ。ばんごうそのものは のこらない。あっていれば ひらく', () => {
    const p = makePin('4321', 'salt')
    expect(JSON.stringify(p)).not.toContain('4321')
    expect(verifyPin('4321', p)).toBe(true)
    expect(verifyPin('1234', p)).toBe(false)
    expect(verifyPin('4321', null)).toBe(false)
    expect(hashPin('4321', 'a')).not.toBe(hashPin('4321', 'b'))
  })
  it('わすれたとき用の けいさんは 2けた×2けた', () => {
    const c = makeResetChallenge(() => 0.5)
    const m = c.question.match(/^(\d+) × (\d+)$/)!
    expect(Number(m[1]) * Number(m[2])).toBe(c.answer)
    expect(c.answer).toBeGreaterThan(100)
  })
})

describe('PinGate（がめん）', () => {
  let el: HTMLDivElement
  let root: Root
  const press = (digits: string) => {
    for (const d of digits) {
      const key = Array.from(document.querySelectorAll('.pin__key')).find((b) => b.textContent === d) as HTMLElement
      act(() => key.click())
    }
  }
  const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 250))))
  const text = () => document.body.textContent ?? ''
  beforeEach(() => {
    localStorage.clear()
    el = document.createElement('div')
    document.body.appendChild(el)
    root = createRoot(el)
    act(() => root.render(<PinGate onClose={() => {}}><p id="secret">せってい</p></PinGate>))
  })
  afterEach(() => {
    act(() => root.unmount())
    el.remove()
  })

  it('はじめは ばんごうを きめる（2かい おなじものを いれる）。そのあと せっていが ひらく', async () => {
    expect(text()).toContain('ばんごうを きめる')
    expect(document.getElementById('secret')).toBeNull()
    press('2580')
    await settle()
    expect(text()).toContain('もういちど')
    press('2580')
    await settle()
    expect(document.getElementById('secret')).not.toBeNull()
    expect(verifyPin('2580', loadPin())).toBe(true)
  })
  it('2かいめが ちがえば はじめから', async () => {
    press('1111')
    await settle()
    press('2222')
    await settle()
    expect(text()).toContain('ちがったよ')
    expect(document.getElementById('secret')).toBeNull()
    expect(loadPin()).toBeNull()
  })
  it('ばんごうが きまっていれば、あっている ときだけ ひらく', async () => {
    localStorage.setItem('jikan-app:pin', JSON.stringify(makePin('1357', 's')))
    act(() => root.render(<PinGate key="again" onClose={() => {}}><p id="secret">せってい</p></PinGate>))
    expect(text()).toContain('4けたの ばんごう')
    press('0000')
    await settle()
    expect(text()).toContain('ばんごうが ちがうよ')
    expect(document.getElementById('secret')).toBeNull()
    press('1357')
    await settle()
    expect(document.getElementById('secret')).not.toBeNull()
  })
  it('5かい まちがえると しばらく まつ（その間は うけつけない）', async () => {
    localStorage.setItem('jikan-app:pin', JSON.stringify(makePin('1357', 's')))
    act(() => root.render(<PinGate key="lock" onClose={() => {}}><p id="secret">せってい</p></PinGate>))
    for (let i = 0; i < 5; i++) {
      press('0000')
      await settle()
    }
    expect(text()).toContain('まってね')
    press('1357')
    await settle()
    expect(document.getElementById('secret')).toBeNull()
  })
  it('わすれたとき: けいさんが とければ ばんごうを けして つくりなおせる', async () => {
    localStorage.setItem('jikan-app:pin', JSON.stringify(makePin('1357', 's')))
    act(() => root.render(<PinGate key="reset" onClose={() => {}}><p id="secret">せってい</p></PinGate>))
    act(() => (Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('わすれたとき')) as HTMLElement).click())
    const q = document.querySelector('.pin__q')!.textContent!.match(/(\d+) × (\d+)/)!
    press(String(Number(q[1]) * Number(q[2])))
    act(() => (document.querySelector('[aria-label="けってい"]') as HTMLElement).click())
    expect(loadPin()).toBeNull()
    expect(text()).toContain('ばんごうを きめる')
  })
  it('入力欄を つかわない（数字ボタンだけ）', () => {
    expect(document.querySelector('input, textarea, select')).toBeNull()
  })
})
