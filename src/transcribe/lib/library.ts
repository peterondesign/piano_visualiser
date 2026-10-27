import type { Note } from './transcribe'

export interface Project {
  id: string
  name: string
  created: number
  duration: number
  notes: Note[]
  transpose: number
  split: number
}

const KEY = 'piano-visualiser:transcriptions'
const MAX_RECENTS = 20

export function loadRecents(): Project[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Project[]) : []
  } catch {
    return []
  }
}

export function saveRecents(list: Project[]): Project[] {
  let trimmed = list.slice(0, MAX_RECENTS)
  // Drop oldest entries until the payload fits the localStorage quota.
  while (trimmed.length > 0) {
    try {
      localStorage.setItem(KEY, JSON.stringify(trimmed))
      return trimmed
    } catch {
      trimmed = trimmed.slice(0, -1)
    }
  }
  localStorage.removeItem(KEY)
  return trimmed
}

// Original audio is too large for localStorage, so it lives in IndexedDB keyed by project id.
const DB_NAME = 'piano-visualiser-audio'
const STORE = 'audio'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const putAudio = (id: string, blob: Blob) => withStore('readwrite', (s) => s.put(blob, id))
export const getAudio = (id: string) =>
  withStore<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
export const deleteAudio = (id: string) => withStore('readwrite', (s) => s.delete(id))
