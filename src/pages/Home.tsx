import { useNavigate } from 'react-router-dom'
import { Home, Mic, Play, Plus } from 'lucide-react'
import { useStore } from '../store'
import { Ring, useT } from '../ui'
import { PageLayout } from '../components/PageLayout'
import { RTL_LANGS } from '../types'
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

  const rtl = RTL_LANGS.has(lang)

  return (
    <PageLayout icon={Home} className="home-page">
      <div className="home-static" dir={rtl ? 'rtl' : 'ltr'}>
        <div className="home-header-widget">
          <p className="hero-date">
            {weekdayLong(Date.now(), lang)} · {formatDate(Date.now(), lang, { day: 'numeric', month: 'long' })}
          </p>
          <h1 className="hero-hi">{hi}</h1>
        </div>

        <div className="card spread home-progress home-fill">
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

        <button
          className="card pressable spread home-fill"
          type="button"
          onClick={() => nav('/record/live')}
        >
          <div className="row">
            <div className="mod-icon rec" style={{ width: 44, height: 44, borderRadius: 14 }}>
              <Mic size={20} />
            </div>
            <div>
              <b>{tr('quickRecord')}</b>
              <div className="muted" style={{ fontSize: 12 }}>{tr('record')}</div>
            </div>
          </div>
          <Play size={18} />
        </button>

        <div className="grid grid-cols-4 gap-2 w-full my-4">
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
      <button className="fab" type="button" onClick={() => nav('/record/live')} aria-label={tr('quickRecord')}>
        <Plus size={22} />
      </button>
    </PageLayout>
  )
}
