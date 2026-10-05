// アプリの「あたらしい バージョン」を取りこむしくみ。
//
// ホーム画面のアプリ（PWA）は、画面をキャッシュ（Service Worker）して すぐ開く。
// あたらしい版を公開しても、開いたままの画面は古いまま。iOS のホーム画面アプリは
// Service Worker の更新が とても おそいので、2とおりで たしかめる:
//  A. Service Worker の更新（registration.update()）→ 切りかわったら controllerchange
//  B. version.json（ビルドのたびに公開。キャッシュを使わず とりにいく）を見て、いまの版より あたらしければ
// どちらかで「あたらしい版」と分かったら、
//     ・開いて すぐ（15びょう以内）なら、キャッシュを すてて 自動で よみこみなおす
//     ・それ以外は、画面の上に「あたらしい バージョンが あるよ」を出す（そうさ中に とつぜん消さない）
// しらべるのは、アプリを開いたとき・画面にもどったとき・30分ごと。
import { useSyncExternalStore } from 'react'

/** 開いてから、これより短ければ 自動で よみこみなおす */
export const AUTO_RELOAD_WINDOW_MS = 15_000
/** あたらしい版を しらべる間かく */
export const CHECK_INTERVAL_MS = 30 * 60_000

export interface RegistrationLike {
  update(): Promise<unknown>
}
export interface ServiceWorkerContainerLike extends EventTarget {
  controller: unknown
  ready: Promise<RegistrationLike>
}
export interface DocumentLike {
  visibilityState: string
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/** version.json の中身（ビルドの日時とコミット番号） */
export interface VersionInfo {
  time: string
  sha: string
}

/** latest が current より あたらしいか（日時で くらべる。ローカルの開発ビルド 'dev' は くらべない） */
export function isNewerVersion(latest: VersionInfo | null | undefined, current: VersionInfo): boolean {
  if (!latest || current.sha === 'dev' || latest.sha === current.sha) return false
  const a = Date.parse(latest.time)
  const b = Date.parse(current.time)
  return Number.isFinite(a) && Number.isFinite(b) && a > b
}

export interface UpdateDeps {
  sw: ServiceWorkerContainerLike | undefined
  doc: DocumentLike
  /** ページを開いてからの経過ミリ秒（performance.now） */
  now: () => number
  reload: () => void
  /** あたらしい版が来たことを 画面にしらせる */
  notify: () => void
  /** いまの版（ビルドの情報） */
  current?: VersionInfo
  /** 公開されている いちばん あたらしい版を とってくる（version.json）。とれなければ null */
  fetchLatest?: () => Promise<VersionInfo | null>
  setIntervalFn?: (fn: () => void, ms: number) => unknown
  clearIntervalFn?: (id: unknown) => void
}

let registration: RegistrationLike | null = null
let versionChecker: (() => Promise<void>) | null = null

/** いますぐ しらべる（設定画面の ボタン用）。しらべられなければ false */
export async function checkNow(): Promise<boolean> {
  if (!registration && !versionChecker) return false
  let ok = false
  try {
    if (registration) {
      await registration.update()
      ok = true
    }
  } catch {
    // つづけて version.json も しらべる
  }
  if (versionChecker) {
    await versionChecker()
    ok = true
  }
  return ok
}

/** Service Worker の見はりをはじめる。やめるときは、かえってきた関数を呼ぶ */
export function setupUpdates(d: UpdateDeps): () => void {
  const sw = d.sw
  // いちばん最初のインストール（それまで controller がない）は、あたらしい版ではないので 何もしない
  const hadController = !!sw?.controller

  // 「あたらしい版」と分かったときの 動き（1回だけ）
  let found = false
  const onNewVersion = () => {
    if (found) return
    found = true
    if (d.now() < AUTO_RELOAD_WINDOW_MS) d.reload()
    else d.notify()
  }

  const onControllerChange = () => {
    if (hadController) onNewVersion()
  }
  sw?.addEventListener('controllerchange', onControllerChange)

  const checkVersion = async () => {
    if (found || !d.fetchLatest || !d.current) return
    try {
      if (isNewerVersion(await d.fetchLatest(), d.current)) onNewVersion()
    } catch {
      // ネットに つながらないときなどは、あとで また しらべる
    }
  }
  const check = () => {
    void registration?.update().catch(() => {})
    void checkVersion()
  }
  void sw?.ready.then((reg) => {
    registration = reg
  })
  check()
  // 確認する手段（version.json）が あるときだけ、「いますぐ しらべる」の 対象にする
  versionChecker = d.fetchLatest && d.current ? checkVersion : null

  const onVisible = () => {
    if (d.doc.visibilityState === 'visible') check()
  }
  d.doc.addEventListener('visibilitychange', onVisible)
  const setI = d.setIntervalFn ?? ((fn: () => void, ms: number) => setInterval(fn, ms))
  const clearI = d.clearIntervalFn ?? ((id: unknown) => clearInterval(id as number))
  const timer = setI(check, CHECK_INTERVAL_MS)
  // ready になったら、Service Worker も しらべる
  void sw?.ready.then(() => check())

  return () => {
    sw?.removeEventListener('controllerchange', onControllerChange)
    d.doc.removeEventListener('visibilitychange', onVisible)
    clearI(timer)
    registration = null
    versionChecker = null
  }
}

// ---- 画面に出す「あたらしい バージョンが あるよ」の状態 ----

let ready = false
const listeners = new Set<() => void>()

export function markUpdateReady() {
  if (ready) return
  ready = true
  listeners.forEach((l) => l())
}
export const isUpdateReady = () => ready
export function resetUpdateReady() {
  ready = false
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export function useUpdateReady(): boolean {
  return useSyncExternalStore(subscribe, isUpdateReady)
}

/**
 * 画面を作りなおして よみこむ。Service Worker とキャッシュを すててから よみこむので、古い版が のこらない
 * （きろく・よてい・せっていは localStorage にあるので きえない）
 */
export async function reloadApp(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    // つづける
  }
  try {
    const keys = (await globalThis.caches?.keys?.()) ?? []
    await Promise.all(keys.map((k) => globalThis.caches.delete(k)))
  } catch {
    // つづける
  }
  window.location.reload()
}

/** 公開されている version.json（キャッシュを使わずに とってくる）。とれなければ null */
export async function fetchLatestVersion(base = import.meta.env.BASE_URL): Promise<VersionInfo | null> {
  try {
    const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const j = (await res.json()) as Partial<VersionInfo>
    return typeof j.time === 'string' && typeof j.sha === 'string' ? { time: j.time, sha: j.sha } : null
  } catch {
    return null
  }
}

/** アプリのはじめに 呼ぶ */
export function startUpdates(current: VersionInfo) {
  if (typeof navigator === 'undefined') return
  setupUpdates({
    sw: 'serviceWorker' in navigator ? (navigator.serviceWorker as unknown as ServiceWorkerContainerLike) : undefined,
    doc: document,
    now: () => performance.now(),
    reload: () => void reloadApp(),
    notify: markUpdateReady,
    current,
    fetchLatest: () => fetchLatestVersion(),
  })
}
