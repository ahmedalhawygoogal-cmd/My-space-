import { useState, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, BookOpen, CheckSquare, Home, Layers, Mic, Search, Settings, Sparkles, type LucideIcon } from 'lucide-react'
import { CloseBtn, Sheet, useT } from './ui'

function watermarkIcon(path: string): LucideIcon | null {
  if (path === '/') return Home
  if (path.startsWith('/record')) return Mic
  if (path.startsWith('/cards')) return Layers
  if (path.startsWith('/tasks')) return CheckSquare
  if (path.startsWith('/notes')) return BookOpen
  if (path.startsWith('/habits')) return Activity
  if (path.startsWith('/motivate')) return Sparkles
  return null
}

export function Layout() {
  const tr = useT()
  const nav = useNavigate()
  const loc = useLocation()
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const isRoot = loc.pathname === '/'
  const isDeckDetails = /^\/cards\/[^/]+$/.test(loc.pathname)
  const Mark = watermarkIcon(loc.pathname)

  function go(path: string) {
    setDiscoverOpen(false)
    nav(path)
  }

  return (
    <div className={`app-shell${isRoot ? '' : ' hide-chrome'}`}>
      <div className="app-bg" aria-hidden="true">
        <div className="app-bg-beam app-bg-beam-a" />
        <div className="app-bg-beam app-bg-beam-b" />
        <div className="app-bg-orb app-bg-orb-tl" />
        <div className="app-bg-orb app-bg-orb-br" />
        <svg className="app-bg-wave" viewBox="0 0 390 180" preserveAspectRatio="none">
          <path
            d="M0 92 C 48 132, 96 48, 156 78 C 216 108, 258 38, 312 70 C 348 90, 372 118, 390 132 L 390 180 L 0 180 Z"
            fill="url(#waveFill)"
          />
          <path
            d="M0 108 C 54 148, 110 62, 168 94 C 226 126, 270 58, 324 86 C 356 102, 376 128, 390 146"
            fill="none"
            stroke="url(#waveStroke)"
            strokeWidth="2.2"
          />
          <defs>
            <linearGradient id="waveFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="waveStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {isRoot ? (
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">M</div>
            <span>{tr('appName')}</span>
          </div>
          <div className="row">
            <button
              className="icon-btn discover-pulse"
              type="button"
              aria-label={tr('discover')}
              onClick={() => setDiscoverOpen(true)}
            >
              <Sparkles size={18} />
            </button>
            <button className="icon-btn" type="button" aria-label={tr('search')} onClick={() => nav('/search')}>
              <Search size={18} />
            </button>
            <button className="icon-btn" type="button" aria-label={tr('settings')} onClick={() => nav('/settings')}>
              <Settings size={18} />
            </button>
          </div>
        </header>
      ) : (
        <CloseBtn onClick={isDeckDetails ? () => nav('/cards', { replace: true }) : undefined} />
      )}
      <Sheet open={discoverOpen} onClose={() => setDiscoverOpen(false)} title={tr('discover')}>
        <div className="discover-grid">
          <DiscoverTile icon={<BookOpen size={20} />} title={tr('notebook')} onClick={() => go('/notes')} />
          <DiscoverTile icon={<CheckSquare size={20} />} title={tr('tasks')} onClick={() => go('/tasks')} />
          <DiscoverTile icon={<Layers size={20} />} title={tr('flashcards')} onClick={() => go('/cards')} />
          <DiscoverTile icon={<Mic size={20} />} title={tr('recorder')} onClick={() => go('/record')} />
          <DiscoverTile
            icon={<Sparkles size={20} />}
            title={tr('motivateMe')}
            hint={tr('motivateSubtitle')}
            onClick={() => go('/motivate')}
          />
          <DiscoverTile icon={<Activity size={20} />} title={tr('habits')} onClick={() => go('/habits')} />
        </div>
      </Sheet>
      {Mark && (
        <div className="page-watermark" aria-hidden="true">
          <Mark size={250} strokeWidth={1.15} />
        </div>
      )}
      <main key={loc.pathname} className="main page-transition">
        <Outlet />
      </main>
    </div>
  )
}

function DiscoverTile({
  icon,
  title,
  hint,
  onClick,
  disabled,
}: {
  icon: ReactNode
  title: string
  hint?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      className={`card pressable discover-tile${disabled ? ' is-disabled' : ''}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <div className="discover-tile-icon">{icon}</div>
      <div className="grow">
        <b>{title}</b>
        {hint ? (
          <div className="muted" style={{ fontSize: 12 }}>
            {hint}
          </div>
        ) : null}
      </div>
    </button>
  )
}

export function Splash() {
  return (
    <div className="splash">
      <div className="splash-inner">
        <div className="splash-mark">M</div>
        <div className="splash-spin" aria-hidden="true" />
      </div>
    </div>
  )
}
