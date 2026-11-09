import { useEffect, useRef, type ReactNode } from 'react'
import { t, type I18nKey } from './i18n'
import { useStore } from './store'

export function useT() {
  const { lang } = useStore()
  return (key: I18nKey, vars?: Record<string, string | number>) => t(lang, key, vars)
}

export function IconBtn({
  children,
  onClick,
  label,
}: {
  children: ReactNode
  onClick?: () => void
  label: string
}) {
  return (
    <button className="icon-btn" onClick={onClick} aria-label={label} type="button">
      {children}
    </button>
  )
}

export function Empty({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div style={{ opacity: 0.7 }}>{icon}</div>
      <h3>{title}</h3>
      {hint ? <p>{hint}</p> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  )
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {title ? <h3 style={{ margin: '0 0 12px' }}>{title}</h3> : null}
        {children}
      </div>
    </div>
  )
}

export function Confirm({
  open,
  title,
  body,
  onClose,
  onConfirm,
  danger,
}: {
  open: boolean
  title: string
  body?: string
  onClose: () => void
  onConfirm: () => void
  danger?: boolean
}) {
  const tr = useT()
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        {body ? <p className="muted">{body}</p> : null}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" type="button" onClick={onClose}>
            {tr('cancel')}
          </button>
          <button className={`btn ${danger ? 'danger' : ''}`} type="button" onClick={onConfirm}>
            {tr('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Segment({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
  disabled?: boolean
}) {
  return (
    <div className={`seg${disabled ? ' disabled' : ''}`}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={o.id === value ? 'on' : ''}
          disabled={disabled}
          onClick={() => {
            if (!disabled) onChange(o.id)
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" aria-valuenow={Math.round(value)} role="progressbar">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function Ring({ value, size = 72 }: { value: number; size?: number }) {
  const r = 28
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <svg className="ring" width={size} height={size} viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="8" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">
        {Math.round(v)}%
      </text>
    </svg>
  )
}

export function Toast({ text, onDone }: { text: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!text) return
    const id = setTimeout(onDone, 1800)
    return () => clearTimeout(id)
  }, [text, onDone])
  if (!text) return null
  return <div className="toast">{text}</div>
}

export function SubjectSelect({
  value,
  onChange,
}: {
  value?: string
  onChange: (id: string | undefined) => void
}) {
  const { subjects } = useStore()
  const tr = useT()
  return (
    <select className="field" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{tr('none')}</option>
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  )
}

export function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const tr = useT()
  return (
    <div>
      <div className="chip-row" style={{ marginBottom: 8 }}>
        {value.map((tg) => (
          <button key={tg} type="button" className="chip active" onClick={() => onChange(value.filter((x) => x !== tg))}>
            {tg} ×
          </button>
        ))}
      </div>
      <input
        ref={input}
        className="field"
        placeholder={tr('tag')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const v = input.current?.value.trim()
            if (v && !value.includes(v)) onChange([...value, v])
            if (input.current) input.current.value = ''
          }
        }}
      />
    </div>
  )
}

export function DateField({
  value,
  onChange,
}: {
  value?: number
  onChange: (v: number | undefined) => void
}) {
  const str = value ? new Date(value).toISOString().slice(0, 10) : ''
  return (
    <input
      className="field"
      type="date"
      value={str}
      onChange={(e) => onChange(e.target.value ? new Date(e.target.value + 'T12:00:00').getTime() : undefined)}
    />
  )
}
