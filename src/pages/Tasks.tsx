import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckSquare, ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { BackBtn, Confirm, DateField, Empty, Segment, Sheet, useT } from '../ui'
import { PageLayout } from '../components/PageLayout'
import { endOfDay, formatDate, startOfDay, uid } from '../utils'
import type { Priority, Task } from '../types'

type Kind = 'normal' | 'big'
type View = 'today' | 'upcoming' | 'overdue' | 'completed' | 'all'

type Draft = {
  title: string
  description: string
  category: string
  priority: Priority
  date?: number
  remind: boolean
  children: { id: string; title: string }[]
}

const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  category: '',
  priority: 'medium',
  date: Date.now(),
  remind: false,
  children: [],
})

function rootsOf(tasks: Task[]) {
  return tasks.filter((t) => !t.parentId)
}

function kidsOf(tasks: Task[], id: string) {
  const nested = tasks.filter((t) => t.parentId === id)
  if (nested.length) return nested
  const parent = tasks.find((t) => t.id === id)
  return (parent?.subtasks ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    description: '',
    completed: s.completed,
    priority: parent?.priority ?? 'medium',
    date: parent?.date,
    category: parent?.category ?? '',
    parentId: id,
    remind: false,
    recurring: 'none' as const,
    subtasks: [],
    createdAt: parent?.createdAt ?? 0,
    updatedAt: parent?.updatedAt ?? 0,
  }))
}

function taskDate(tk: Task) {
  return tk.date ?? tk.dueDate
}

export default function TasksPage() {
  const tr = useT()
  const { tasks } = useStore()
  const [view, setView] = useState<View>('today')
  const [pick, setPick] = useState(false)
  const [kind, setKind] = useState<Kind | null>(null)
  const [edit, setEdit] = useState<Task | null>(null)
  const [openDesc, setOpenDesc] = useState<Record<string, boolean>>({})
  const [openKids, setOpenKids] = useState<Record<string, boolean>>({})
  const todayS = startOfDay()
  const todayE = endOfDay()
  const roots = rootsOf(tasks)

  const filtered = useMemo(() => {
    const inView = (t: Task) => {
      const d = taskDate(t)
      switch (view) {
        case 'today':
          return !t.completed && (!d || (d >= todayS && d <= todayE) || d < todayS)
        case 'upcoming':
          return !t.completed && !!d && d > todayE
        case 'overdue':
          return !t.completed && !!d && d < todayS
        case 'completed':
          return t.completed
        default:
          return true
      }
    }
    return roots.filter(inView)
  }, [roots, view, todayS, todayE])

  return (
    <PageLayout icon={CheckSquare}>
    <div className="stack">
      <h1 className="page-title text-2xl font-bold text-foreground">{tr('tasks')}</h1>
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
        filtered.map((tk) => {
          const kids = kidsOf(tasks, tk.id)
          const big = kids.length > 0
          const doneN = kids.filter((k) => k.completed).length
          const done = tk.completed || (big && kids.length > 0 && doneN === kids.length)
          return (
            <div key={tk.id} className={`task-card${done ? ' is-done' : ''}`}>
              <div className="list-item" style={{ border: 0, padding: 0, background: 'transparent' }}>
                {big ? (
                  <>
                    <span className={`check ${done ? 'on' : ''}`} aria-hidden>
                      {done ? '✓' : ''}
                    </span>
                    <button
                      className="icon-btn"
                      type="button"
                      aria-label={tr('subtasks')}
                      onClick={() => setOpenKids((s) => ({ ...s, [tk.id]: !s[tk.id] }))}
                    >
                      {openKids[tk.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </>
                ) : (
                  <Toggle id={tk.id} done={tk.completed} />
                )}
                <div className="grow">
                  <div className="row" style={{ gap: 6 }}>
                    <div className={`ellipsis ${done ? 'task-done' : ''}`} style={{ fontWeight: 700 }}>
                      {tk.title}
                    </div>
                    <button
                      className="icon-btn"
                      type="button"
                      aria-label={tr('showDesc')}
                      onClick={() => setOpenDesc((s) => ({ ...s, [tk.id]: !s[tk.id] }))}
                    >
                      {openDesc[tk.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button className="icon-btn" type="button" aria-label={tr('edit')} onClick={() => setEdit(tk)}>
                      <Pencil size={15} />
                    </button>
                  </div>
                  <div className="meta">
                    {big ? `${doneN}/${kids.length}` : tk.category || tr('priorityMed')}
                    {taskDate(tk) ? ` · ${formatDate(taskDate(tk)!, 'ar')}` : ''}
                  </div>
                </div>
              </div>
              {openDesc[tk.id] && tk.description ? <p className="muted" style={{ margin: '8px 0 0' }}>{tk.description}</p> : null}
              {big && openKids[tk.id] ? (
                <div className="stack" style={{ marginTop: 10, gap: 8 }}>
                  {kids.map((k) => (
                    <div key={k.id} className="list-item" style={{ padding: '8px 10px' }}>
                      <Toggle id={k.id} done={k.completed} parentId={tk.id} />
                      <div className={`grow ellipsis ${k.completed ? 'task-done' : ''}`}>{k.title}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })
      )}
      <button className="fab" type="button" onClick={() => setPick(true)} aria-label={tr('newTask')}>
        <Plus size={22} />
      </button>
      <Sheet open={pick} onClose={() => setPick(false)} title={tr('newTask')}>
        <button
          className="choice"
          type="button"
          onClick={() => {
            setPick(false)
            setKind('normal')
          }}
        >
          {tr('normalTask')}
        </button>
        <button
          className="choice"
          type="button"
          style={{ marginTop: 8 }}
          onClick={() => {
            setPick(false)
            setKind('big')
          }}
        >
          {tr('bigTask')}
        </button>
      </Sheet>
      <TaskForm
        open={!!kind}
        kind={kind ?? 'normal'}
        onClose={() => setKind(null)}
      />
      {edit ? <TaskForm open task={edit} kind={kidsOf(tasks, edit.id).length ? 'big' : 'normal'} onClose={() => setEdit(null)} /> : null}
    </div>
    </PageLayout>
  )
}

function Toggle({ id, done, parentId }: { id: string; done: boolean; parentId?: string }) {
  const { toggleTask, tasks, updateTask } = useStore()
  return (
    <button
      className={`check ${done ? 'on' : ''}`}
      type="button"
      aria-label="toggle"
      onClick={() => {
        const exists = tasks.some((t) => t.id === id)
        if (exists) {
          void toggleTask(id)
          return
        }
        if (!parentId) return
        const parent = tasks.find((t) => t.id === parentId)
        if (!parent) return
        void updateTask(parentId, {
          subtasks: parent.subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)),
        })
      }}
    >
      {done ? '✓' : ''}
    </button>
  )
}

export function TaskDetailPage() {
  const { id } = useParams()
  const { tasks } = useStore()
  const tk = tasks.find((t) => t.id === id)
  const [open, setOpen] = useState(true)
  const nav = useNavigate()
  if (!tk) return (
    <PageLayout icon={CheckSquare}>
      <div className="inner-head">
        <BackBtn onClick={() => nav('/tasks')} />
      </div>
      <Empty icon={<CheckSquare />} title="" />
    </PageLayout>
  )
  return (
    <PageLayout icon={CheckSquare}>
    <div className="inner-head">
      <BackBtn onClick={() => nav('/tasks')} />
    </div>
    <TaskForm
      open={open}
      task={tk}
      kind={kidsOf(tasks, tk.id).length ? 'big' : 'normal'}
      onClose={() => {
        setOpen(false)
        nav('/tasks')
      }}
    />
    </PageLayout>
  )
}

function TaskForm({
  open,
  onClose,
  kind,
  task,
}: {
  open: boolean
  onClose: () => void
  kind: Kind
  task?: Task
}) {
  const tr = useT()
  const { addTask, updateTask, deleteTask, tasks } = useStore()
  const kids = task ? kidsOf(tasks, task.id) : []
  const [draft, setDraft] = useState<Draft>(() =>
    task
      ? {
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          date: taskDate(task),
          remind: task.remind,
          children: kids.map((k) => ({ id: k.id, title: k.title })),
        }
      : emptyDraft(),
  )
  const [confirm, setConfirm] = useState(false)
  const [child, setChild] = useState('')

  useEffect(() => {
    if (!open) return
    setChild('')
    setConfirm(false)
    setDraft(
      task
        ? {
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
            date: taskDate(task),
            remind: task.remind,
            children: kidsOf(tasks, task.id).map((k) => ({ id: k.id, title: k.title })),
          }
        : emptyDraft(),
    )
  }, [open, task, tasks])

  return (
    <Sheet open={open} onClose={onClose} title={task ? tr('editTask') : kind === 'big' ? tr('bigTask') : tr('normalTask')}>
      <label className="label">{tr('taskTitle')}</label>
      <input className="field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      <label className="label">
        {tr('description')} · {tr('optional')}
      </label>
      <textarea className="field textarea" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      <label className="label">{tr('category')}</label>
      <input className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
      <label className="label">{tr('priority')}</label>
      <Segment
        value={draft.priority}
        onChange={(v) => setDraft({ ...draft, priority: v as Priority })}
        options={[
          { id: 'low', label: tr('priorityLow') },
          { id: 'medium', label: tr('priorityMed') },
          { id: 'high', label: tr('priorityHigh') },
        ]}
      />
      <label className="label">{tr('date')}</label>
      <DateField value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
      <label className="label">{tr('taskRemind')}</label>
      <Segment
        value={draft.remind ? 'on' : 'off'}
        onChange={(v) => setDraft({ ...draft, remind: v === 'on' })}
        options={[
          { id: 'on', label: tr('on') },
          { id: 'off', label: tr('off') },
        ]}
      />
      {(kind === 'big' || draft.children.length > 0 || !!task) && (
        <>
          <label className="label">{tr('subtasks')}</label>
          {draft.children.map((c) => (
            <div key={c.id} className="row">
              <input
                className="field"
                value={c.title}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    children: draft.children.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x)),
                  })
                }
              />
              <button
                className="icon-btn"
                type="button"
                aria-label={tr('delete')}
                onClick={() => setDraft({ ...draft, children: draft.children.filter((x) => x.id !== c.id) })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div className="row">
            <input className="field" value={child} onChange={(e) => setChild(e.target.value)} placeholder={tr('addSubtask')} />
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                if (!child.trim()) return
                setDraft({ ...draft, children: [...draft.children, { id: uid(), title: child.trim() }] })
                setChild('')
              }}
            >
              {tr('add')}
            </button>
          </div>
        </>
      )}
      <button
        className="btn block"
        style={{ marginTop: 12 }}
        type="button"
        onClick={async () => {
          if (!draft.title.trim()) return
          const payload = {
            title: draft.title.trim(),
            description: draft.description.trim(),
            category: draft.category.trim(),
            priority: draft.priority,
            date: draft.date,
            dueDate: draft.date,
            remind: draft.remind,
            subtasks: draft.children.map((c) => ({
              id: c.id,
              title: c.title,
              completed: kids.find((k) => k.id === c.id)?.completed ?? false,
            })),
          }
          if (task) await updateTask(task.id, payload)
          else await addTask(payload)
          onClose()
        }}
      >
        {tr('save')}
      </button>
      {task ? (
        <button className="btn danger block" type="button" onClick={() => setConfirm(true)}>
          {tr('deleteTask')}
        </button>
      ) : null}
      <Confirm
        open={confirm}
        title={tr('deleteTaskConfirm')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          if (task) await deleteTask(task.id)
          setConfirm(false)
          onClose()
        }}
      />
    </Sheet>
  )
}
