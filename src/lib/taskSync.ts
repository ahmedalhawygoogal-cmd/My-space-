import type { Priority, Recurrence, Subtask, Task } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { now } from '../utils'
import { isCloudSyncEnabled } from './cloudPref'
import { assertOnline, supabase, throwIfError } from './supabase'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(id: string | undefined | null): id is string {
  return !!id && UUID_RE.test(id)
}

type RemoteTask = {
  id: string
  user_id: string
  title: string | null
  description: string | null
  category: string | null
  priority: string | null
  date: string | null
  parent_id: string | null
  completed: boolean | null
  created_at: string | null
  start_date?: string | null
  due_date?: string | null
  subject_id?: string | null
  space_id?: string | null
  note_id?: string | null
  recording_id?: string | null
  deck_id?: string | null
  remind?: boolean | null
  recurring?: string | null
  subtasks?: Subtask[] | null
  completed_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

function parseDate(raw: string | null): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return n
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : undefined
}

function asPriority(raw: string | null | undefined, fallback: Priority = 'medium'): Priority {
  return raw === 'low' || raw === 'high' || raw === 'medium' ? raw : fallback
}

function asRecurrence(raw: string | null | undefined, fallback: Recurrence = 'none'): Recurrence {
  return raw === 'daily' || raw === 'weekly' || raw === 'none' ? raw : fallback
}

function isoOrNull(ms?: number | null): string | null {
  return ms != null && Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

function asSubtasks(raw: Subtask[] | null | undefined, fallback: Subtask[]): Subtask[] {
  return Array.isArray(raw) ? raw : fallback
}

function remoteToLocal(row: RemoteTask, prev?: Task): Task {
  const date = parseDate(row.date) ?? prev?.date
  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : NaN
  return {
    id: row.id,
    title: row.title ?? prev?.title ?? '',
    description: row.description ?? prev?.description ?? '',
    completed: !!row.completed,
    priority: asPriority(row.priority, prev?.priority),
    date,
    startDate: parseDate(row.start_date ?? null) ?? prev?.startDate,
    dueDate: parseDate(row.due_date ?? null) ?? prev?.dueDate ?? date,
    category: row.category ?? prev?.category ?? '',
    subjectId: row.subject_id ?? prev?.subjectId,
    space_id: row.space_id ?? prev?.space_id,
    noteId: row.note_id ?? prev?.noteId,
    recordingId: row.recording_id ?? prev?.recordingId,
    deckId: row.deck_id ?? prev?.deckId,
    parentId: row.parent_id || prev?.parentId,
    remind: row.remind ?? prev?.remind ?? false,
    recurring: asRecurrence(row.recurring, prev?.recurring),
    subtasks: asSubtasks(row.subtasks, prev?.subtasks ?? []),
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : prev?.updatedAt ?? now(),
    completedAt:
      parseDate(row.completed_at ?? null) ??
      (row.completed ? prev?.completedAt ?? now() : undefined),
  }
}

function localToRemote(task: Task, userId: string): RemoteTask {
  const date = task.date ?? task.dueDate
  return {
    id: task.id,
    user_id: userId,
    title: task.title ?? '',
    description: task.description ?? '',
    category: task.category ?? '',
    priority: task.priority ?? 'medium',
    date: date != null ? String(date) : null,
    parent_id: isUuid(task.parentId) ? task.parentId : null,
    completed: !!task.completed,
    created_at: new Date(task.createdAt || now()).toISOString(),
    start_date: isoOrNull(task.startDate),
    due_date: isoOrNull(task.dueDate),
    subject_id: task.subjectId ?? null,
    space_id: task.space_id ?? null,
    note_id: task.noteId ?? null,
    recording_id: task.recordingId ?? null,
    deck_id: task.deckId ?? null,
    remind: !!task.remind,
    recurring: task.recurring ?? 'none',
    subtasks: task.subtasks ?? [],
    completed_at: isoOrNull(task.completedAt),
    updated_at: new Date(task.updatedAt || now()).toISOString(),
  }
}

function sortForUpsert(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ap = a.parentId ? 1 : 0
    const bp = b.parentId ? 1 : 0
    return ap - bp
  })
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

export async function upsertRemoteTask(task: Task): Promise<void> {
  if (!isUuid(task.id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from('tasks').upsert(localToRemote(task, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function removeRemoteTask(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    // Soft delete: the tombstone stops other devices from re-uploading this row.
    const stamp = new Date().toISOString()
    await supabase
      .from('tasks')
      .update({ deleted_at: stamp, updated_at: stamp })
      .eq('id', id)
      .eq('user_id', uid)
  } catch {
    return
  }
}

export async function pushLocalTasks(tasks: Task[]): Promise<void> {
  assertOnline()
  const uid = await userId()
  if (!supabase || !uid) throw new Error('not signed in')
  const rows = sortForUpsert(tasks)
    .filter((t) => isUuid(t.id))
    .map((t) => localToRemote(t, uid))
  if (!rows.length) return
  throwIfError(await supabase.from('tasks').upsert(rows, { onConflict: 'id' }))
}

export async function syncTasksFromCloud(): Promise<boolean> {
  const uid = await userId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', uid)
      .is('deleted_at', null)
    if (error || !data) return false
    // Tombstones are fetched separately so a row deleted elsewhere is also
    // dropped locally — otherwise the merge would push it straight back.
    const { data: tombstones } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', uid)
      .not('deleted_at', 'is', null)
    const deletedIds = new Set((tombstones ?? []).map((r) => (r as { id: string }).id))
    const local = await db.getAll<Task>(STORES.tasks)
    const localById = new Map(local.map((t) => [t.id, t]))
    const remote = data as RemoteTask[]
    const seen = new Set<string>()
    const merged: Task[] = []
    for (const row of remote) {
      if (!isUuid(row.id)) continue
      seen.add(row.id)
      const prev = localById.get(row.id)
      merged.push(remoteToLocal(row, prev))
    }
    for (const t of local) {
      if (seen.has(t.id) || deletedIds.has(t.id)) continue
      merged.push(t)
    }
    for (const id of deletedIds) await db.deleteById(STORES.tasks, id)
    await db.putMany(STORES.tasks, merged)
    await pushLocalTasks(merged)
    return true
  } catch {
    return false
  }
}
