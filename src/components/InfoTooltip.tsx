import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'

export function InfoTooltip({ text }: { text: string }) {
  const id = useId()
  const wrap = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span
      className="info-tip"
      ref={wrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-tip-btn"
        aria-label="info"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <Info size={16} />
      </button>
      {open ? (
        <span className="info-tip-overlay modal-backdrop" onClick={() => setOpen(false)}>
          <span className="info-tip-pop modal-panel" id={id} role="tooltip" onClick={(e) => e.stopPropagation()}>
            {text}
          </span>
        </span>
      ) : null}
    </span>
  )
}
