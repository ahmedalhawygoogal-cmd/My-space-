import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Tracks open overlays so nested ones (a Confirm inside a Sheet) don't both
// react to Escape — only the topmost should.
const openStack: symbol[] = []

/**
 * Renders modal content into document.body, escaping the scrollable `.main`
 * container and any ancestor stacking context, with a fixed backdrop, a focus
 * trap, and body scroll lock while open.
 */
export function GlobalOverlay({
  open,
  onClose,
  children,
  align = 'center',
  label = 'Dialog',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  align?: 'center' | 'bottom'
  label?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    const token = Symbol('overlay')
    openStack.push(token)
    returnFocusRef.current = document.activeElement

    const { body, documentElement } = document
    const prevOverflow = body.style.overflow
    const prevPadding = body.style.paddingInlineEnd
    // Compensate for the scrollbar so locking the body does not shift layout.
    const scrollbar = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingInlineEnd = `${scrollbar}px`

    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== token) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (!items.length) {
        event.preventDefault()
        panel.focus()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (!firstItem || !lastItem) return
      if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === panel)) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      const index = openStack.indexOf(token)
      if (index >= 0) openStack.splice(index, 1)
      body.style.overflow = prevOverflow
      body.style.paddingInlineEnd = prevPadding
      const el = returnFocusRef.current as HTMLElement | null
      el?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] bg-black/50 flex justify-center ${
        align === 'bottom' ? 'items-end' : 'items-center p-4'
      }`}
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="w-full"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
