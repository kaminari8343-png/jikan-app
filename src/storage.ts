import { useCallback, useEffect, useRef, useState } from 'react'

const PREFIX = 'jikan-app:'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T | null) {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 容量いっぱい・プライベートモードなどは無視
  }
}

/** useState と同じ使い方で、localStorage にも保存する */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => load(key, initial))
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    save(key, value)
  }, [key, value])
  const reset = useCallback(() => setValue(initial), [initial])
  return [value, setValue, reset] as const
}
