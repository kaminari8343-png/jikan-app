// アプリの「あたらしい バージョン」を取りこむしくみ。
//
// ホーム画面のアプリ（PWA）は、画面をキャッシュ（Service Worker）して すぐ開く。
// あたらしい版を公開しても、開いたままの画面は古いまま。これをふせぐため:
//  1. アプリを開いたとき・画面にもどったとき・30分ごとに、あたらしい版が ないか しらべる
//  2. あたらしい版に切りかわったら（controllerchange）、
//     ・開いて すぐ（15びょう以内）なら、そのまま 自動で よみこみなおす
//     ・それ以外は、画面の上に「あたらしい バージョンが あるよ」を出す（そうさ中に とつぜん消さない）
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

export interface UpdateDeps {
  sw: ServiceWorkerContainerLike | undefined
  doc: DocumentLike
  /** ページを開いてからの経過ミリ秒（performance.now） */
  now: () => number
  reload: () => void
  /** あたらしい版が来たことを 画面にしらせる */
  notify: () => void
  setIntervalFn?: (fn: () => void, ms: number) => unknown
  clearIntervalFn?: (id: unknown) => void
}

let registration: RegistrationLike | null = null

/** いますぐ しらべる（設定画面の ボタン用）。しらべられなければ false */
export async function checkNow(): Promise<boolean> {
  if (!registration) return false
  try {
    await registration.update()
    return true
  } catch {
    return false
  }
}

/** Service Worker の見はりをはじめる。やめるときは、かえってきた関数を呼ぶ */
export function setupUpdates(d: UpdateDeps): () => void {
  const sw = d.sw
  if (!sw) return () => {}
  // いちばん最初のインストール（それまで controller がない）は、あたらしい版ではないので 何もしない
  const hadController = !!sw.controller

  const onControllerChange = () => {
    if (!hadController) return
    if (d.now() < AUTO_RELOAD_WINDOW_MS) d.reload()
    else d.notify()
  }
  sw.addEventListener('controllerchange', onControllerChange)

  const check = () => {
    void registration?.update().catch(() => {})
  }
  void sw.ready.then((reg) => {
    registration = reg
    check()
  })
  const onVisible = () => {
    if (d.doc.visibilityState === 'visible') check()
  }
  d.doc.addEventListener('visibilitychange', onVisible)
  const setI = d.setIntervalFn ?? ((fn: () => void, ms: number) => setInterval(fn, ms))
  const clearI = d.clearIntervalFn ?? ((id: unknown) => clearInterval(id as number))
  const timer = setI(check, CHECK_INTERVAL_MS)

  return () => {
    sw.removeEventListener('controllerchange', onControllerChange)
    d.doc.removeEventListener('visibilitychange', onVisible)
    clearI(timer)
    registration = null
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

export const reloadApp = () => window.location.reload()

/** アプリのはじめに 呼ぶ */
export function startUpdates() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  setupUpdates({
    sw: navigator.serviceWorker as unknown as ServiceWorkerContainerLike,
    doc: document,
    now: () => performance.now(),
    reload: reloadApp,
    notify: markUpdateReady,
  })
}
