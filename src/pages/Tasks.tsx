import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckSquare, Plus } from 'lucide-react'
import { useStore } from '../store'
import { Confirm, DateField, Empty, Progress, Segment, Sheet, SubjectSelect, useT } from '../ui'
import { endOfDay, startOfDay, uid } from '../utils'
import type { Priority, Recurrence, Subtask } from '../types'

type View = 'today' | 'upcoming' | 'overdue' | 'completed' | 'all'

export default function TasksPage() {
  const tr = useT()
  const { tasks } = useStore()
  const [view, setView] = useState<View>('today')
  const [open, setOpen] = useState(false)
  const todayS = startOfDay()
  const todayE = endOfDay()

  const filtered = useMemo(() => {
    switch (view) {
      case 'today':
        return tasks.filter((t) => !t.completed && (!t.dueDate || (t.dueDate >= todayS && t.dueDate <= todayE) || t.dueDate < todayS))
      case 'upcoming':
        return tasks.filter((t) => !t.completed && t.dueDate && t.dueDate > todayE)
      case 'overdue':
        return tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < todayS)
      case 'completed':
        return tasks.filter((t) => t.completed)
      default:
        return tasks
    }
  }, [tasks, view, todayS, todayE])

  const doneToday = tasks.filter((t) => t.completed && t.completedAt && t.completedAt >= todayS).length
  const openToday = tasks.filter((t) => !t.completed && (!t.dueDate || t.dueDate <= todayE)).length
  const pct = (doneToday / Math.max(1, doneToday + openToday)) * 100
  const weekStart = todayS - 6 * 86400000
  const weekDone = tasks.filter((t) => t.completed && t.completedAt && t.completedAt >= weekStart).length
  const weekAll = Math.max(1, tasks.filter((t) => (t.dueDate ?? t.createdAt) >= weekStart).length)

  return (
    <div className="stack">
      <h1 className="page-title">{tr('tasks')}</h1>
      <div className="card">
        <div className="spread">
          <b>{tr('completion')}</b>
          <span>{Math.round(pct)}%</span>
        </div>
        <Progress value={pct} />
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          {tr('weeklyProgress')}: {Math.round((weekDone / weekAll) * 100)}%
        </div>
      </div>
      <Segment
        value={view}
        onChange={(v) => setView(v as View)}
        options={[
          { id: 'today', label: tr('today') },
          { id: 'upcoming', label: tr('upcoming') },
          { id: 'overdue', label: tr('overdue') },
          { id: 'completed', label: tr('completed') },
          { id: 'all', label: tr('all') },
        ]}
      />
      {filtered.length === 0 ? (
        <Empty icon={<CheckSquare size={36} />} title={tr('noTasks')} hint={tr('noTasksHint')} />
      ) : (
        filtered.map((tk) => <TaskRow key={tk.id} id={tk.id} />)
      )}
      <button className="fab" type="button" onClick={() => setOpen(true)} aria-label={tr('newTask')}>
        <Plus size={22} />
      </button>
      <TaskSheet open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

function TaskRow({ id }: { id: string }) {
  const { tasks, toggleTask } = useStore()
  const tk = tasks.find((t) => t.id === id)
  if (!tk) return null
  const subDone = tk.subtasks.filter((s) => s.completed).length
  return (
    <div className="list-item">
      <button className={`check ${tk.completed ? 'on' : ''}`} type="button" onClick={() => void toggleTask(tk.id)} aria-label="toggle">
        {tk.completed ? '✓' : ''}
      </button>
      <Link to={`/tasks/${tk.id}`} className="grow" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className={`ellipsis ${tk.completed ? 'task-done' : ''}`}>{tk.title}</div>
        <div className="meta">
          {tk.priority === 'high' ? '● ' : ''}
          {tk.subtasks.length ? `${subDone}/${tk.subtasks.length}` : tk.category}
        </div>
      </Link>
    </div>
  )
}

export function TaskDetailPage() {
  const tr = useT()
  const nav = useNavigate()
  const { id } = useParams()
  const { tasks, updateTask, deleteTask, notes, recordings, decks } = useStore()
  const tk = tasks.find((t) => t.id === id)
  const [confirm, setConfirm] = useState(false)
  const [sub, setSub] = useState('')
  if (!tk) return <Empty icon={<CheckSquare />} title={tr('noTasks')} />

  function setSubs(next: Subtask[]) {
    void updateTask(tk!.id, { subtasks: next })
  }

  return (
    <div className="stack">
      <input className="note-title" value={tk.title} onChange={(e) => void updateTask(tk.id, { title: e.target.value })} />
      <textarea className="field textarea" value={tk.description} placeholder={tr('description')} onChange={(e) => void updateTask(tk.id, { description: e.target.value })} />
      <label className="label">{tr('priority')}</label>
      <Segment
        value={tk.priority}
        onChange={(v) => void updateTask(tk.id, { priority: v as Priority })}
        options={[
          { id: 'low', label: tr('priorityLow') },
          { id: 'medium', label: tr('priorityMed') },
          { id: 'high', label: tr('priorityHigh') },
        ]}
      />
      <label className="label">{tr('startDate')}</label>
      <DateField value={tk.startDate} onChange={(startDate) => void updateTask(tk.id, { startDate })} />
      <label className="label">{tr('dueDate')}</label>
      <DateField value={tk.dueDate} onChange={(dueDate) => void updateTask(tk.id, { dueDate })} />
      <label className="label">{tr('category')}</label>
      <input className="field" value={tk.category} onChange={(e) => void updateTask(tk.id, { category: e.target.value })} />
      <label className="label">{tr('subject')}</label>
      <SubjectSelect value={tk.subjectId} onChange={(subjectId) => void updateTask(tk.id, { subjectId })} />
      <label className="label">{tr('recurring')}</label>
      <Segment
        value={tk.recurring}
        onChange={(v) => void updateTask(tk.id, { recurring: v as Recurrence })}
        options={[
          { id: 'none', label: tr('recNone') },
          { id: 'daily', label: tr('recDaily') },
          { id: 'weekly', label: tr('recWeekly') },
        ]}
      />
      <label className="label">{tr('subtasks')}</label>
      {tk.subtasks.map((s) => (
        <div key={s.id} className="list-item">
          <button
            className={`check ${s.completed ? 'on' : ''}`}
            type="button"
            onClick={() => setSubs(tk.subtasks.map((x) => (x.id === s.id ? { ...x, completed: !x.completed } : x)))}
          >
            {s.completed ? '✓' : ''}
          </button>
          <input
            className="grow"
            style={{ border: 0, background: 'transparent', outline: 'none' }}
            value={s.title}
            onChange={(e) => setSubs(tk.subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
          />
        </div>
      ))}
      <div className="row">
        <input className="field" value={sub} onChange={(e) => setSub(e.target.value)} placeholder={tr('addSubtask')} />
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            if (!sub.trim()) return
            setSubs([...tk.subtasks, { id: uid(), title: sub.trim(), completed: false }])
            setSub('')
          }}
        >
          {tr('add')}
        </button>
      </div>
      <label className="label">{tr('linkNote')}</label>
      <select className="field" value={tk.noteId ?? ''} onChange={(e) => void updateTask(tk.id, { noteId: e.target.value || undefined })}>
        <option value="">{tr('none')}</option>
        {notes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title || tr('untitled')}
          </option>
        ))}
      </select>
      {tk.noteId ? (
        <Link className="chip" to={`/notes/${tk.noteId}`}>
          {tr('note')}
        </Link>
      ) : null}
      <label className="label">{tr('linkRecording')}</label>
      <select className="field" value={tk.recordingId ?? ''} onChange={(e) => void updateTask(tk.id, { recordingId: e.target.value || undefined })}>
        <option value="">{tr('none')}</option>
        {recordings.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      {tk.recordingId ? (
        <Link className="chip" to={`/record/${tk.recordingId}`}>
          {tr('recorder')}
        </Link>
      ) : null}
      <label className="label">{tr('linkDeck')}</label>
      <select className="field" value={tk.deckId ?? ''} onChange={(e) => void updateTask(tk.id, { deckId: e.target.value || undefined })}>
        <option value="">{tr('none')}</option>
        {decks.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {tk.deckId ? (
        <Link className="chip" to={`/cards/${tk.deckId}`}>
          {tr('flashcards')}
        </Link>
      ) : null}
      <button className="btn danger block" type="button" onClick={() => setConfirm(true)}>
        {tr('delete')}
      </button>
      <Confirm
        open={confirm}
        title={tr('deleteTaskConfirm')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteTask(tk.id)
          nav('/tasks')
        }}
      />
    </div>
  )
}

function TaskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useT()
  const nav = useNavigate()
  const { addTask } = useStore()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState<number | undefined>(Date.now())
  return (
    <Sheet open={open} onClose={onClose} title={tr('newTask')}>
      <label className="label">{tr('taskTitle')}</label>
      <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="label">{tr('priority')}</label>
      <Segment
        value={priority}
        onChange={(v) => setPriority(v as Priority)}
        options={[
          { id: 'low', label: tr('priorityLow') },
          { id: 'medium', label: tr('priorityMed') },
          { id: 'high', label: tr('priorityHigh') },
        ]}
      />
      <label className="label">{tr('dueDate')}</label>
      <DateField value={dueDate} onChange={setDueDate} />
      <button
        className="btn block"
        style={{ marginTop: 12 }}
        type="button"
        onClick={async () => {
          if (!title.trim()) return
          const item = await addTask({ title: title.trim(), priority, dueDate })
          setTitle('')
          onClose()
          nav(`/tasks/${item.id}`)
        }}
      >
        {tr('create')}
      </button>
    </Sheet>
  )
}
