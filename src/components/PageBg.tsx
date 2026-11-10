import type { ReactNode } from 'react'

export const PAGE_BG = {
  home: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1920&auto=format&fit=crop',
  tasks: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=1920&auto=format&fit=crop',
  notebook: 'https://images.unsplash.com/photo-1517842645767-c639042777db?q=80&w=1920&auto=format&fit=crop',
  flashcards: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?q=80&w=1920&auto=format&fit=crop',
  recorder: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=1920&auto=format&fit=crop',
  motivate: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1920&auto=format&fit=crop',
  settings: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=1920&auto=format&fit=crop',
  search: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=1920&auto=format&fit=crop',
  downloads: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=1920&auto=format&fit=crop',
  auth: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1920&auto=format&fit=crop',
  onboard: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?q=80&w=1920&auto=format&fit=crop',
} as const

export function PageBg({
  src,
  children,
  className,
  fill,
}: {
  src: string
  children: ReactNode
  className?: string
  fill?: boolean
}) {
  const cls = ['page-bg', fill ? 'page-bg-fill' : '', className].filter(Boolean).join(' ')
  return (
    <div className={cls} style={{ backgroundImage: `url('${src}')` }}>
      <div className="page-bg-overlay" aria-hidden />
      <div className="page-bg-content">{children}</div>
    </div>
  )
}
