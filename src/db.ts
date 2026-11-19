import type {
  AppSettings,
  AudioBlobRecord,
  Card,
  Deck,
  Folder,
  Habit,
  HabitLog,
  Link,
  Note,
  Notebook,
  Recording,
  Subject,
  Task,
} from './types'
import { DEFAULT_SETTINGS } from './types'

const DB_NAME = 'myspace-db'
const DB_VERSION = 7

export const STORES = {
  subjects: 'subjects',
  folders: 'folders',
  recordings: 'recordings',
  audioBlobs: 'audioBlobs',
  originalAudioBlobs: 'originalAudioBlobs',
  decks: 'decks',
  cards: 'cards',
  tasks: 'tasks',
  notebooks: 'notebooks',
  notes: 'notes',
  habits: 'habits',
  habitLogs: 'habitLogs',
  links: 'links',
  settings: 'settings',
  downloads: 'downloads',
  downloadBlobs: 'downloadBlobs',
  customQuotes: 'customQuotes',
  favoriteQuoteIds: 'favoriteQuoteIds',
} as const

/**
 * AI chat history is device-local only, so it lives in its own stores that are
 * intentionally kept out of `STORES`: backup export/import and the snapshot
 * import path must never copy, overwrite or wipe a private chat log, and the
 * AI history code is the only reader/writer.
 */
export const AI_STORES = {
  aiConversations: 'aiConversations',
  aiMessages: 'aiMessages',
} as const

/** Lets one conversation's messages be read without scanning every chat. */
export const AI_MESSAGES_CONVERSATION_INDEX = 'conversationId'

/**
 * Workflow Foundation stores: Spaces, the Universal Inbox and Workflows.
 * Kept out of `STORES` on purpose: `importSnapshot` clears every store listed
 * in `STORES` before restoring, so joining that list before the snapshot
 * format carries these entities would wipe a user's spaces, inbox and
 * workflows on a backup restore.
 */
export const SPACE_STORES = {
  spaces: 'spaces',
  inbox: 'inbox_items',
  workflows: 'workflows',
  workflowRuns: 'workflow_runs',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of [
        ...Object.values(STORES),
        ...Object.values(AI_STORES),
        ...Object.values(SPACE_STORES),
      ]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
      const messages = req.transaction?.objectStore(AI_STORES.aiMessages)
      if (messages && !messages.indexNames.contains(AI_MESSAGES_CONVERSATION_INDEX)) {
        messages.createIndex(AI_MESSAGES_CONVERSATION_INDEX, 'conversationId', { unique: false })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      // Release the connection when another tab needs a newer version instead
      // of leaving that upgrade blocked until this tab is closed.
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
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

export async function getAllByIndex<T>(store: string, index: string, value: IDBValidKey): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).index(index).getAll(value)
    req.onsuccess = () => resolve((req.result as T[]) ?? [])
    req.onerror = () => reject(req.error)
  })
}

export async function deleteByIndex(store: string, index: string, value: IDBValidKey): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  const os = tx.objectStore(store)
  const cursorReq = os.index(index).openKeyCursor(value)
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result
    if (!cursor) return
    os.delete(cursor.primaryKey)
    cursor.continue()
  }
  await txDone(tx)
}

export async function deleteById(store: string, id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).delete(id)
  await txDone(tx)
}

async function clearStore(store: string): Promise<void> {
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
  habits?: Habit[]
  habitLogs?: HabitLog[]
  links: Link[]
  audio: { id: string; mime: string; data: string }[]
}

export async function exportSnapshot(): Promise<Snapshot> {
  const [settings, subjects, folders, recordings, decks, cards, tasks, notebooks, notes, habits, habitLogs, links, audioRows] =
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
      getAll<Habit>(STORES.habits),
      getAll<HabitLog>(STORES.habitLogs),
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
    habits,
    habitLogs,
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
  await putMany(STORES.habits, snap.habits ?? [])
  await putMany(STORES.habitLogs, snap.habitLogs ?? [])
  await putMany(STORES.links, snap.links ?? [])
  const blobs: AudioBlobRecord[] = (snap.audio ?? []).map((a) => ({
    id: a.id,
    blob: base64ToBlob(a.data, a.mime),
  }))
  await putMany(STORES.audioBlobs, blobs)
}

