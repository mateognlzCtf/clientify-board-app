'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * `useState`-compatible hook that persists its value to localStorage. The
 * stored value is keyed by `key` (typically scoped per user/project) so
 * different projects keep independent state in the same browser.
 *
 * On mount the hook reads from localStorage and overrides the initial value
 * if present. On every value change it writes back. Reads/writes are wrapped
 * in try/catch so quota-full, private-mode, or other failures degrade
 * silently to in-memory state.
 *
 * NOTE: the initial state is what React renders on the first paint (SSR-safe).
 * The stored value swaps in on the next render after mount — a single
 * unmeasurable flicker, same trade-off as `useListColumnWidths`.
 */
interface Options<T> {
  /** Custom serializer. Defaults to `JSON.stringify`. */
  serialize?: (value: T) => string
  /** Custom deserializer. Defaults to `JSON.parse`. Useful for Set, Map, etc. */
  deserialize?: (raw: string) => T
}

export function usePersistedState<T>(
  key: string,
  initial: T,
  options?: Options<T>,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial)
  const serialize = options?.serialize ?? ((v: T) => JSON.stringify(v))
  const deserialize = options?.deserialize ?? ((raw: string) => JSON.parse(raw) as T)

  // Load from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) setValue(deserialize(raw))
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Save to localStorage on every subsequent change.
  //
  // The save effect runs once on mount before the load effect's setValue has
  // settled — if we wrote to storage there we'd overwrite the persisted value
  // with the initial state. `isFirstSave` skips that first run; from then on
  // every real user change is persisted.
  const isFirstSave = useRef(true)
  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false
      return
    }
    try {
      localStorage.setItem(key, serialize(value))
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value])

  return [value, setValue]
}
