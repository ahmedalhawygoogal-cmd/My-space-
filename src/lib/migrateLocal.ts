import type { Card, Deck, Link, Note, Recording, Task } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { isCloudSyncEnabled } from './cloudPref'
import { supabase } from './supabase'
import { upsertRemoteCard } from './cardSync'
import { upsertRemoteDeck } from './deckSync'
import { upsertRemoteNote } from './noteSync'
import { pushRecordingToCloud } from './recordingSync'
import { isUuid, upsertRemoteTask } from './taskSync'

const MAP_KEY = 'myspace-id-migrate'

type IdMap = Record<string, string>

function loadMap(): IdMap {
  try {
    const raw = localStorage.getItem(MAP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as IdMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveMap(map: IdMap): void {
  localStorage.setItem(MAP_KEY, JSON.stringify(map))
}

async function sessionUserId(): Promise<string | null> {
  if (!supabase || !isCloudSyncEnabled()) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

function stamp<T extends { id: string }>(row: T, id: string, uid: string): T & { userId: string } {
  return { ...row, id, userId: uid }
}

function remap(id: string | undefined, map: IdMap): string | undefined {
  if (!id) return id
  return map[id] ?? id
}

async function remoteFingerprints(
  table: string,
  uid: string,
  keyOf: (row: Record<string, unknown>) => string,
): Promise<{ ids: Set<string>; byKey: Map<string, string> }> {
  const ids = new Set<string>()
  const byKey = new Map<string, string>()
  if (!supabase) return { ids, byKey }
  try {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', uid)
    if (error || !data) return { ids, byKey }
    for (const row of data as Record<string, unknown>[]) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id) continue
      ids.add(id)
      const key = keyOf(row)
      if (key && !byKey.has(key)) byKey.set(key, id)
    }
  } catch {
    return { ids, byKey }
  }
  return { ids, byKey }
}

function assignId(oldId: string, map: IdMap, byKey: Map<string, string>, key: string): string {
  if (isUuid(oldId)) return oldId
  if (map[oldId] && isUuid(map[oldId])) return map[oldId]
  const matched = byKey.get(key)
  if (matched && isUuid(matched)) {
    map[oldId] = matched
    return matched
  }
  const next = crypto.randomUUID()
  map[oldId] = next
  return next
}

async function moveBlob(store: string, from: string, to: string): Promise<void> {
  if (from === to) return
  const row = await db.getById<{ id: string; blob: Blob }>(store, from)
  if (!row?.blob) return
  await db.putOne(store, { id: to, blob: row.blob })
  await db.deleteById(store, from)
}

async function replaceStore<T extends { id: string }>(store: string, next: T[], prev: T[]): Promise<void> {
  const keep = new Set(next.map((x) => x.id))
  await db.putMany(store, next)
  await Promise.all(prev.filter((x) => !keep.has(x.id)).map((x) => db.deleteById(store, x.id)))
}

export async function migrateLocalDataToCloud(): Promise<boolean> {
  const uid = await sessionUserId()
  if (!supabase || !uid) return false

  const [tasks, notes, decks, cards, recordings, links] = await Promise.all([
    db.getAll<Task>(STORES.tasks),
    db.getAll<Note>(STORES.notes),
    db.getAll<Deck>(STORES.decks),
    db.getAll<Card>(STORES.cards),
    db.getAll<Recording>(STORES.recordings),
    db.getAll<Link>(STORES.links),
  ])

  const needs = [...tasks, ...notes, ...decks, ...cards, ...recordings].some((x) => !isUuid(x.id))
  if (!needs) return false

  const [remoteTasks, remoteNotes, remoteDecks, remoteCards, remoteRecs] = await Promise.all([
    remoteFingerprints('tasks', uid, (r) => `${r.title ?? ''}|${r.created_at ?? ''}`),
    remoteFingerprints('notes', uid, (r) => `${r.title ?? ''}|${r.created_at ?? ''}`),
    remoteFingerprints('decks', uid, (r) => `${r.name ?? ''}|${r.created_at ?? ''}`),
    remoteFingerprints('cards', uid, (r) => `${r.front ?? ''}|${r.back ?? ''}|${r.created_at ?? ''}`),
    remoteFingerprints('recordings', uid, (r) => `${r.name ?? ''}|${r.created_at ?? ''}`),
  ])

  const map = loadMap()

  for (const d of decks) {
    assignId(d.id, map, remoteDecks.byKey, `${d.name}|${new Date(d.createdAt || 0).toISOString()}`)
  }
  for (const n of notes) {
    assignId(n.id, map, remoteNotes.byKey, `${n.title}|${new Date(n.createdAt || 0).toISOString()}`)
  }
  for (const t of tasks) {
    assignId(t.id, map, remoteTasks.byKey, `${t.title}|${new Date(t.createdAt || 0).toISOString()}`)
  }
  for (const c of cards) {
    assignId(c.id, map, remoteCards.byKey, `${c.front}|${c.back}|${new Date(c.createdAt || 0).toISOString()}`)
  }
  for (const r of recordings) {
    assignId(r.id, map, remoteRecs.byKey, `${r.name}|${new Date(r.createdAt || 0).toISOString()}`)
  }
  saveMap(map)

  const nextDecks = decks.map((d) =>
    stamp(
      {
        ...d,
        noteId: remap(d.noteId, map),
      },
      remap(d.id, map) as string,
      uid,
    ),
  )
  const nextNotes = notes.map((n) =>
    stamp(
      {
        ...n,
        audioId: remap(n.audioId, map),
        recordingIds: (n.recordingIds ?? []).map((id) => remap(id, map) as string),
        taskIds: (n.taskIds ?? []).map((id) => remap(id, map) as string),
      },
      remap(n.id, map) as string,
      uid,
    ),
  )
  const nextTasks = tasks.map((t) =>
    stamp(
      {
        ...t,
        parentId: remap(t.parentId, map),
        noteId: remap(t.noteId, map),
        recordingId: remap(t.recordingId, map),
        deckId: remap(t.deckId, map),
      },
      remap(t.id, map) as string,
      uid,
    ),
  )
  const nextCards = cards.map((c) =>
    stamp(
      {
        ...c,
        deckId: remap(c.deckId, map) as string,
      },
      remap(c.id, map) as string,
      uid,
    ),
  )
  const nextRecordings = recordings.map((r) =>
    stamp(
      {
        ...r,
        noteIds: (r.noteIds ?? []).map((id) => remap(id, map) as string),
      },
      remap(r.id, map) as string,
      uid,
    ),
  )
  const nextLinks = links.map((l) => ({
    ...l,
    fromId: remap(l.fromId, map) as string,
    toId: remap(l.toId, map) as string,
  }))

  await replaceStore(STORES.decks, nextDecks, decks)
  await replaceStore(STORES.notes, nextNotes, notes)
  await replaceStore(STORES.tasks, nextTasks, tasks)
  await replaceStore(STORES.cards, nextCards, cards)
  await replaceStore(STORES.recordings, nextRecordings, recordings)
  await db.putMany(STORES.links, nextLinks)

  await Promise.all(
    recordings.map((r) => {
      const to = remap(r.id, map) as string
      return Promise.all([moveBlob(STORES.audioBlobs, r.id, to), moveBlob(STORES.originalAudioBlobs, r.id, to)])
    }),
  )

  for (const d of nextDecks) {
    if (!isUuid(d.id) || remoteDecks.ids.has(d.id)) continue
    await upsertRemoteDeck(d)
  }
  for (const n of nextNotes) {
    if (!isUuid(n.id) || remoteNotes.ids.has(n.id)) continue
    await upsertRemoteNote(n)
  }
  const orderedTasks = [...nextTasks].sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0))
  for (const t of orderedTasks) {
    if (!isUuid(t.id) || remoteTasks.ids.has(t.id)) continue
    await upsertRemoteTask(t)
  }
  for (const c of nextCards) {
    if (!isUuid(c.id) || !isUuid(c.deckId) || remoteCards.ids.has(c.id)) continue
    await upsertRemoteCard(c)
  }
  for (const r of nextRecordings) {
    if (!isUuid(r.id)) continue
    if (remoteRecs.ids.has(r.id) && r.cloudUrl) continue
    await pushRecordingToCloud(r)
  }

  return true
}
