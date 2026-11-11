import { useCallback, useEffect, useMemo, useState } from 'react'
import { Book, Brain, Check, Droplet, Dumbbell, Heart, Moon, Plus, Repeat } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import * as db from '../db'
import { STORES } from '../db'
import { Empty, useT } from '../ui'
import { PageLayout } from '../components/PageLayout'
import { now } from '../utils'
import { SUBJECT_COLORS, type Habit, type HabitIconId, type HabitLog } from '../types'
import {
  removeRemoteHabitLog,
  syncHabitsFromCloud,
  upsertRemoteHabit,
  upsertRemoteHabitLog,
} from '../lib/habitSync'

const ICONS: { id: HabitIconId; Icon: LucideIcon }[] = [
  { id: 'dumbbell', Icon: Dumbbell },
  { id: 'book', Icon: Book },
  { id: 'droplet', Icon: Droplet },
  { id: 'brain', Icon: Brain },
  { id: 'heart', Icon: Heart },
  { id: 'moon', Icon: Moon },
]

const ICON_MAP: Record<HabitIconId, LucideIcon> = {
  dumbbell: Dumbbell,
  book: Book,
  droplet: Droplet,
  brain: Brain,
  heart: Heart,
  moon: Moon,
}

const DOW_KEYS = ['dowSun', 'dowMon', 'dowTue', 'dowWed', 'dowThu', 'dowFri', 'dowSat'] as const

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfWeek(ts = Date.now()): Date {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function weekDays(ts = Date.now()): Date[] {
  const start = startOfWeek(ts)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export default function HabitsPage() {
  const tr = useT()
  const days = useMemo(() => weekDays(), [])
  const today = ymd(new Date())
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<HabitIconId>('heart')
  const [color, setColor] = useState(SUBJECT_COLORS[0])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    await syncHabitsFromCloud().catch(() => false)
    const [h, l] = await Promise.all([
      db.getAll<Habit>(STORES.habits),
      db.getAll<HabitLog>(STORES.habitLogs),
    ])
    setHabits(h.sort((a, b) => a.createdAt - b.createdAt))
    setLogs(l)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const doneSet = useMemo(() => {
    const s = new Set<string>()
    for (const log of logs) s.add(`${log.habitId}:${log.date}`)
    return s
  }, [logs])

  async function saveHabit() {
    const title = name.trim()
    if (!title || busy) return
    setBusy(true)
    const item: Habit = {
      id: crypto.randomUUID(),
      name: title,
      icon,
      color,
      target: 'daily',
      createdAt: now(),
      updatedAt: now(),
    }
    await db.putOne(STORES.habits, item)
    setHabits((prev) => [...prev, item])
    setOpen(false)
    setName('')
    setIcon('heart')
    setColor(SUBJECT_COLORS[0])
    setBusy(false)
    void upsertRemoteHabit(item)
  }

  async function toggleDay(habit: Habit, date: string) {
    const existing = logs.find((l) => l.habitId === habit.id && l.date === date)
    if (existing) {
      await db.deleteById(STORES.habitLogs, existing.id)
      setLogs((prev) => prev.filter((l) => l.id !== existing.id))
      void removeRemoteHabitLog(existing.id)
      return
    }
    const log: HabitLog = {
      id: crypto.randomUUID(),
      habitId: habit.id,
      date,
      createdAt: now(),
    }
    await db.putOne(STORES.habitLogs, log)
    setLogs((prev) => [...prev, log])
    void upsertRemoteHabitLog(log)
  }

  return (
    <PageLayout icon={Repeat}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="spread">
          <h1 className="page-title">{tr('habits')}</h1>
          <button className="icon-btn" type="button" aria-label={tr('addHabit')} onClick={() => setOpen(true)}>
            <Plus size={20} />
          </button>
        </div>

        <div className="habit-week-head">
          <div className="habit-name-col" />
          {days.map((d) => (
            <div key={ymd(d)} className={`habit-day-label${ymd(d) === today ? ' is-today' : ''}`}>
              <span>{tr(DOW_KEYS[d.getDay()])}</span>
              <b>{d.getDate()}</b>
            </div>
          ))}
        </div>

        {habits.length === 0 ? (
          <Empty icon={<Repeat size={36} />} title={tr('noHabits')} hint={tr('habitsSubtitle')} />
        ) : (
          <div className="habit-list">
            {habits.map((h) => {
              const Icon = ICON_MAP[h.icon] || Heart
              return (
                <div key={h.id} className="habit-row">
                  <div className="habit-name-col">
                    <span className="habit-dot" style={{ background: h.color }}>
                      <Icon size={12} />
                    </span>
                    <span className="habit-title">{h.name}</span>
                  </div>
                  {days.map((d) => {
                    const date = ymd(d)
                    const done = doneSet.has(`${h.id}:${date}`)
                    return (
                      <button
                        key={date}
                        type="button"
                        className={`habit-cell${done ? ' done' : ''}${date === today ? ' is-today' : ''}`}
                        style={done ? { background: h.color, borderColor: h.color } : { borderColor: h.color }}
                        aria-label={`${h.name} ${date}`}
                        onClick={() => void toggleDay(h, date)}
                      >
                        {done ? <Check size={12} /> : null}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-20"
          onClick={() => setOpen(false)}
        >
          <div className="bg-card w-full max-w-md rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{tr('addHabit')}</h3>
            <label className="label">{tr('habitName')}</label>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <label className="label">{tr('habitIcon')}</label>
            <div className="habit-icon-grid">
              {ICONS.map(({ id, Icon }) => {
                const c = SUBJECT_COLORS[ICONS.findIndex((x) => x.id === id)] || color
                const on = icon === id
                return (
                  <button
                    key={id}
                    type="button"
                    className={`habit-icon-pick${on ? ' on' : ''}`}
                    style={{ borderColor: on ? c : 'var(--line)', color: c }}
                    onClick={() => {
                      setIcon(id)
                      setColor(c)
                    }}
                  >
                    <Icon size={18} />
                  </button>
                )
              })}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
                {tr('cancel')}
              </button>
              <button className="btn" type="button" disabled={!name.trim() || busy} onClick={() => void saveHabit()}>
                {tr('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageLayout>
  )
}
