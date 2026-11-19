import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Settings2 } from 'lucide-react'
import { useStore } from '../store'
import { Sheet, useT } from '../ui'

function SpaceRow({
  name,
  color,
  active,
  onClick,
}: {
  name: string
  color: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button className={`list-item pressable${active ? ' is-active' : ''}`} type="button" onClick={onClick}>
      <span className="dot" style={{ background: color, width: 14, height: 14 }} aria-hidden />
      <span className="grow ellipsis" style={{ fontWeight: 700, textAlign: 'start' }}>
        {name}
      </span>
      {active ? <Check size={18} /> : null}
    </button>
  )
}

/** Header pill that switches the active space lens. */
export function SpaceSwitcher() {
  const tr = useT()
  const nav = useNavigate()
  const { spaces, activeSpaceId, setActiveSpace } = useStore()
  const [open, setOpen] = useState(false)
  const live = spaces.filter((s) => !s.archived_at)
  const current = live.find((s) => s.id === activeSpaceId) ?? null

  return (
    <>
      <button className="space-switcher" type="button" onClick={() => setOpen(true)} aria-label={tr('switchSpace')}>
        <span className="dot" style={{ background: current?.color ?? 'var(--brand)' }} aria-hidden />
        <span className="ellipsis">{current?.name ?? tr('allSpaces')}</span>
        <ChevronDown size={14} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr('spaces')}>
        <div className="stack">
          <SpaceRow
            name={tr('allSpaces')}
            color="var(--brand)"
            active={!activeSpaceId}
            onClick={() => {
              setActiveSpace(null)
              setOpen(false)
            }}
          />
          {live.map((sp) => (
            <SpaceRow
              key={sp.id}
              name={sp.name}
              color={sp.color}
              active={sp.id === activeSpaceId}
              onClick={() => {
                setActiveSpace(sp.id)
                setOpen(false)
              }}
            />
          ))}
          <button
            className="btn ghost block"
            type="button"
            onClick={() => {
              setOpen(false)
              nav('/spaces')
            }}
          >
            <Settings2 size={16} />
            {tr('manageSpaces')}
          </button>
        </div>
      </Sheet>
    </>
  )
}
