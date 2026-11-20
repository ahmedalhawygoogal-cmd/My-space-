import { useState } from 'react'
import { Pencil, Play, Plus, Trash2, Workflow as WorkflowIcon, X } from 'lucide-react'
import { useStore } from '../store'
import { Confirm, Empty, Sheet, StandardFAB, Toast, useT } from '../ui'
import type { Workflow, WorkflowStep } from '../types'

type DraftStep = { kind: 'create_task' | 'create_note'; title: string }

const blankStep = (): DraftStep => ({ kind: 'create_task', title: '' })

export default function WorkflowsPage() {
  const tr = useT()
  const { workflows, addWorkflow, updateWorkflow, deleteWorkflow, runWorkflow } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [name, setName] = useState('')
  const [steps, setSteps] = useState<DraftStep[]>([blankStep()])
  const [confirm, setConfirm] = useState<Workflow | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function startCreate() {
    setEditing(null)
    setName('')
    setSteps([blankStep()])
    setOpen(true)
  }

  function startEdit(wf: Workflow) {
    setEditing(wf)
    setName(wf.name)
    setSteps(
      wf.steps.length
        ? wf.steps.map((s) => ({
            kind: s.kind === 'create_note' ? 'create_note' : 'create_task',
            title: typeof s.params?.title === 'string' ? s.params.title : '',
          }))
        : [blankStep()],
    )
    setOpen(true)
  }

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    const list: WorkflowStep[] = steps
      .filter((s) => s.title.trim())
      .map((s) => ({ kind: s.kind, params: { title: s.title.trim() } }))
    if (editing) await updateWorkflow(editing.id, { name: trimmed, steps: list })
    else await addWorkflow(trimmed, list)
    setOpen(false)
  }

  async function run(wf: Workflow) {
    if (running) return
    setRunning(wf.id)
    try {
      const result = await runWorkflow(wf.id)
      setToast(result.status === 'ok' ? tr('runOk') : tr('runFailed'))
    } catch {
      setToast(tr('runFailed'))
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="stack">
      <h1 className="page-title">{tr('workflows')}</h1>

      {workflows.length === 0 ? (
        <Empty
          icon={<WorkflowIcon size={36} />}
          title={tr('noWorkflows')}
          hint={tr('noWorkflowsHint')}
        />
      ) : (
        workflows.map((wf) => (
          <div key={wf.id} className="card inbox-item">
            <div className="grow" style={{ minWidth: 0, textAlign: 'start' }}>
              <b style={{ display: 'block', overflowWrap: 'anywhere' }}>{wf.name}</b>
              <span className="muted" style={{ fontSize: 12 }}>
                {tr('stepsCount', { n: wf.steps.length })}
                {wf.run_count ? ` · ${tr('runCount', { n: wf.run_count })}` : ''}
              </span>
            </div>
            <div className="row" style={{ gap: 2 }}>
              <button
                className="btn"
                type="button"
                disabled={running === wf.id}
                onClick={() => void run(wf)}
              >
                <Play size={16} />
                {tr('run')}
              </button>
              <button className="icon-btn" type="button" aria-label={tr('edit')} onClick={() => startEdit(wf)}>
                <Pencil size={16} />
              </button>
              <button
                className="icon-btn"
                type="button"
                aria-label={tr('delete')}
                onClick={() => setConfirm(wf)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      )}

      <StandardFAB accent label={tr('newWorkflow')} onClick={startCreate}>
        <Plus size={22} />
      </StandardFAB>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? tr('editWorkflow') : tr('newWorkflow')}
      >
        <div className="stack">
          <input
            className="field"
            value={name}
            autoFocus
            placeholder={tr('workflowName')}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            {tr('workflowSteps')}
          </span>
          {steps.map((step, index) => (
            <div key={index} className="row" style={{ gap: 6 }}>
              <select
                className="field"
                value={step.kind}
                onChange={(e) =>
                  setSteps((list) =>
                    list.map((s, i) =>
                      i === index ? { ...s, kind: e.target.value as DraftStep['kind'] } : s,
                    ),
                  )
                }
              >
                <option value="create_task">{tr('createTaskStep')}</option>
                <option value="create_note">{tr('createNoteStep')}</option>
              </select>
              <input
                className="field grow"
                value={step.title}
                placeholder={tr('stepTitle')}
                onChange={(e) =>
                  setSteps((list) => list.map((s, i) => (i === index ? { ...s, title: e.target.value } : s)))
                }
              />
              <button
                className="icon-btn"
                type="button"
                aria-label={tr('delete')}
                disabled={steps.length <= 1}
                onClick={() => setSteps((list) => list.filter((_, i) => i !== index))}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button className="btn ghost" type="button" onClick={() => setSteps((list) => [...list, blankStep()])}>
            <Plus size={16} />
            {tr('addStep')}
          </button>
          <button className="btn" type="button" disabled={!name.trim()} onClick={() => void save()}>
            {tr('save')}
          </button>
        </div>
      </Sheet>

      <Confirm
        open={!!confirm}
        danger
        title={tr('deleteWorkflow')}
        body={tr('deleteWorkflowBody')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const target = confirm
          setConfirm(null)
          if (target) void deleteWorkflow(target.id)
        }}
      />

      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  )
}
