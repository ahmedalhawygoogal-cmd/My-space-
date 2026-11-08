import type { Priority, Task } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { now } from '../utils'
import { supabase } from './supabase'

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

function remoteToLocal(row: RemoteTask, prev?: Task): Task {
  const date = parseDate(row.date) ?? prev?.date
  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN
  return {
    id: row.id,
    title: row.title ?? prev?.title ?? '',
    description: row.description ?? prev?.description ?? '',
    completed: !!row.completed,
    priority: asPriority(row.priority, prev?.priority),
    date,
    startDate: prev?.startDate,
    dueDate: prev?.dueDate ?? date,
    category: row.category ?? prev?.category ?? '',
    subjectId: prev?.subjectId,
    noteId: prev?.noteId,
    recordingId: prev?.recordingId,
    deckId: prev?.deckId,
    parentId: row.parent_id || prev?.parentId,
    remind: prev?.remind ?? false,
    recurring: prev?.recurring ?? 'none',
    subtasks: prev?.subtasks ?? [],
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
    updatedAt: prev?.updatedAt ?? now(),
    completedAt: row.completed ? prev?.completedAt ?? now() : undefined,
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
  if (!supabase) return null
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
    await supabase.from('tasks').delete().eq('id', id).eq('user_id', uid)
  } catch {
    return
  }
}

export async function pushLocalTasks(tasks: Task[]): Promise<void> {
  const uid = await userId()
  if (!supabase || !uid) return
  const rows = sortForUpsert(tasks)
    .filter((t) => isUuid(t.id))
    .map((t) => localToRemote(t, uid))
  if (!rows.length) return
  try {
    await supabase.from('tasks').upsert(rows, { onConflict: 'id' })
  } catch {
    return
  }
}

export async function syncTasksFromCloud(): Promise<boolean> {
  const uid = await userId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', uid)
    if (error || !data) return false
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
      if (!seen.has(t.id)) merged.push(t)
    }
    await db.putMany(STORES.tasks, merged)
    await pushLocalTasks(merged)
    return true
  } catch {
    return false
  }
}
