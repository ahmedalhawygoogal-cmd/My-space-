import type { Habit, HabitFrequency, HabitLog } from '../types'
import { now } from '../utils'
import { supabase } from './supabase'

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
}

export type RemoteHabitLog = {
  id: string
  user_id: string
  habit_id: string
  date: string | null
  count: number | null
  created_at: string | null
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

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

export async function fetchHabits(): Promise<Habit[]> {
  const uid = await currentUserId()
  if (!supabase || !uid) return []
  const { data, error } = await supabase.from('habits').select('*').eq('user_id', uid).order('created_at', { ascending: true })
  if (error || !data) return []
  return (data as RemoteHabit[]).map(remoteToHabit)
}

export async function fetchHabitLogs(habitId?: string): Promise<HabitLog[]> {
  const uid = await currentUserId()
  if (!supabase || !uid) return []
  let q = supabase.from('habit_logs').select('*').eq('user_id', uid)
  if (habitId) q = q.eq('habit_id', habitId)
  const { data, error } = await q
  if (error || !data) return []
  return (data as RemoteHabitLog[]).map(remoteToLog)
}

export async function upsertHabit(habit: Habit): Promise<Habit | null> {
  const uid = await currentUserId()
  if (!supabase || !uid) return null
  const row = {
    id: habit.id,
    user_id: uid,
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
  const { data, error } = await supabase.from('habits').upsert(row, { onConflict: 'id' }).select('*').single()
  if (error || !data) return null
  return remoteToHabit(data as RemoteHabit)
}

export async function removeHabit(id: string): Promise<boolean> {
  const uid = await currentUserId()
  if (!supabase || !uid) return false
  await supabase.from('habit_logs').delete().eq('habit_id', id).eq('user_id', uid)
  const { error } = await supabase.from('habits').delete().eq('id', id).eq('user_id', uid)
  return !error
}

export async function upsertHabitLog(log: HabitLog): Promise<HabitLog | null> {
  const uid = await currentUserId()
  if (!supabase || !uid) return null
  const row = {
    id: log.id,
    user_id: uid,
    habit_id: log.habitId,
    date: log.date,
    count: log.count,
    created_at: new Date(log.createdAt).toISOString(),
  }
  const { data, error } = await supabase.from('habit_logs').upsert(row, { onConflict: 'id' }).select('*').single()
  if (error || !data) return null
  return remoteToLog(data as RemoteHabitLog)
}

export async function removeHabitLog(id: string): Promise<boolean> {
  const uid = await currentUserId()
  if (!supabase || !uid) return false
  const { error } = await supabase.from('habit_logs').delete().eq('id', id).eq('user_id', uid)
  return !error
}
