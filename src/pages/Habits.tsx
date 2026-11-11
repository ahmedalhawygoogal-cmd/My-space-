import { useCallback, useEffect, useMemo, useState } from 'react'
import { Book, Brain, Check, Droplet, Dumbbell, Heart, Moon, Plus, Repeat } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import * as db from '../db'
import { STORES } from '../db'
import { Sheet, useT, Empty } from '../ui'
import { PageLayout } from '../components/PageLayout'
import { now } from '../utils'
import type { Habit, HabitIconId, HabitLog, HabitMood } from '../types'
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
const MOODS: { id: HabitMood; face: string; key: 'moodGood' | 'moodOk' | 'moodBad' }[] = [
  { id: 'good', face: '\u{1F60A}', key: 'moodGood' },
  { id: 'ok', face: '\u{1F610}', key: 'moodOk' },
  { id: 'bad', face: '\u{1F61E}', key: 'moodBad' },
]

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
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

function shiftDay(date: string, days: number): string {
  const d = parseYmd(date)
  d.setDate(d.getDate() + days)
  return ymd(d)
}

function currentStreak(dates: Set<string>, today: string): number {
  let cursor = dates.has(today) ? today : shiftDay(today, -1)
  if (!dates.has(cursor)) return 0
  let n = 0
  while (dates.has(cursor)) {
    n += 1
    cursor = shiftDay(cursor, -1)
  }
  return n
}

function monthCells(nowDate: Date): { date: string | null; inMonth: boolean }[] {
  const y = nowDate.getFullYear()
  const m = nowDate.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  const cells: { date: string | null; inMonth: boolean }[] = []
  for (let i = 0; i < first.getDay(); i++) cells.push({ date: null, inMonth: false })
  for (let day = 1; day <= last.getDate(); day++) {
    cells.push({ date: ymd(new Date(y, m, day)), inMonth: true })
  }
  while (cells.length % 7) cells.push({ date: null, inMonth: false })
  return cells
}

function topMood(logs: HabitLog[]): HabitMood | null {
  const counts: Record<HabitMood, number> = { good: 0, ok: 0, bad: 0 }
  for (const l of logs) {
    if (l.mood) counts[l.mood] += 1
  }
  let best: HabitMood | null = null
  let n = 0
  for (const m of MOODS) {
    if (counts[m.id] > n) {
      n = counts[m.id]
      best = m.id
    }
  }
  return best
}

export default function HabitsPage() {
  const tr = useT()
  const days = useMemo(() => weekDays(), [])
  const today = ymd(new Date())
  const monthGrid = useMemo(() => monthCells(new Date()), [])
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [why, setWhy] = useState('')
  const [icon, setIcon] = useState<HabitIconId>('heart')
  const [busy, setBusy] = useState(false)
  const [moodPick, setMoodPick] = useState<{ habit: Habit; date: string } | null>(null)
  const [detail, setDetail] = useState<Habit | null>(null)

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

  const logsByHabit = useMemo(() => {
    const map = new Map<string, HabitLog[]>()
    for (const log of logs) {
      const arr = map.get(log.habitId) ?? []
      arr.push(log)
      map.set(log.habitId, arr)
    }
    return map
  }, [logs])

  const doneSet = useMemo(() => {
    const s = new Set<string>()
    for (const log of logs) s.add(`${log.habitId}:${log.date}`)
    return s
  }, [logs])

  function resetAdd() {
    setOpen(false)
    setName('')
    setWhy('')
    setIcon('heart')
  }

  async function saveHabit() {
    const title = name.trim()
    const reason = why.trim()
    if (!title || !reason || busy) return
    setBusy(true)
    const item: Habit = {
      id: crypto.randomUUID(),
      name: title,
      icon,
      why: reason,
      color: '#0f6e6b',
      target: 'daily',
      createdAt: now(),
      updatedAt: now(),
    }
    await db.putOne(STORES.habits, item)
    setHabits((prev) => [...prev, item])
    resetAdd()
    setBusy(false)
    void upsertRemoteHabit(item)
  }

  async function completeDay(habit: Habit, date: string, mood: HabitMood) {
    const existing = logs.find((l) => l.habitId === habit.id && l.date === date)
    if (existing) {
      const next = { ...existing, mood }
      await db.putOne(STORES.habitLogs, next)
      setLogs((prev) => prev.map((l) => (l.id === existing.id ? next : l)))
      void upsertRemoteHabitLog(next)
      setMoodPick(null)
      return
    }
    const log: HabitLog = {
      id: crypto.randomUUID(),
      habitId: habit.id,
      date,
      mood,
      createdAt: now(),
    }
    await db.putOne(STORES.habitLogs, log)
    setLogs((prev) => [...prev, log])
    void upsertRemoteHabitLog(log)
    setMoodPick(null)
  }

  async function uncompleteDay(habit: Habit, date: string) {
    const existing = logs.find((l) => l.habitId === habit.id && l.date === date)
    if (!existing) return
    await db.deleteById(STORES.habitLogs, existing.id)
    setLogs((prev) => prev.filter((l) => l.id !== existing.id))
    void removeRemoteHabitLog(existing.id)
  }

  function onCellClick(habit: Habit, date: string, future: boolean, done: boolean) {
    if (future) return
    if (done) {
      void uncompleteDay(habit, date)
      return
    }
    setMoodPick({ habit, date })
  }

  const detailLogs = detail ? logsByHabit.get(detail.id) ?? [] : []
  const detailDates = new Set(detailLogs.map((l) => l.date))
  const detailMood = topMood(detailLogs)
  const moodCounts: Record<HabitMood, number> = { good: 0, ok: 0, bad: 0 }
  for (const l of detailLogs) {
    if (l.mood) moodCounts[l.mood] += 1
  }

  return (
    <PageLayout icon={Repeat}>
      <div className="stack" style={{ gap: 14 }}>
        <h1 className="page-title text-2xl font-bold text-foreground">{tr('habits')}</h1>

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
              const dates = new Set((logsByHabit.get(h.id) ?? []).map((l) => l.date))
              const streak = currentStreak(dates, today)
              return (
                <div key={h.id} className="habit-row">
                  <button type="button" className="habit-name-col" onClick={() => setDetail(h)}>
                    <span className="habit-dot">
                      <Icon size={12} />
                    </span>
                    <span className="habit-title">{h.name}</span>
                    {streak > 0 ? <span className="habit-streak">{'\u{1F525}'} {streak}</span> : null}
                  </button>
                  {days.map((d) => {
                    const date = ymd(d)
                    const done = doneSet.has(`${h.id}:${date}`)
                    const future = date > today
                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={future}
                        className={`habit-cell${done ? ' done' : ''}${date === today ? ' is-today' : ''}${future ? ' pointer-events-none opacity-50' : ''}`}
                        aria-label={`${h.name} ${date}`}
                        onClick={() => onCellClick(h, date, future, done)}
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

      <button
        className="fab"
        type="button"
        aria-label={tr('addHabit')}
        onClick={() => setOpen(true)}
      >
        <Plus size={22} />
      </button>

      <Sheet open={open} onClose={resetAdd} title={tr('addHabit')}>
            <label className="label">{tr('habitName')}</label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <label className="label">{tr('habitWhy')}</label>
            <input className="field" value={why} onChange={(e) => setWhy(e.target.value)} />
            <label className="label">{tr('habitIcon')}</label>
            <div className="habit-icon-grid">
              {ICONS.map(({ id, Icon }) => {
                const on = icon === id
                return (
                  <button
                    key={id}
                    type="button"
                    className={`habit-icon-pick${on ? ' on' : ''}`}
                    onClick={() => setIcon(id)}
                  >
                    <Icon size={18} />
                  </button>
                )
              })}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" type="button" disabled={!name.trim() || !why.trim() || busy} onClick={() => void saveHabit()}>
                {tr('save')}
              </button>
            </div>
      </Sheet>

      <Sheet open={!!moodPick} onClose={() => setMoodPick(null)} title={tr('habitMood')}>
            <div className="habit-mood-row">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="habit-mood-btn"
                  onClick={() => moodPick && void completeDay(moodPick.habit, moodPick.date, m.id)}
                >
                  <span className="habit-mood-face">{m.face}</span>
                  <span>{tr(m.key)}</span>
                </button>
              ))}
            </div>
      </Sheet>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.name}>
            {detail ? (
              <>
            <p className="habit-why">{detail.why}</p>
            <div className="label">{tr('habitHeatmap')}</div>
            <div className="habit-heat">
              {monthGrid.map((c, i) => {
                if (!c.date) return <span key={`e-${i}`} className="habit-heat-cell empty" />
                const done = detailDates.has(c.date)
                const missed = c.date < today && !done
                return (
                  <span
                    key={c.date}
                    className={`habit-heat-cell${done ? ' bg-primary' : missed ? ' bg-muted' : ''}`}
                    title={c.date}
                  />
                )
              })}
            </div>
            <div className="label">{tr('habitMoodHistory')}</div>
            <div className="habit-mood-hist">
              {MOODS.map((m) => (
                <div key={m.id} className="habit-mood-hist-row">
                  <span>{m.face} {tr(m.key)}</span>
                  <b>{moodCounts[m.id]}</b>
                </div>
              ))}
              {detailMood ? (
                <div className="muted" style={{ marginTop: 8 }}>
                  {tr('mostFrequentMood')}: {MOODS.find((m) => m.id === detailMood)?.face} {tr(MOODS.find((m) => m.id === detailMood)!.key)}
                </div>
              ) : null}
            </div>
              </>
            ) : null}
      </Sheet>
    </PageLayout>
  )
}
