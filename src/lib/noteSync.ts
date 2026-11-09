import type { Note } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { now } from '../utils'
import { isCloudSyncEnabled } from './cloudPref'
import { assertOnline, supabase, throwIfError } from './supabase'
import { isUuid } from './taskSync'

type RemoteNote = {
  id: string
  user_id: string
  title: string | null
  content: string | null
  type: string | null
  color: string | null
  is_pinned: boolean | null
  created_at: string | null
}

function remoteToLocal(row: RemoteNote, prev?: Note): Note {
  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN
  return {
    id: row.id,
    notebookId: prev?.notebookId ?? '',
    folderId: prev?.folderId,
    title: row.title ?? prev?.title ?? '',
    type: row.type ?? prev?.type ?? '',
    content: row.content ?? prev?.content ?? '',
    color: row.color ?? prev?.color ?? '#FFF8E7',
    audioId: prev?.audioId,
    tags: prev?.tags ?? [],
    pinned: row.is_pinned ?? prev?.pinned ?? false,
    subjectId: prev?.subjectId,
    recordingIds: prev?.recordingIds ?? [],
    taskIds: prev?.taskIds ?? [],
    attachments: prev?.attachments ?? [],
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
    updatedAt: prev?.updatedAt ?? now(),
  }
}

function localToRemote(note: Note, userId: string): RemoteNote {
  return {
    id: note.id,
    user_id: userId,
    title: note.title ?? '',
    content: note.content ?? '',
    type: note.type ?? '',
    color: note.color ?? '',
    is_pinned: !!note.pinned,
    created_at: new Date(note.createdAt || now()).toISOString(),
  }
}

async function userId(): Promise<string | null> {
  if (!supabase || !isCloudSyncEnabled()) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

export async function upsertRemoteNote(note: Note): Promise<void> {
  if (!isUuid(note.id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from('notes').upsert(localToRemote(note, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function removeRemoteNote(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from('notes').delete().eq('id', id).eq('user_id', uid)
  } catch {
    return
  }
}

export async function pushLocalNotes(notes: Note[]): Promise<void> {
  assertOnline()
  const uid = await userId()
  if (!supabase || !uid) throw new Error('not signed in')
  const rows = notes.filter((n) => isUuid(n.id)).map((n) => localToRemote(n, uid))
  if (!rows.length) return
  throwIfError(await supabase.from('notes').upsert(rows, { onConflict: 'id' }))
}

export async function syncNotesFromCloud(): Promise<boolean> {
  const uid = await userId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase.from('notes').select('*').eq('user_id', uid)
    if (error || !data) return false
    const local = await db.getAll<Note>(STORES.notes)
    const localById = new Map(local.map((n) => [n.id, n]))
    const remote = data as RemoteNote[]
    const seen = new Set<string>()
    const merged: Note[] = []
    for (const row of remote) {
      if (!isUuid(row.id)) continue
      seen.add(row.id)
      merged.push(remoteToLocal(row, localById.get(row.id)))
    }
    for (const n of local) {
      if (!seen.has(n.id)) merged.push(n)
    }
    const notebooks = await db.getAll<{ id: string }>(STORES.notebooks)
    const fallbackNb = notebooks[0]?.id ?? ''
    const assigned = merged.map((n) => (n.notebookId ? n : { ...n, notebookId: fallbackNb }))
    await db.putMany(STORES.notes, assigned)
    await pushLocalNotes(assigned)
    return true
  } catch {
    return false
  }
}
