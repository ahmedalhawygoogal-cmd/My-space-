import { useMemo, useState } from 'react'
import { Layers, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { SPACE_COLORS, useStore } from '../store'
import { Confirm, Empty, FormActions, Sheet, StandardFAB, useT } from '../ui'
import type { Space } from '../types'

type Draft = { name: string; description: string; color: string }

const emptyDraft = (): Draft => ({ name: '', description: '', color: SPACE_COLORS[0] })

export default function SpacesPage() {
  const tr = useT()
  const {
    spaces,
    activeSpaceId,
    tasks,
    notes,
    decks,
    recordings,
    habits,
    addSpace,
    updateSpace,
    deleteSpace,
    setActiveSpace,
  } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Space | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [confirm, setConfirm] = useState<Space | null>(null)

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    const bump = (id?: string | null) => {
      if (!id) return
      map[id] = (map[id] ?? 0) + 1
    }
    for (const x of tasks) bump(x.space_id)
    for (const x of notes) bump(x.space_id)
    for (const x of decks) bump(x.space_id)
    for (const x of recordings) bump(x.space_id)
    for (const x of habits) bump(x.space_id)
    return map
  }, [tasks, notes, decks, recordings, habits])

  const live = spaces.filter((s) => !s.archived_at)

  function startCreate() {
    setEditing(null)
    setDraft(emptyDraft())
    setOpen(true)
  }

  function startEdit(sp: Space) {
    setEditing(sp)
    setDraft({ name: sp.name, description: sp.description ?? '', color: sp.color })
    setOpen(true)
  }

  async function save() {
    const name = draft.name.trim()
    if (!name) return
    if (editing) {
      await updateSpace(editing.id, { name, description: draft.description.trim() || null, color: draft.color })
    } else {
      const created = await addSpace(name, { description: draft.description.trim() || null, color: draft.color })
      setActiveSpace(created.id)
    }
    setOpen(false)
  }

  return (
    <div className="stack">
      <h1 className="page-title">{tr('spaces')}</h1>
      {live.length === 0 ? (
        <Empty icon={<Layers size={36} />} title={tr('noSpaces')} hint={tr('noSpacesHint')} />
      ) : (
        live.map((sp) => {
          const active = sp.id === activeSpaceId
          const n = counts[sp.id] ?? 0
          return (
            <div key={sp.id} className={`card space-card${active ? ' is-active' : ''}`}>
              <button className="space-main pressable" type="button" onClick={() => setActiveSpace(sp.id)}>
                <span className="space-mark" style={{ background: sp.color }} aria-hidden />
                <span className="grow" style={{ minWidth: 0, textAlign: 'start' }}>
                  <span className="row" style={{ gap: 6 }}>
                    <b className="ellipsis">{sp.name}</b>
                    {sp.is_default ? <Star size={13} fill="currentColor" aria-label={tr('defaultSpace')} /> : null}
                  </span>
                  <span className="muted" style={{ fontSize: 12, display: 'block' }}>
                    {tr('itemsCount', { n })}
                    {sp.description ? ` · ${sp.description}` : ''}
                  </span>
                </span>
              </button>
              <div className="row" style={{ gap: 2 }}>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label={tr('setDefaultSpace')}
                  disabled={sp.is_default}
                  onClick={() => void updateSpace(sp.id, { is_default: true })}
                >
                  <Star size={16} />
                </button>
                <button className="icon-btn" type="button" aria-label={tr('edit')} onClick={() => startEdit(sp)}>
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label={tr('delete')}
                  disabled={live.length <= 1}
                  onClick={() => setConfirm(sp)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )
        })
      )}

      <StandardFAB accent label={tr('newSpace')} onClick={startCreate}>
        <Plus size={22} />
      </StandardFAB>

      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? tr('editSpace') : tr('newSpace')}>
        <div className="stack">
          <input
            className="field"
            value={draft.name}
            autoFocus
            placeholder={tr('spaceName')}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <input
            className="field"
            value={draft.description}
            placeholder={tr('spaceDescription')}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
          <div className="chip-row">
            {SPACE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`space-swatch${draft.color === c ? ' is-active' : ''}`}
                style={{ background: c }}
                aria-label={c}
                onClick={() => setDraft((d) => ({ ...d, color: c }))}
              />
            ))}
          </div>
          <FormActions onSave={() => void save()} saveLabel={tr('save')} saveDisabled={!draft.name.trim()} />
        </div>
      </Sheet>

      <Confirm
        open={!!confirm}
        danger
        title={tr('deleteSpace')}
        body={tr('deleteSpaceBody')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const target = confirm
          setConfirm(null)
          if (target) void deleteSpace(target.id)
        }}
      />
    </div>
  )
}
