import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, Flame, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Confirm, Empty, useT } from '../ui'
import type { Habit, HabitLog } from '../types'
import { currentStreak, habitIcon, isDayComplete, isoDate } from '../lib/habits'
import { fetchHabitLogs, fetchHabits, removeHabit } from '../lib/habitSync'
import { HabitForm } from './Habits'

function monthCells(ts = Date.now()) {
  const d = new Date(ts)
  const year = d.getFullYear()
  const month = d.getMonth()
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array.from({ length: startPad }, () => null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day, 12).getTime())
  while (cells.length % 7 !== 0) cells.push(null)
  return { year, month, cells }
}

export default function HabitDetailsPage() {
  const { id } = useParams()
  const tr = useT()
  const nav = useNavigate()
  const { lang } = useStore()
  const [habit, setHabit] = useState<Habit | null>(null)
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [edit, setEdit] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const [all, rows] = await Promise.all([fetchHabits(), fetchHabitLogs(id)])
    const found = all.find((h) => h.id === id) ?? null
    setHabit(found)
    setLogs(rows)
    setMissing(!found)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const { year, month, cells } = useMemo(() => monthCells(), [])
  const byDate = useMemo(() => {
    const map = new Map<string, HabitLog>()
    for (const log of logs) map.set(log.date, log)
    return map
  }, [logs])

  if (missing) return <Empty icon={<Activity size={36} />} title={tr('noHabits')} />
  if (!habit) return null

  const Icon = habitIcon(habit.icon)
  const streak = currentStreak(habit, logs)
  const monthLabel = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))
  const dows = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(lang, { weekday: 'narrow' }).format(new Date(2024, 5, i + 2)),
  )

  return (
    <div className="stack">
      <div className="row" style={{ gap: 10, marginBottom: 4 }}>
        <span className="habit-ico lg">
          <Icon size={22} />
        </span>
        <h1 className="page-title" style={{ margin: 0 }}>
          {habit.name}
        </h1>
      </div>
      {habit.why ? (
        <div className="card">
          <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            {tr('habitWhy')}
          </div>
          {habit.why}
        </div>
      ) : null}
      <div className="card spread">
        <div>
          <div className="muted" style={{ fontSize: 13 }}>
            {tr('streak')}
          </div>
          <b style={{ fontSize: 22, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Flame size={20} />
            {streak}
          </b>
          <span className="muted" style={{ marginInlineStart: 6 }}>
            {tr('days')}
          </span>
        </div>
      </div>
      <div className="card">
        <div className="muted" style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          {monthLabel}
        </div>
        <div className="habit-heat-grid">
          {dows.map((d, i) => (
            <div key={i} className="habit-heat-dow">
              {d}
            </div>
          ))}
          {cells.map((ts, i) => {
            if (ts == null) return <div key={`e-${i}`} />
            const log = byDate.get(isoDate(ts))
            const on = isDayComplete(habit, log)
            return (
              <div key={ts} className={`habit-heat-cell${on ? ' on' : ''}`}>
                {new Date(ts).getDate()}
              </div>
            )
          })}
        </div>
      </div>
      <button className="btn secondary block" type="button" onClick={() => setEdit(true)}>
        <Pencil size={16} />
        {tr('edit')}
      </button>
      <button
        className="action-btn action-btn-delete flex-1 h-12 rounded-xl font-bold text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors duration-200 w-full"
        type="button"
        onClick={() => setConfirm(true)}
      >
        <Trash2 size={18} />
        {tr('delete')}
      </button>
      <Confirm
        open={confirm}
        title={tr('deleteHabitConfirm')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await removeHabit(habit.id)
          nav('/habits')
        }}
      />
      <HabitForm
        open={edit}
        habit={habit}
        onClose={() => setEdit(false)}
        onSaved={async () => {
          setEdit(false)
          await load()
        }}
        onDeleted={() => nav('/habits')}
      />
    </div>
  )
}
