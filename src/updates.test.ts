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
  isNewerVersion,
  fetchLatestVersion,
  type VersionInfo,
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

const V1: VersionInfo = { time: '2026-10-05T11:00:00.000Z', sha: '1111111' }
const V2: VersionInfo = { time: '2026-10-05T12:00:00.000Z', sha: '2222222' }

describe('version.json で あたらしい版を 見つける（Service Worker が 更新されない iOS 対策）', () => {
  it('isNewerVersion: 日時が あたらしいときだけ true', () => {
    expect(isNewerVersion(V2, V1)).toBe(true)
    expect(isNewerVersion(V1, V1)).toBe(false)
    expect(isNewerVersion(V1, V2)).toBe(false) // 公開のとちゅうで 古い版が見えても もどらない
    expect(isNewerVersion({ ...V2, sha: V1.sha }, V1)).toBe(false)
    expect(isNewerVersion(null, V1)).toBe(false)
    expect(isNewerVersion({ time: 'へん', sha: '3333333' }, V1)).toBe(false)
    expect(isNewerVersion(V2, { time: new Date(0).toISOString(), sha: 'dev' })).toBe(false) // 開発用ビルドは くらべない
  })

  function withVersion(ageMs: number, latest: () => Promise<VersionInfo | null>, hasSw = true) {
    const sw = hasSw ? new FakeSw(true) : undefined
    const doc = new FakeDoc()
    const calls = { reload: 0, notify: 0 }
    const timers: { fn: () => void; ms: number }[] = []
    const stop = setupUpdates({
      sw,
      doc,
      now: () => ageMs,
      reload: () => void calls.reload++,
      notify: () => void calls.notify++,
      current: V1,
      fetchLatest: latest,
      setIntervalFn: (fn, ms) => (timers.push({ fn, ms }), timers.length),
      clearIntervalFn: () => {},
    })
    return { sw, doc, calls, timers, stop }
  }

  it('開いて すぐ: あたらしい版が 出ていたら、自動で よみこみなおす（Service Worker が なくても）', async () => {
    const t = withVersion(2_000, async () => V2, false)
    await flush()
    expect(t.calls).toEqual({ reload: 1, notify: 0 })
    t.stop()
  })

  it('しばらく開いたままなら、バナーで しらせる。なんども しらべても 1回だけ', async () => {
    let n = 0
    const t = withVersion(AUTO_RELOAD_WINDOW_MS + 5_000, async () => (n++, V2))
    await flush()
    t.doc.fire()
    t.timers[0].fn()
    await flush()
    expect(t.calls).toEqual({ reload: 0, notify: 1 })
    expect(n).toBe(1) // 見つけたあとは、もう しらべない
    t.stop()
  })

  it('同じ版・古い版・とれないとき（ネットなし）は 何もしない。あとの しらべなおしで 見つかる', async () => {
    let latest: VersionInfo | null = V1
    const t = withVersion(60_000, async () => latest)
    await flush()
    expect(t.calls).toEqual({ reload: 0, notify: 0 })
    latest = null
    t.doc.fire()
    await flush()
    expect(t.calls).toEqual({ reload: 0, notify: 0 })
    latest = V2
    t.doc.fire()
    await flush()
    expect(t.calls).toEqual({ reload: 0, notify: 1 })
    t.stop()
  })

  it('しらべる文が エラーを なげても、止まらない', async () => {
    const t = withVersion(60_000, async () => {
      throw new Error('offline')
    })
    await flush()
    expect(t.calls).toEqual({ reload: 0, notify: 0 })
    t.stop()
  })

  it('Service Worker の切りかわりと version.json の両方で 見つかっても、よみこみは 1回だけ', async () => {
    const t = withVersion(1_000, async () => V2)
    await flush()
    t.sw!.controllerChange()
    expect(t.calls.reload).toBe(1)
    t.stop()
  })

  it('checkNow は version.json も しらべる', async () => {
    const t = withVersion(60_000, async () => V2, false)
    await flush()
    expect(t.calls.notify).toBe(1)
    expect(await checkNow()).toBe(true)
    t.stop()
  })

  it('fetchLatestVersion: キャッシュを つかわず（no-store）に とる。こわれた中身・エラーは null', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return { ok: true, json: async () => V2 }
    }) as unknown as typeof fetch
    expect(await fetchLatestVersion('/jikan-app/')).toEqual(V2)
    expect(calls[0].url).toMatch(/^\/jikan-app\/version\.json\?t=\d+$/)
    expect(calls[0].init).toMatchObject({ cache: 'no-store' })
    globalThis.fetch = (async () => ({ ok: true, json: async () => ({ x: 1 }) })) as unknown as typeof fetch
    expect(await fetchLatestVersion('/')).toBeNull()
    globalThis.fetch = (async () => ({ ok: false })) as unknown as typeof fetch
    expect(await fetchLatestVersion('/')).toBeNull()
    globalThis.fetch = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    expect(await fetchLatestVersion('/')).toBeNull()
    globalThis.fetch = orig
  })
})
