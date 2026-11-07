import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion'
import { t, type I18nKey } from './i18n'
import { useStore } from './store'

export const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
}

export const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

export const listItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}

const tap = { scale: 0.95 }
const fade = { duration: 0.2 }
const slide = { duration: 0.22, ease: 'easeOut' as const }

export function useT() {
  const { lang } = useStore()
  return (key: I18nKey, vars?: Record<string, string | number>) => t(lang, key, vars)
}

export function Button({ type = 'button', ...props }: HTMLMotionProps<'button'>) {
  return <motion.button type={type} whileTap={tap} {...props} />
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
    <motion.button className="icon-btn" onClick={onClick} aria-label={label} type="button" whileTap={tap}>
      {children}
    </motion.button>
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
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="sheet-backdrop backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
        >
          <motion.div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={slide}
          >
            <div className="sheet-handle" />
            {title ? <h3 style={{ margin: '0 0 12px' }}>{title}</h3> : null}
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
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
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="sheet-backdrop backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
        >
          <motion.div
            className="dialog"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={slide}
          >
            <h3 style={{ marginTop: 0 }}>{title}</h3>
            {body ? <p className="muted">{body}</p> : null}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <Button className="btn ghost" onClick={onClose}>
                {tr('cancel')}
              </Button>
              <Button className={`btn ${danger ? 'danger' : ''}`} onClick={onConfirm}>
                {tr('confirm')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function Segment({
  value,
  options,
  onChange,
}: {
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <Button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </Button>
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
          <Button key={tg} className="chip active" onClick={() => onChange(value.filter((x) => x !== tg))}>
            {tg} ×
          </Button>
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
