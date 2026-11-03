import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, CheckSquare, Layers, Mic, Play } from 'lucide-react'
import { useStore } from '../store'
import { Ring, useT } from '../ui'
import { endOfDay, formatDate, startOfDay, weekdayLong } from '../utils'

export default function HomePage() {
  const tr = useT()
  const nav = useNavigate()
  const { settings, lang, recordings, notes, cards, tasks } = useStore()
  const hour = new Date().getHours()
  const greet = hour < 12 ? tr('goodMorning') : hour < 18 ? tr('goodAfternoon') : tr('goodEvening')
  const hi = settings.userName ? tr('welcomeNamed', { name: settings.userName }) : greet

  const todayStart = startOfDay()
  const todayEnd = endOfDay()
  const todayTasks = tasks.filter((tk) => {
    if (tk.completed) return tk.completedAt && tk.completedAt >= todayStart
    if (!tk.dueDate) return true
    return tk.dueDate <= todayEnd
  })
  const openToday = todayTasks.filter((t) => !t.completed)
  const doneToday = tasks.filter((t) => t.completed && t.completedAt && t.completedAt >= todayStart)
  const progress = todayTasks.length ? (doneToday.length / Math.max(1, doneToday.length + openToday.length)) * 100 : 0
  const dueCards = cards.filter((c) => c.dueAt <= Date.now())
  const weekStart = todayStart - 6 * 86400000
  const weekDone = tasks.filter((t) => t.completed && t.completedAt && t.completedAt >= weekStart).length
  const weekTotal = Math.max(1, tasks.filter((t) => (t.dueDate ?? t.createdAt) >= weekStart).length)

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div>
        <p className="hero-date">
          {weekdayLong(Date.now(), lang)} · {formatDate(Date.now(), lang, { day: 'numeric', month: 'long' })}
        </p>
        <h1 className="hero-hi">{hi}</h1>
      </div>

      <div className="card spread">
        <div className="grow">
          <div className="muted" style={{ fontSize: 13 }}>
            {tr('progressToday')}
          </div>
          <div style={{ fontWeight: 700, margin: '4px 0 8px' }}>
            {doneToday.length} / {doneToday.length + openToday.length}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {tr('weeklyProgress')}: {Math.round((weekDone / weekTotal) * 100)}%
          </div>
        </div>
        <Ring value={progress} />
      </div>

      <button className="card pressable spread" type="button" onClick={() => nav('/record/live')}>
        <div className="row">
          <div className="brand-mark" style={{ background: 'var(--accent)', width: 44, height: 44, borderRadius: 14 }}>
            <Mic size={20} />
          </div>
          <div>
            <b>{tr('quickRecord')}</b>
            <div className="muted" style={{ fontSize: 12 }}>
              {tr('record')}
            </div>
          </div>
        </div>
        <Play size={18} />
      </button>

      <div className="grid-2">
        <Mod to="/record" icon={<Mic size={18} />} label={tr('recorder')} color="var(--accent)" />
        <Mod to="/cards" icon={<Layers size={18} />} label={tr('flashcards')} color="var(--brand)" />
        <Mod to="/tasks" icon={<CheckSquare size={18} />} label={tr('tasks')} color="var(--gold)" />
        <Mod to="/notes" icon={<BookOpen size={18} />} label={tr('notebook')} color="#4C6FE8" />
      </div>

      <div className="stat-grid">
        <div className="stat">
          <b>{recordings.length}</b>
          <span>{tr('recordings')}</span>
        </div>
        <div className="stat">
          <b>{dueCards.length}</b>
          <span>{tr('due')}</span>
        </div>
        <div className="stat">
          <b>{openToday.length}</b>
          <span>{tr('tasks')}</span>
        </div>
        <div className="stat">
          <b>{notes.length}</b>
          <span>{tr('notes')}</span>
        </div>
      </div>
    </div>
  )
}

function Mod({ to, icon, label, color }: { to: string; icon: ReactNode; label: string; color: string }) {
  return (
    <Link className="card pressable" to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="row">
        <div style={{ width: 36, height: 36, borderRadius: 12, background: color, color: '#fff', display: 'grid', placeItems: 'center' }}>
          {icon}
        </div>
        <b>{label}</b>
      </div>
    </Link>
  )
}
