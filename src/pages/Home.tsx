import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor, type Layout, type LayoutItem } from 'react-grid-layout'
import { Check, Eye, EyeOff, GripVertical, Home, Mic, Play, RotateCcw, X } from 'lucide-react'
import { useStore } from '../store'
import { Ring, useT } from '../ui'
import { PageLayout } from '../components/PageLayout'
import type { LayoutOutlet } from '../layout'
import {
  DEFAULT_HOME_LAYOUT,
  HOME_WIDGET_IDS,
  clearHomeLayout,
  cloneHomeLayout,
  layoutsForAllBreakpoints,
  loadHomeHidden,
  loadHomeLayout,
  saveHomeGrid,
  type HomeWidgetId,
} from '../lib/homeLayout'
import { RTL_LANGS } from '../types'
import { endOfDay, formatDate, startOfDay, weekdayLong } from '../utils'
import 'react-grid-layout/css/styles.css'

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 0 }
const COLS = { lg: 12, md: 12, sm: 12, xs: 12 }

function GridWidget({
  editing,
  hidden,
  onToggleHidden,
  children,
}: {
  editing: boolean
  hidden: boolean
  onToggleHidden: () => void
  children: ReactNode
}) {
  const tr = useT()
  if (!editing && hidden) return null
  return (
    <div className={`home-grid-widget${editing ? ' is-editing' : ''}${hidden ? ' is-hidden' : ''}`}>
      {editing ? (
        <>
          <button
            className="home-hide-btn"
            type="button"
            aria-label={hidden ? tr('showWidget') : tr('hideWidget')}
            onClick={onToggleHidden}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button className="home-drag-handle" type="button" aria-label="drag">
            <GripVertical size={16} />
          </button>
        </>
      ) : null}
      <div className="home-grid-widget-body">{children}</div>
    </div>
  )
}

export default function HomePage() {
  const tr = useT()
  const nav = useNavigate()
  const { isEditingHome, setIsEditingHome } = useOutletContext<LayoutOutlet>()
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

  const { width, containerRef, mounted } = useContainerWidth()
  const [layout, setLayout] = useState<LayoutItem[]>(() => loadHomeLayout())
  const [hidden, setHidden] = useState<HomeWidgetId[]>(() => loadHomeHidden())
  const [draftLayout, setDraftLayout] = useState<LayoutItem[]>(layout)
  const [draftHidden, setDraftHidden] = useState<HomeWidgetId[]>(hidden)

  useEffect(() => {
    if (!isEditingHome) return
    setDraftLayout(cloneHomeLayout(layout))
    setDraftHidden([...hidden])
  }, [isEditingHome, layout, hidden])

  const hiddenIds = isEditingHome ? draftHidden : hidden
  const hiddenSet = new Set(hiddenIds)
  const visibleLayout = useMemo(() => {
    if (isEditingHome) return draftLayout
    const filtered = layout.filter((item) => !hiddenSet.has(item.i as HomeWidgetId))
    return [...verticalCompactor.compact(filtered, 12)]
  }, [isEditingHome, draftLayout, layout, hiddenIds])
  const layouts = useMemo(() => layoutsForAllBreakpoints(visibleLayout), [visibleLayout])
  const rtl = RTL_LANGS.has(lang)

  function commitLayout(next: Layout) {
    if (!isEditingHome) return
    setDraftLayout(cloneHomeLayout(next))
  }

  function toggleHidden(id: HomeWidgetId) {
    setDraftHidden((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function save() {
    const next = cloneHomeLayout(draftLayout)
    setLayout(next)
    setHidden([...draftHidden])
    saveHomeGrid(next, draftHidden)
    setIsEditingHome(false)
  }

  function cancel() {
    setDraftLayout(cloneHomeLayout(layout))
    setDraftHidden([...hidden])
    setIsEditingHome(false)
  }

  function reset() {
    const next = cloneHomeLayout(DEFAULT_HOME_LAYOUT)
    setDraftLayout(next)
    setDraftHidden([])
    setLayout(next)
    setHidden([])
    clearHomeLayout()
    setIsEditingHome(false)
  }

  const widgets = useMemo<Record<HomeWidgetId, ReactNode>>(
    () => ({
      header: (
        <div className="home-header-widget">
          <p className="hero-date">
            {weekdayLong(Date.now(), lang)} · {formatDate(Date.now(), lang, { day: 'numeric', month: 'long' })}
          </p>
          <h1 className="hero-hi">{hi}</h1>
        </div>
      ),
      progress: (
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
      ),
      'quick-record': (
        <button
          className="card pressable spread home-fill"
          type="button"
          onClick={() => !isEditingHome && nav('/record/live')}
          disabled={isEditingHome}
        >
          <div className="row">
            <div className="mod-icon rec" style={{ width: 44, height: 44, borderRadius: 14 }}>
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
      ),
      'stat-recordings': (
        <div className="stat home-fill">
          <b>{recordings.length}</b>
          <span>{tr('recordings')}</span>
        </div>
      ),
      'stat-due': (
        <div className="stat home-fill">
          <b>{dueCards.length}</b>
          <span>{tr('due')}</span>
        </div>
      ),
      'stat-tasks': (
        <div className="stat home-fill">
          <b>{openToday.length}</b>
          <span>{tr('tasks')}</span>
        </div>
      ),
      'stat-notes': (
        <div className="stat home-fill">
          <b>{notes.length}</b>
          <span>{tr('notes')}</span>
        </div>
      ),
    }),
    [
      dueCards.length,
      doneToday.length,
      hi,
      isEditingHome,
      lang,
      nav,
      notes.length,
      openToday.length,
      progress,
      recordings.length,
      tr,
      weekDone,
      weekTotal,
    ],
  )

  const ids = isEditingHome ? HOME_WIDGET_IDS : HOME_WIDGET_IDS.filter((id) => !hiddenSet.has(id))

  return (
    <PageLayout icon={Home} className={isEditingHome ? 'home-page-editing' : undefined}>
      {isEditingHome ? (
        <div className="home-edit-topbar">
          <button className="icon-btn" type="button" aria-label={tr('cancel')} onClick={cancel}>
            <X size={18} />
          </button>
          <button className="icon-btn" type="button" aria-label={tr('resetDefault')} onClick={reset}>
            <RotateCcw size={18} />
          </button>
          <button className="icon-btn home-edit-save" type="button" aria-label={tr('save')} onClick={save}>
            <Check size={18} />
          </button>
        </div>
      ) : null}
      <div ref={containerRef} className={`home-grid-stage${isEditingHome ? ' is-editing' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
        {mounted ? (
          <ResponsiveGridLayout
            className="home-grid"
            width={width}
            layouts={layouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={50}
            margin={[10, 10]}
            containerPadding={[0, 0]}
            dragConfig={{
              enabled: isEditingHome,
              handle: '.home-drag-handle',
              cancel: '.home-hide-btn',
              threshold: 5,
              bounded: true,
              allowMobileScroll: true,
            }}
            resizeConfig={{
              enabled: isEditingHome,
              handles: rtl ? ['sw'] : ['se'],
            }}
            onDragStop={commitLayout}
            onResizeStop={commitLayout}
          >
            {ids.map((id) => (
              <div key={id}>
                <GridWidget editing={isEditingHome} hidden={hiddenSet.has(id)} onToggleHidden={() => toggleHidden(id)}>
                  {widgets[id]}
                </GridWidget>
              </div>
            ))}
          </ResponsiveGridLayout>
        ) : null}
      </div>
    </PageLayout>
  )
}
