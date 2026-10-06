// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DiagnosticsScreen } from './components/DiagnosticsScreen'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('にゅうりょく しんだん（いろいろな 入力欄を ためす）', () => {
  let el: HTMLDivElement
  let root: Root
  let copied = ''
  beforeEach(() => {
    copied = ''
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async (t: string) => void (copied = t)) } })
    el = document.createElement('div')
    document.body.appendChild(el)
    root = createRoot(el)
    act(() => root.render(<DiagnosticsScreen onClose={() => {}} />))
  })
  afterEach(() => {
    act(() => root.unmount())
    el.remove()
  })

  it('入力欄の しゅるい: input / textarea / search / contenteditable / form内 / numeric', () => {
    expect(el.querySelector('input[aria-label="しんだん: ふつうの いれる ところ"]')).not.toBeNull()
    expect(el.querySelector('textarea')).not.toBeNull()
    expect(el.querySelector('input[type="search"]')).not.toBeNull()
    expect(el.querySelector('[contenteditable]')).not.toBeNull()
    expect(el.querySelector('form input[type="text"]')).not.toBeNull()
    expect(el.querySelector('input[inputmode="numeric"]')).not.toBeNull()
  })
  it('「でた／でない」を おすと、コピーする ログに のこる', async () => {
    const group = el.querySelector('[aria-label="④ search の けっか"]')!
    act(() => (Array.from(group.querySelectorAll('button')).find((b) => b.textContent === 'でない') as HTMLElement).click())
    const group2 = el.querySelector('[aria-label="⑤ contenteditable の けっか"]')!
    act(() => (Array.from(group2.querySelectorAll('button')).find((b) => b.textContent === 'でた') as HTMLElement).click())
    await act(async () => {
      ;(Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('コピー')) as HTMLElement).click()
    })
    expect(copied).toContain('④ search: キーボード でない')
    expect(copied).toContain('⑤ contenteditable: キーボード でた')
    expect(copied).toContain('maxTouchPoints')
  })
  it('ボタンから focus() したあと、うつったかを ログに 出す', () => {
    act(() => (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('フォーカスする')) as HTMLElement).click())
    expect(el.textContent).toContain('③ focus() のあと')
  })
})
