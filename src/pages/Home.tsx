import { useNavigate } from 'react-router-dom'
import { BookOpen, CheckSquare, Layers, Mic, Play, type LucideIcon } from 'lucide-react'
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
  const mains = tasks.filter((tk) => !tk.parentId)
  const taskDay = (tk: (typeof tasks)[number]) => tk.date ?? tk.dueDate
  const todayTasks = mains.filter((tk) => {
    if (tk.completed) return tk.completedAt && tk.completedAt >= todayStart
    const d = taskDay(tk)
    if (!d) return true
    return d <= todayEnd
  })
  const openToday = todayTasks.filter((t) => !t.completed)
  const doneToday = mains.filter((t) => t.completed && t.completedAt && t.completedAt >= todayStart)
  const progress = todayTasks.length ? (doneToday.length / Math.max(1, doneToday.length + openToday.length)) * 100 : 0
  const dueCards = cards.filter((c) => (c.nextReviewDate || c.dueAt) <= Date.now())
  const weekStart = todayStart - 6 * 86400000
  const weekDone = mains.filter((t) => t.completed && t.completedAt && t.completedAt >= weekStart).length
  const weekTotal = Math.max(1, mains.filter((t) => (taskDay(t) ?? t.createdAt) >= weekStart).length)
  const weekPct = Math.min(100, Math.round((weekDone / weekTotal) * 100))

  return (
    <div className="stack home-screen">
      <div className="home-head">
        <p className="hero-date">
          {weekdayLong(Date.now(), lang)} · {formatDate(Date.now(), lang, { day: 'numeric', month: 'long' })}
        </p>
        <h1 className="hero-hi">{hi}</h1>
      </div>

      <section className="home-achievement">
        <div className="home-orb">
          <img className="home-orb-img" src="/images/saturn.svg" alt="" />
          <span className="home-orb-ring" aria-hidden="true">
            <Ring value={progress} size={76} />
          </span>
        </div>
        <div className="home-achievement-body">
          <span className="home-eyebrow">{tr('progressToday')}</span>
          <b className="home-achievement-count">
            {doneToday.length} / {doneToday.length + openToday.length}
          </b>
          <p className="home-week muted">
            {tr('weeklyProgress')}: {weekPct}%
          </p>
        </div>
      </section>

      <button className="glass-panel home-capture" type="button" onClick={() => nav('/record')}>
        <span className="home-capture-icon" aria-hidden="true">
          <Mic size={18} />
        </span>
        <b>{tr('quickRecord')}</b>
        <span className="home-capture-icon" aria-hidden="true">
          <Play size={18} />
        </span>
      </button>

      <div className="bento-grid">
        <BentoCard
          icon={Layers}
          value={dueCards.length}
          label={tr('due')}
          onClick={() => nav('/cards')}
        />
        <BentoCard
          icon={Mic}
          value={recordings.length}
          label={tr('recordings')}
          onClick={() => nav('/record')}
        />
        <BentoCard
          icon={CheckSquare}
          value={openToday.length}
          label={tr('tasks')}
          onClick={() => nav('/tasks')}
        />
        <BentoCard icon={BookOpen} value={notes.length} label={tr('notes')} onClick={() => nav('/notes')} />
      </div>
    </div>
  )
}

function BentoCard({
  icon: Icon,
  value,
  label,
  onClick,
}: {
  icon: LucideIcon
  value: number
  label: string
  onClick: () => void
}) {
  return (
    <button className="glass-panel bento-card" type="button" onClick={onClick}>
      <span className="bento-card-top">
        <b>{value}</b>
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="bento-label">{label}</span>
    </button>
  )
}
