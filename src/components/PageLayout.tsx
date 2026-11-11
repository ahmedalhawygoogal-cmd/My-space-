import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function PageLayout({
  icon: Icon,
  children,
  className,
  fill,
  bottom = true,
}: {
  icon: LucideIcon
  children: ReactNode
  className?: string
  fill?: boolean
  bottom?: boolean
}) {
  const cls = [
    'page-layout',
    'flex',
    'flex-col',
    'bg-background',
    'relative',
    'overflow-hidden',
    'text-foreground',
    fill ? 'page-layout-fill' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      <div className="page-wave page-wave-top absolute top-0 w-full" aria-hidden>
        <svg viewBox="0 0 1440 280" preserveAspectRatio="none" className="page-wave-svg text-primary">
          <path d="M0,0 L1440,0 L1440,180 Q720,280 0,180 Z" fill="currentColor" />
        </svg>
        <Icon size={120} className="page-wave-icon opacity-20 text-primary-foreground" />
      </div>
      <div className="page-scroll flex-1 overflow-y-auto overflow-x-hidden pb-28 relative z-10">
        <div className="page-wave-spacer" aria-hidden />
        <div className="page-layout-content p-4">{children}</div>
      </div>
      {bottom ? (
        <div className="page-wave page-wave-bottom" aria-hidden>
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="page-wave-svg text-primary">
            <path d="M0,320 L1440,320 L1440,120 Q720,20 0,120 Z" fill="currentColor" />
          </svg>
        </div>
      ) : null}
    </div>
  )
}
