import type { Habit, HabitLog } from '../types'
import {
  Activity,
  Apple,
  Bike,
  BookOpen,
  Brain,
  Coffee,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Leaf,
  Moon,
  Music,
  PenLine,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react'

export const HABIT_ICONS: { id: string; Icon: LucideIcon }[] = [
  { id: 'dumbbell', Icon: Dumbbell },
  { id: 'book', Icon: BookOpen },
  { id: 'droplet', Icon: Droplet },
  { id: 'flame', Icon: Flame },
  { id: 'heart', Icon: Heart },
  { id: 'moon', Icon: Moon },
  { id: 'sun', Icon: Sun },
  { id: 'leaf', Icon: Leaf },
  { id: 'music', Icon: Music },
  { id: 'brain', Icon: Brain },
  { id: 'coffee', Icon: Coffee },
  { id: 'footprints', Icon: Footprints },
  { id: 'pen', Icon: PenLine },
  { id: 'sparkles', Icon: Sparkles },
  { id: 'bike', Icon: Bike },
  { id: 'apple', Icon: Apple },
  { id: 'activity', Icon: Activity },
]

export function habitIcon(id: string): LucideIcon {
  return HABIT_ICONS.find((x) => x.id === id)?.Icon ?? Sparkles
}

export function isoDate(ts = Date.now()): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIsoDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1).getTime()
}

export function addCalendarDays(ts: number, days: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  d.setHours(12, 0, 0, 0)
  return d.getTime()
}

export function startOfWeekSunday(ts = Date.now()): number {
  const d = new Date(ts)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.getTime()
}

export function weekDays(ts = Date.now()): number[] {
  const start = startOfWeekSunday(ts)
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(start, i))
}

export function isFutureDay(ts: number): boolean {
  return isoDate(ts) > isoDate()
}

export function logKey(habitId: string, date: string): string {
  return `${habitId}:${date}`
}

export function logsByHabitDate(logs: HabitLog[]): Map<string, HabitLog> {
  const map = new Map<string, HabitLog>()
  for (const log of logs) map.set(logKey(log.habitId, log.date), log)
  return map
}

export function isDayComplete(habit: Habit, log?: HabitLog): boolean {
  if (!log) return false
  if (!habit.isMeasurable) return log.count > 0
  return log.count >= Math.max(1, habit.targetCount)
}

export function currentStreak(habit: Habit, logs: HabitLog[]): number {
  const done = new Set(
    logs.filter((l) => l.habitId === habit.id && isDayComplete(habit, l)).map((l) => l.date),
  )
  let cursor = isoDate()
  if (!done.has(cursor)) cursor = isoDate(addCalendarDays(Date.now(), -1))
  let n = 0
  while (done.has(cursor)) {
    n += 1
    cursor = isoDate(addCalendarDays(parseIsoDate(cursor), -1))
  }
  return n
}

export function emptyHabitDraft() {
  return {
    name: '',
    isMeasurable: false,
    targetCount: 1,
    frequency: 'daily' as Habit['frequency'],
    reminder: '09:00',
    why: '',
    icon: 'dumbbell',
  }
}

export type HabitDraft = ReturnType<typeof emptyHabitDraft>

export function draftFromHabit(h: Habit): HabitDraft {
  return {
    name: h.name,
    isMeasurable: h.isMeasurable,
    targetCount: h.targetCount || 1,
    frequency: h.frequency,
    reminder: h.reminder || '09:00',
    why: h.why,
    icon: h.icon || 'dumbbell',
  }
}
