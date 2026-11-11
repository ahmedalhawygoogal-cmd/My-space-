import type { Habit, HabitIconId, HabitLog, HabitMood } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { now } from '../utils'
import { isCloudSyncEnabled } from './cloudPref'
import { assertOnline, supabase, throwIfError } from './supabase'
import { isUuid } from './taskSync'

const ICONS: HabitIconId[] = ['dumbbell', 'book', 'droplet', 'brain', 'heart', 'moon']
const MOODS: HabitMood[] = ['good', 'ok', 'bad']

type RemoteHabit = {
  id: string
  user_id: string
  name: string | null
  icon: string | null
  why: string | null
  created_at: string | null
}

type RemoteHabitLog = {
  id: string
  user_id: string
  habit_id: string
  date: string | null
  mood: string | null
  created_at: string | null
}

function asIcon(raw: string | null | undefined, fallback: HabitIconId = 'heart'): HabitIconId {
  return raw && (ICONS as string[]).includes(raw) ? (raw as HabitIconId) : fallback
}

function asMood(raw: string | null | undefined): HabitMood | undefined {
  return raw && (MOODS as string[]).includes(raw) ? (raw as HabitMood) : undefined
}

function remoteHabitToLocal(row: RemoteHabit, prev?: Habit): Habit {
  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN
  return {
    id: row.id,
    name: row.name ?? prev?.name ?? '',
    icon: asIcon(row.icon, prev?.icon),
    why: row.why ?? prev?.why ?? '',
    color: prev?.color ?? '#0f6e6b',
    target: 'daily',
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
    updatedAt: prev?.updatedAt ?? now(),
  }
}

function localHabitToRemote(habit: Habit, userId: string): RemoteHabit {
  return {
    id: habit.id,
    user_id: userId,
    name: habit.name ?? '',
    icon: habit.icon ?? 'heart',
    why: habit.why ?? '',
    created_at: new Date(habit.createdAt || now()).toISOString(),
  }
}

function remoteLogToLocal(row: RemoteHabitLog, prev?: HabitLog): HabitLog {
  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN
  return {
    id: row.id,
    habitId: row.habit_id || prev?.habitId || '',
    date: row.date ?? prev?.date ?? '',
    mood: asMood(row.mood) ?? prev?.mood,
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
  }
}

function localLogToRemote(log: HabitLog, userId: string): RemoteHabitLog {
  return {
    id: log.id,
    user_id: userId,
    habit_id: log.habitId,
    date: log.date,
    mood: log.mood ?? null,
    created_at: new Date(log.createdAt || now()).toISOString(),
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

export async function upsertRemoteHabit(habit: Habit): Promise<void> {
  if (!isUuid(habit.id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from('habits').upsert(localHabitToRemote(habit, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function removeRemoteHabit(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from('habit_logs').delete().eq('habit_id', id).eq('user_id', uid)
    await supabase.from('habits').delete().eq('id', id).eq('user_id', uid)
  } catch {
    return
  }
}

export async function upsertRemoteHabitLog(log: HabitLog): Promise<void> {
  if (!isUuid(log.id) || !isUuid(log.habitId)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from('habit_logs').upsert(localLogToRemote(log, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function removeRemoteHabitLog(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from('habit_logs').delete().eq('id', id).eq('user_id', uid)
  } catch {
    return
  }
}

export async function pushLocalHabits(habits: Habit[]): Promise<void> {
  assertOnline()
  const uid = await userId()
  if (!supabase || !uid) throw new Error('not signed in')
  const rows = habits.filter((h) => isUuid(h.id)).map((h) => localHabitToRemote(h, uid))
  if (!rows.length) return
  throwIfError(await supabase.from('habits').upsert(rows, { onConflict: 'id' }))
}

export async function pushLocalHabitLogs(logs: HabitLog[]): Promise<void> {
  assertOnline()
  const uid = await userId()
  if (!supabase || !uid) throw new Error('not signed in')
  const rows = logs.filter((l) => isUuid(l.id) && isUuid(l.habitId)).map((l) => localLogToRemote(l, uid))
  if (!rows.length) return
  throwIfError(await supabase.from('habit_logs').upsert(rows, { onConflict: 'id' }))
}

export async function syncHabitsFromCloud(): Promise<boolean> {
  const uid = await userId()
  if (!supabase || !uid) return false
  try {
    const [{ data: habitRows, error: habitErr }, { data: logRows, error: logErr }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', uid),
      supabase.from('habit_logs').select('*').eq('user_id', uid),
    ])
    if (habitErr || logErr || !habitRows || !logRows) return false

    const localHabits = await db.getAll<Habit>(STORES.habits)
    const localLogs = await db.getAll<HabitLog>(STORES.habitLogs)
    const habitById = new Map(localHabits.map((h) => [h.id, h]))
    const logById = new Map(localLogs.map((l) => [l.id, l]))

    const seenHabits = new Set<string>()
    const mergedHabits: Habit[] = []
    for (const row of habitRows as RemoteHabit[]) {
      if (!isUuid(row.id)) continue
      seenHabits.add(row.id)
      mergedHabits.push(remoteHabitToLocal(row, habitById.get(row.id)))
    }
    for (const h of localHabits) {
      if (!seenHabits.has(h.id)) mergedHabits.push(h)
    }

    const seenLogs = new Set<string>()
    const mergedLogs: HabitLog[] = []
    for (const row of logRows as RemoteHabitLog[]) {
      if (!isUuid(row.id)) continue
      seenLogs.add(row.id)
      mergedLogs.push(remoteLogToLocal(row, logById.get(row.id)))
    }
    for (const l of localLogs) {
      if (!seenLogs.has(l.id)) mergedLogs.push(l)
    }

    await db.putMany(STORES.habits, mergedHabits)
    await db.putMany(STORES.habitLogs, mergedLogs)
    await pushLocalHabits(mergedHabits)
    await pushLocalHabitLogs(mergedLogs)
    return true
  } catch {
    return false
  }
}
