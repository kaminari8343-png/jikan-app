import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUILD, formatBuild } from './buildInfo'
import {
  AUTO_RELOAD_WINDOW_MS,
  CHECK_INTERVAL_MS,
  checkNow,
  isUpdateReady,
  markUpdateReady,
  resetUpdateReady,
  setupUpdates,
  type DocumentLike,
  type ServiceWorkerContainerLike,
  type UpdateDeps,
} from './updates'

class FakeSw extends EventTarget implements ServiceWorkerContainerLike {
  controller: unknown
  updates = 0
  ready: Promise<{ update(): Promise<unknown> }>
  constructor(hasController: boolean) {
    super()
    this.controller = hasController ? {} : null
    this.ready = Promise.resolve({
      update: () => {
        this.updates++
        return Promise.resolve()
      },
    })
  }
  controllerChange() {
    this.dispatchEvent(new Event('controllerchange'))
  }
}

class FakeDoc implements DocumentLike {
  visibilityState = 'visible'
  private ls = new Set<() => void>()
  addEventListener(_t: 'visibilitychange', l: () => void) {
    this.ls.add(l)
  }
  removeEventListener(_t: 'visibilitychange', l: () => void) {
    this.ls.delete(l)
  }
  count() {
    return this.ls.size
  }
  fire() {
    this.ls.forEach((l) => l())
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function setup(opts: { hasController: boolean; ageMs: number }) {
  const sw = new FakeSw(opts.hasController)
  const doc = new FakeDoc()
  const calls = { reload: 0, notify: 0 }
  const timers: { fn: () => void; ms: number }[] = []
  const cleared: unknown[] = []
  const deps: UpdateDeps = {
    sw,
    doc,
    now: () => opts.ageMs,
    reload: () => void calls.reload++,
    notify: () => void calls.notify++,
    setIntervalFn: (fn, ms) => {
      timers.push({ fn, ms })
      return timers.length
    },
    clearIntervalFn: (id) => void cleared.push(id),
  }
  const stop = setupUpdates(deps)
  return { sw, doc, calls, timers, cleared, stop }
}

afterEach(() => resetUpdateReady())

describe('あたらしい バージョンの取りこみ', () => {
  it('開いて すぐ（15びょう以内）に あたらしい版に切りかわったら、自動で よみこみなおす', async () => {
    const t = setup({ hasController: true, ageMs: 3_000 })
    await flush()
    t.sw.controllerChange()
    expect(t.calls).toEqual({ reload: 1, notify: 0 })
    t.stop()
  })

  it('しばらく開いたままなら、よみこまず「あたらしい バージョンが あるよ」を知らせる', async () => {
    const t = setup({ hasController: true, ageMs: AUTO_RELOAD_WINDOW_MS + 1 })
    t.sw.controllerChange()
    expect(t.calls).toEqual({ reload: 0, notify: 1 })
    t.stop()
  })

  it('いちばん最初のインストール（controller なし）は、あたらしい版ではないので 何もしない', () => {
    const t = setup({ hasController: false, ageMs: 100 })
    t.sw.controllerChange()
    expect(t.calls).toEqual({ reload: 0, notify: 0 })
    t.stop()
  })

  it('開いたとき・画面にもどったとき・30分ごとに、あたらしい版を しらべる', async () => {
    const t = setup({ hasController: true, ageMs: 100 })
    await flush()
    expect(t.sw.updates).toBe(1) // 開いたとき
    t.doc.fire()
    expect(t.sw.updates).toBe(2) // 画面にもどった
    t.doc.visibilityState = 'hidden'
    t.doc.fire()
    expect(t.sw.updates).toBe(2) // かくれたときは しらべない
    expect(t.timers).toHaveLength(1)
    expect(t.timers[0].ms).toBe(CHECK_INTERVAL_MS)
    expect(CHECK_INTERVAL_MS).toBe(30 * 60_000)
    t.timers[0].fn()
    expect(t.sw.updates).toBe(3) // 30分たった
    t.stop()
  })

  it('しらべるのに失敗しても（ネットなし）、エラーにならない', async () => {
    const sw = new FakeSw(true)
    sw.ready = Promise.resolve({ update: () => Promise.reject(new Error('offline')) })
    const stop = setupUpdates({ sw, doc: new FakeDoc(), now: () => 0, reload: () => {}, notify: () => {}, setIntervalFn: () => 1, clearIntervalFn: () => {} })
    await flush()
    expect(await checkNow()).toBe(false)
    stop()
  })

  it('checkNow: しらべられたら true。Service Worker がなければ false', async () => {
    expect(await checkNow()).toBe(false)
    const t = setup({ hasController: true, ageMs: 100 })
    await flush()
    const before = t.sw.updates
    expect(await checkNow()).toBe(true)
    expect(t.sw.updates).toBe(before + 1)
    t.stop()
    expect(await checkNow()).toBe(false)
  })

  it('やめると、見はりを ぜんぶ外す', async () => {
    const t = setup({ hasController: true, ageMs: 100 })
    await flush()
    t.stop()
    expect(t.doc.count()).toBe(0)
    expect(t.cleared).toEqual([1])
    t.sw.controllerChange()
    expect(t.calls).toEqual({ reload: 0, notify: 0 })
  })

  it('Service Worker が使えない端末では、何もしない', () => {
    const stop = setupUpdates({ sw: undefined, doc: new FakeDoc(), now: () => 0, reload: vi.fn(), notify: vi.fn() })
    expect(() => stop()).not.toThrow()
  })
})

describe('「あたらしい バージョンが あるよ」の状態', () => {
  it('知らせると true、リセットで false。なんども知らせても 1回ぶん', () => {
    const listener = vi.fn()
    expect(isUpdateReady()).toBe(false)
    markUpdateReady()
    markUpdateReady()
    expect(isUpdateReady()).toBe(true)
    resetUpdateReady()
    expect(isUpdateReady()).toBe(false)
    void listener
  })
})

describe('バージョン表示', () => {
  it('ビルドの日時とコミット番号を 画面用の文字にする', () => {
    expect(formatBuild({ time: new Date(2026, 9, 5, 20, 29).toISOString(), sha: '07e36c4' })).toBe('10がつ5にち 20:29（07e36c4）')
    expect(formatBuild({ time: new Date(2026, 0, 1, 9, 5).toISOString(), sha: 'dev' })).toBe('1がつ1にち 9:05（dev）')
  })
  it('ビルドの情報が入っている（ISOの日時と 短いコミット番号）', () => {
    expect(BUILD.time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(BUILD.sha.length).toBeGreaterThan(0)
    expect(BUILD.sha.length).toBeLessThanOrEqual(7)
  })
})
