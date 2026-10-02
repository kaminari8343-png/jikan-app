import { useEffect } from 'react'

/** active のあいだ、画面がスリープしないようにする（Screen Wake Lock API） */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen')
        if (cancelled) void l.release()
        else lock = l
      } catch {
        // 省電力モードなどで拒否されることがある。無視
      }
    }
    void acquire()
    // 画面が見えなくなると自動で解除されるので、戻ってきたらとりなおす
    const onVisible = () => document.visibilityState === 'visible' && (!lock || lock.released) && void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [active])
}
