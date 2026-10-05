// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { HandleTouchSensor, SafeTouchSensor } from './dndSensors'

function fire(S: typeof SafeTouchSensor, target: Element) {
  const inner = vi.fn(() => true)
  const act = S.activators[0]
  const orig = act.handler
  void orig
  // ガードだけを調べる: 中身の handler は 呼ばれたかどうかだけ見る
  return { act, inner, target }
}

describe('センサー: つまみ(≡)と本体の使いわけ', () => {
  const handle = document.createElement('button')
  handle.setAttribute('data-drag-handle', '')
  const body = document.createElement('div')
  const ev = (t: Element) => ({ nativeEvent: { target: t } }) as never
  it('長押しセンサーは つまみでは はじまらない', () => {
    const r = fire(SafeTouchSensor, handle)
    expect(r.act.handler(ev(handle), {})).toBe(false)
  })
  it('つまみ専用センサーは、つまみ以外では はじまらない', () => {
    expect(HandleTouchSensor.activators[0].handler(ev(body), {})).toBe(false)
  })
  it('入力欄の上では どちらも はじまらない', () => {
    const input = document.createElement('input')
    expect(HandleTouchSensor.activators[0].handler(ev(input), {})).toBe(false)
    expect(SafeTouchSensor.activators[0].handler(ev(input), {})).toBe(false)
  })
})
