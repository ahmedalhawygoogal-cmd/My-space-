import type { Habit, HabitFrequency, HabitLog } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { now } from '../utils'
import { supabase } from './supabase'

// Habits are local-first: IndexedDB is the source of truth for the UI, and
// Supabase is a background replica. Every mutation writes to IndexedDB before
// it touches the network, so the feature keeps working fully offline.

export type RemoteHabit = {
  id: string
  user_id: string
  name: string | null
  is_measurable: boolean | null
  target_count: number | null
  frequency: string | null
  reminder: string | null
  why: string | null
  icon: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at?: string | null
}

export type RemoteHabitLog = {
  id: string
  user_id: string
  habit_id: string
  date: string | null
  count: number | null
  created_at: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

function asFrequency(raw: string | null | undefined): HabitFrequency {
  return raw === 'weekly' || raw === 'monthly' || raw === 'yearly' || raw === 'daily' ? raw : 'daily'
}

function parseTs(raw: string | null | undefined, fallback = now()): number {
  if (!raw) return fallback
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : fallback
}

export function remoteToHabit(row: RemoteHabit): Habit {
  return {
    id: row.id,
    name: row.name ?? '',
    isMeasurable: !!row.is_measurable,
    targetCount: Math.max(1, Number(row.target_count) || 1),
    frequency: asFrequency(row.frequency),
    reminder: row.reminder || '',
    why: row.why ?? '',
    icon: row.icon || 'sparkles',
    createdAt: parseTs(row.created_at),
    updatedAt: parseTs(row.updated_at),
  }
}

export function remoteToLog(row: RemoteHabitLog): HabitLog {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: (row.date || '').slice(0, 10),
    count: Math.max(1, Number(row.count) || 1),
    createdAt: parseTs(row.created_at),
  }
}

function habitRow(habit: Habit, userId: string) {
  return {
    id: habit.id,
    user_id: userId,
    name: habit.name,
    is_measurable: habit.isMeasurable,
    target_count: habit.isMeasurable ? habit.targetCount : null,
    frequency: habit.frequency,
    reminder: habit.reminder || null,
    why: habit.why || null,
    icon: habit.icon,
    created_at: new Date(habit.createdAt).toISOString(),
    updated_at: new Date(habit.updatedAt).toISOString(),
  }
}

function logRow(log: HabitLog, userId: string) {
  return {
    id: log.id,
    user_id: userId,
    habit_id: log.habitId,
    date: log.date,
    count: log.count,
    created_at: new Date(log.createdAt).toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

// ------------------------------------------------------------------ cache

export async function cachedHabits(): Promise<Habit[]> {
  return db.getAll<Habit>(STORES.habits)
}

export async function cachedHabitLogs(habitId?: string): Promise<HabitLog[]> {
  const rows = await db.getAll<HabitLog>(STORES.habitLogs)
  return habitId ? rows.filter((r) => r.habitId === habitId) : rows
}

// ------------------------------------------------------------------ push

async function pushHabit(habit: Habit): Promise<void> {
  const uid = await currentUserId()
  if (!supabase || !uid) return
  try {
    await supabase.from('habits').upsert(habitRow(habit, uid), { onConflict: 'id' })
  } catch {
    /* offline — the row stays in IndexedDB and is flushed on the next sync */
  }
}

async function pushHabitLog(log: HabitLog): Promise<void> {
  const uid = await currentUserId()
  if (!supabase || !uid) return
  try {
    await supabase.from('habit_logs').upsert(logRow(log, uid), { onConflict: 'id' })
  } catch {
    /* offline — the row stays in IndexedDB and is flushed on the next sync */
  }
}

async function softDeleteRow(table: 'habits' | 'habit_logs', id: string): Promise<void> {
  const uid = await currentUserId()
  if (!supabase || !uid) return
  try {
    const stamp = new Date().toISOString()
    await supabase
      .from(table)
      .update({ deleted_at: stamp, updated_at: stamp })
      .eq('id', id)
      .eq('user_id', uid)
  } catch {
    /* offline — the local delete already happened */
  }
}

async function flushHabits(habits: Habit[]): Promise<void> {
  const uid = await currentUserId()
  if (!supabase || !uid) return
  const rows = habits.map((h) => habitRow(h, uid))
  if (!rows.length) return
  try {
    await supabase.from('habits').upsert(rows, { onConflict: 'id' })
  } catch {
    /* offline — retried on the next sync */
  }
}

async function flushLogs(logs: HabitLog[]): Promise<void> {
  const uid = await currentUserId()
  if (!supabase || !uid) return
  const rows = logs.map((l) => logRow(l, uid))
  if (!rows.length) return
  try {
    await supabase.from('habit_logs').upsert(rows, { onConflict: 'id' })
  } catch {
    /* offline — retried on the next sync */
  }
}

// ------------------------------------------------------------------ sync

/** Merges remote habits into IndexedDB and flushes anything only known locally. */
export async function syncHabitsFromCloud(): Promise<boolean> {
  const uid = await currentUserId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', uid)
      .is('deleted_at', null)
    if (error || !data) return false
    const { data: tombstones } = await supabase
      .from('habits')
      .select('id')
      .eq('user_id', uid)
      .not('deleted_at', 'is', null)
    const deletedIds = new Set((tombstones ?? []).map((r) => (r as { id: string }).id))

    const local = await db.getAll<Habit>(STORES.habits)
    const localById = new Map(local.map((h) => [h.id, h]))
    const seen = new Set<string>()
    const merged: Habit[] = []
    for (const row of data as RemoteHabit[]) {
      seen.add(row.id)
      const remote = remoteToHabit(row)
      const prev = localById.get(row.id)
      // A local edit newer than the remote copy wins until it is pushed.
      merged.push(prev && prev.updatedAt > remote.updatedAt ? prev : remote)
    }
    for (const h of local) {
      if (seen.has(h.id) || deletedIds.has(h.id)) continue
      merged.push(h)
    }
    for (const id of deletedIds) await db.deleteById(STORES.habits, id)
    await db.putMany(STORES.habits, merged)
    await flushHabits(merged)
    return true
  } catch {
    return false
  }
}

/** Same contract as syncHabitsFromCloud, for habit logs. */
export async function syncHabitLogsFromCloud(): Promise<boolean> {
  const uid = await currentUserId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', uid)
      .is('deleted_at', null)
    if (error || !data) return false
    const { data: tombstones } = await supabase
      .from('habit_logs')
      .select('id')
      .eq('user_id', uid)
      .not('deleted_at', 'is', null)
    const deletedIds = new Set((tombstones ?? []).map((r) => (r as { id: string }).id))

    const local = await db.getAll<HabitLog>(STORES.habitLogs)
    const seen = new Set<string>()
    const merged: HabitLog[] = []
    for (const row of data as RemoteHabitLog[]) {
      seen.add(row.id)
      merged.push(remoteToLog(row))
    }
    for (const l of local) {
      if (seen.has(l.id) || deletedIds.has(l.id)) continue
      merged.push(l)
    }
    for (const id of deletedIds) await db.deleteById(STORES.habitLogs, id)
    await db.putMany(STORES.habitLogs, merged)
    await flushLogs(merged)
    return true
  } catch {
    return false
  }
}

// ------------------------------------------------------------------ reads

export async function fetchHabits(): Promise<Habit[]> {
  const cached = await cachedHabits()
  const synced = await syncHabitsFromCloud()
  if (!synced) return cached
  return cachedHabits()
}

export async function fetchHabitLogs(habitId?: string): Promise<HabitLog[]> {
  const cached = await cachedHabitLogs(habitId)
  const synced = await syncHabitLogsFromCloud()
  if (!synced) return cached
  return cachedHabitLogs(habitId)
}

// ------------------------------------------------------------------ writes

export async function createHabit(habit: Habit): Promise<Habit | null> {
  try {
    await db.putOne(STORES.habits, habit)
  } catch {
    return null
  }
  void pushHabit(habit)
  return habit
}

export async function upsertHabit(habit: Habit): Promise<Habit | null> {
  try {
    await db.putOne(STORES.habits, habit)
  } catch {
    return null
  }
  void pushHabit(habit)
  return habit
}

export async function removeHabit(id: string): Promise<boolean> {
  try {
    await db.deleteById(STORES.habits, id)
    const logs = await cachedHabitLogs(id)
    await Promise.all(logs.map((l) => db.deleteById(STORES.habitLogs, l.id)))
    void softDeleteRow('habits', id)
    for (const l of logs) void softDeleteRow('habit_logs', l.id)
    return true
  } catch {
    return false
  }
}

export async function upsertHabitLog(log: HabitLog): Promise<HabitLog | null> {
  try {
    await db.putOne(STORES.habitLogs, log)
  } catch {
    return null
  }
  void pushHabitLog(log)
  return log
}

export async function removeHabitLog(id: string): Promise<boolean> {
  try {
    await db.deleteById(STORES.habitLogs, id)
  } catch {
    return false
  }
  void softDeleteRow('habit_logs', id)
  return true
}
