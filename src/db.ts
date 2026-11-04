import type {
  AppSettings,
  AudioBlobRecord,
  Card,
  Deck,
  Folder,
  Link,
  Note,
  Notebook,
  Recording,
  Subject,
  Task,
} from './types'
import { DEFAULT_SETTINGS } from './types'

const DB_NAME = 'myspace-db'
const DB_VERSION = 2

export const STORES = {
  subjects: 'subjects',
  folders: 'folders',
  recordings: 'recordings',
  audioBlobs: 'audioBlobs',
  decks: 'decks',
  cards: 'cards',
  tasks: 'tasks',
  notebooks: 'notebooks',
  notes: 'notes',
  links: 'links',
  settings: 'settings',
  downloads: 'downloads',
  downloadBlobs: 'downloadBlobs',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll()
    req.onsuccess = () => resolve((req.result as T[]) ?? [])
    req.onerror = () => reject(req.error)
  })
}

export async function getById<T>(store: string, id: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(id)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function putOne<T>(store: string, value: T): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value)
  await txDone(tx)
}

export async function putMany<T>(store: string, values: T[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  const os = tx.objectStore(store)
  for (const v of values) os.put(v)
  await txDone(tx)
}

export async function deleteById(store: string, id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).delete(id)
  await txDone(tx)
}

export async function clearStore(store: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).clear()
  await txDone(tx)
}

export async function loadSettings(): Promise<AppSettings> {
  const row = await getById<AppSettings & { id: string }>(STORES.settings, 'app')
  if (!row) return { ...DEFAULT_SETTINGS }
  const { id: _id, ...rest } = row
  void _id
  return { ...DEFAULT_SETTINGS, ...rest }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await putOne(STORES.settings, { id: 'app', ...s })
}

export interface Snapshot {
  version: 1
  exportedAt: number
  settings: AppSettings
  subjects: Subject[]
  folders: Folder[]
  recordings: Recording[]
  decks: Deck[]
  cards: Card[]
  tasks: Task[]
  notebooks: Notebook[]
  notes: Note[]
  links: Link[]
  audio: { id: string; mime: string; data: string }[]
}

export async function exportSnapshot(): Promise<Snapshot> {
  const [settings, subjects, folders, recordings, decks, cards, tasks, notebooks, notes, links, audioRows] =
    await Promise.all([
      loadSettings(),
      getAll<Subject>(STORES.subjects),
      getAll<Folder>(STORES.folders),
      getAll<Recording>(STORES.recordings),
      getAll<Deck>(STORES.decks),
      getAll<Card>(STORES.cards),
      getAll<Task>(STORES.tasks),
      getAll<Notebook>(STORES.notebooks),
      getAll<Note>(STORES.notes),
      getAll<Link>(STORES.links),
      getAll<AudioBlobRecord>(STORES.audioBlobs),
    ])

  const audio: Snapshot['audio'] = []
  for (const row of audioRows) {
    const { blobToBase64 } = await import('./utils')
    audio.push({
      id: row.id,
      mime: row.blob.type || 'audio/webm',
      data: await blobToBase64(row.blob),
    })
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    settings,
    subjects,
    folders,
    recordings,
    decks,
    cards,
    tasks,
    notebooks,
    notes,
    links,
    audio,
  }
}

export async function importSnapshot(snap: Snapshot): Promise<void> {
  const { base64ToBlob } = await import('./utils')
  await Promise.all(Object.values(STORES).map((s) => clearStore(s)))
  await saveSettings(snap.settings ?? DEFAULT_SETTINGS)
  await putMany(STORES.subjects, snap.subjects ?? [])
  await putMany(STORES.folders, snap.folders ?? [])
  await putMany(STORES.recordings, snap.recordings ?? [])
  await putMany(STORES.decks, snap.decks ?? [])
  await putMany(STORES.cards, snap.cards ?? [])
  await putMany(STORES.tasks, snap.tasks ?? [])
  await putMany(STORES.notebooks, snap.notebooks ?? [])
  await putMany(STORES.notes, snap.notes ?? [])
  await putMany(STORES.links, snap.links ?? [])
  const blobs: AudioBlobRecord[] = (snap.audio ?? []).map((a) => ({
    id: a.id,
    blob: base64ToBlob(a.data, a.mime),
  }))
  await putMany(STORES.audioBlobs, blobs)
}

export async function wipeAll(): Promise<void> {
  await Promise.all(Object.values(STORES).map((s) => clearStore(s)))
}
