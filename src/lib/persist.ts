/**
 * persist.ts — lightweight persistence helpers for SnapTogether
 *
 * Photos are large base64 strings — too big for localStorage (5MB limit).
 * We use IndexedDB for photos and localStorage for everything else.
 *
 * Keys:
 *   localStorage:
 *     snap_theme       — 'dark' | 'light'
 *     snap_username    — last used username
 *     snap_prefs       — { stripLayout, selectedFrame }
 *     snap_session     — { view, roomCode, isCreator, username, userId, sessionId }
 *     snap_result      — { aiCaption }  (finalStripData goes to IDB — too large)
 *
 *   IndexedDB (db: snaptogether, store: photos):
 *     capturedPhotos   — CapturedPhoto[]
 *     finalStripData   — string (base64 jpeg)
 *     chosenPhotos     — CapturedPhoto[]
 */

// ── localStorage helpers ──────────────────────────────────────────────────────

export function lsGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota exceeded — ignore
  }
}

export function lsDel(key: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

const DB_NAME    = 'snaptogether'
const DB_VERSION = 1
const STORE_NAME = 'photos'

let _db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => { _db = req.result; resolve(_db) }
    req.onerror   = () => reject(req.error)
  })
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(value, key)
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(req.error)
    })
  } catch { /* ignore */ }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve((req.result as T) ?? null)
      req.onerror   = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function idbDel(key: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).delete(key)
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(req.error)
    })
  } catch { /* ignore */ }
}

export async function idbClear(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).clear()
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(req.error)
    })
  } catch { /* ignore */ }
}

// ── Session snapshot ──────────────────────────────────────────────────────────

export interface SessionSnapshot {
  view: string
  roomCode: string
  isCreator: boolean
  username: string
  userId: string
  sessionId: string | null
}

export function saveSession(snap: SessionSnapshot): void {
  // Only persist navigable mid-session views — not landing/result/gallery
  const persist = ['lobby', 'studio', 'stripBuilder', 'result']
  if (!persist.includes(snap.view)) {
    lsDel('snap_session')
    return
  }
  lsSet('snap_session', snap)
}

export function loadSession(): SessionSnapshot | null {
  return lsGet<SessionSnapshot>('snap_session')
}

export function clearSession(): void {
  lsDel('snap_session')
}