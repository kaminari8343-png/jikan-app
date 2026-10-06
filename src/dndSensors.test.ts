// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { SafeTouchSensor, touchConstraintFor } from './dndSensors'

describe('センサー: つまみ(≡)と本体の使いわけ', () => {
  const handle = document.createElement('button')
  handle.setAttribute('data-drag-handle', '')
  const body = document.createElement('div')
  const base = { delay: 180, tolerance: 8 }
  const ev = (t: Element) => ({ nativeEvent: { target: t } }) as never
  it('つまみは すぐ（少し動いたら）、それ以外は 長押し', () => {
    expect(touchConstraintFor(handle, base)).toEqual({ distance: 3 })
    expect(touchConstraintFor(body, base)).toBe(base)
    expect(touchConstraintFor(null, base)).toBe(base)
  })
  it('入力欄の上では はじまらない', () => {
    const input = document.createElement('input')
    expect(SafeTouchSensor.activators[0].handler(ev(input), {})).toBe(false)
  })
  it('タッチのセンサーは 1つだけ（同じイベントを見るセンサーが 2つあると、あとの1つしか効かない）', () => {
    expect(SafeTouchSensor.activators.map((a) => a.eventName)).toEqual(['onTouchStart'])
  })
})
