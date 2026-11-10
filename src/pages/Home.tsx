import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, Home, Mic, Play } from 'lucide-react'
import { useStore } from '../store'
import { Ring, useT } from '../ui'
import { PageLayout } from '../components/PageLayout'
import type { LayoutOutlet } from '../layout'
import {
  DEFAULT_HOME_ORDER,
  clearHomeLayout,
  loadHomeHiddenWidgets,
  loadHomeWidgetOrder,
  saveHomeLayout,
  type HomeWidgetId,
} from '../lib/homeLayout'
import { endOfDay, formatDate, startOfDay, weekdayLong } from '../utils'

function SortableWidget({
  id,
  editing,
  hidden,
  onToggleHidden,
  children,
}: {
  id: HomeWidgetId
  editing: boolean
  hidden: boolean
  onToggleHidden: () => void
  children: ReactNode
}) {
  const tr = useT()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editing })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: hidden && editing ? 0.55 : undefined,
    zIndex: isDragging ? 5 : undefined,
  }
  if (!editing && hidden) return null
  return (
    <div ref={setNodeRef} style={style} className={`home-widget${editing ? ' home-widget-edit' : ''}${isDragging ? ' dragging' : ''}`}>
      {editing ? (
        <div className="home-widget-tools">
          <button className="icon-btn home-drag-handle" type="button" aria-label="drag" {...attributes} {...listeners}>
            <GripVertical size={16} />
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label={hidden ? tr('showWidget') : tr('hideWidget')}
            onClick={onToggleHidden}
          >
            {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
      ) : null}
      <div className="home-widget-body">{children}</div>
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

  const [order, setOrder] = useState<HomeWidgetId[]>(() => loadHomeWidgetOrder())
  const [hidden, setHidden] = useState<HomeWidgetId[]>(() => loadHomeHiddenWidgets())
  const [draftOrder, setDraftOrder] = useState<HomeWidgetId[]>(order)
  const [draftHidden, setDraftHidden] = useState<HomeWidgetId[]>(hidden)

  useEffect(() => {
    if (isEditingHome) {
      setDraftOrder(order)
      setDraftHidden(hidden)
    }
  }, [isEditingHome, order, hidden])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const visibleOrder = isEditingHome ? draftOrder : order
  const hiddenSet = new Set(isEditingHome ? draftHidden : hidden)

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDraftOrder((ids) => {
      const oldIndex = ids.indexOf(active.id as HomeWidgetId)
      const newIndex = ids.indexOf(over.id as HomeWidgetId)
      if (oldIndex < 0 || newIndex < 0) return ids
      return arrayMove(ids, oldIndex, newIndex)
    })
  }

  function toggleHidden(id: HomeWidgetId) {
    setDraftHidden((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function save() {
    setOrder(draftOrder)
    setHidden(draftHidden)
    saveHomeLayout(draftOrder, draftHidden)
    setIsEditingHome(false)
  }

  function cancel() {
    setDraftOrder(order)
    setDraftHidden(hidden)
    setIsEditingHome(false)
  }

  function reset() {
    const nextOrder = [...DEFAULT_HOME_ORDER]
    setDraftOrder(nextOrder)
    setDraftHidden([])
    setOrder(nextOrder)
    setHidden([])
    clearHomeLayout()
    setIsEditingHome(false)
  }

  const widgets: Record<HomeWidgetId, ReactNode> = {
    progress: (
      <div className="card spread home-progress">
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
    quickRecord: (
      <button className="card pressable spread" type="button" onClick={() => !isEditingHome && nav('/record/live')} disabled={isEditingHome}>
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
    stats: (
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
    ),
  }

  const list = (
    <div className="stack home-widgets" style={{ gap: 14 }}>
      {visibleOrder.map((id) => (
        <SortableWidget
          key={id}
          id={id}
          editing={isEditingHome}
          hidden={hiddenSet.has(id)}
          onToggleHidden={() => toggleHidden(id)}
        >
          {widgets[id]}
        </SortableWidget>
      ))}
    </div>
  )

  return (
    <PageLayout icon={Home}>
      <div className="stack" style={{ gap: 14, paddingBottom: isEditingHome ? 72 : undefined }}>
        <div>
          <p className="hero-date">
            {weekdayLong(Date.now(), lang)} · {formatDate(Date.now(), lang, { day: 'numeric', month: 'long' })}
          </p>
          <h1 className="hero-hi">{hi}</h1>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
        </DndContext>
      </div>
      {isEditingHome ? (
        <div className="home-edit-bar">
          <button className="btn ghost" type="button" onClick={cancel}>
            {tr('cancel')}
          </button>
          <button className="btn secondary" type="button" onClick={reset}>
            {tr('resetDefault')}
          </button>
          <button className="btn" type="button" onClick={save}>
            {tr('save')}
          </button>
        </div>
      ) : null}
    </PageLayout>
  )
}
