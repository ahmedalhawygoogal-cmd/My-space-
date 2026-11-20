import { useState, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, BookOpen, Bot, CheckSquare, Home, Inbox, Layers, Mic, Search, Settings, Sparkles, type LucideIcon } from 'lucide-react'
import { CloseBtn, Sheet, useT } from './ui'
import { SpaceSwitcher } from './components/Spaces'
import { stopSpeak } from './utils'

function watermarkIcon(path: string): LucideIcon | null {
  if (path === '/') return Home
  if (path.startsWith('/record')) return Mic
  if (path.startsWith('/cards')) return Layers
  if (path.startsWith('/tasks')) return CheckSquare
  if (path.startsWith('/notes')) return BookOpen
  if (path.startsWith('/habits')) return Activity
  if (path.startsWith('/spaces')) return Layers
  if (path.startsWith('/inbox')) return Inbox
  if (path.startsWith('/motivate')) return Sparkles
  return null
}

export function Layout() {
  const tr = useT()
  const nav = useNavigate()
  const loc = useLocation()
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const isRoot = loc.pathname === '/'
  const isCardsInner = loc.pathname.startsWith('/cards/')
  const Mark = watermarkIcon(loc.pathname)

  function go(path: string) {
    setDiscoverOpen(false)
    nav(path)
  }

  return (
    <div className={`app-shell h-[100dvh] w-full overflow-hidden flex flex-col bg-gray-50 relative${isRoot ? '' : ' hide-chrome'}`}>
      <div className="app-bg" aria-hidden="true" />
      {isRoot ? (
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">M</div>
            <span>{tr('appName')}</span>
          </div>
          <div className="row">
            <SpaceSwitcher />
            <button
              className="icon-btn discover-pulse"
              type="button"
              aria-label={tr('discover')}
              onClick={() => setDiscoverOpen(true)}
            >
              <Sparkles size={18} />
            </button>
            <button className="icon-btn" type="button" aria-label={tr('inbox')} onClick={() => nav('/inbox')}>
              <Inbox size={18} />
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
        <CloseBtn
          onClick={
            isCardsInner
              ? () => {
                  stopSpeak()
                  nav('/cards', { replace: true })
                }
              : undefined
          }
        />
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
          <DiscoverTile icon={<Bot size={20} />} title={tr('aiAssistant')} onClick={() => go('/ai')} />
          <DiscoverTile icon={<Activity size={20} />} title={tr('habits')} onClick={() => go('/habits')} />
          <DiscoverTile icon={<Layers size={20} />} title={tr('spaces')} onClick={() => go('/spaces')} />
          <DiscoverTile icon={<Inbox size={20} />} title={tr('inbox')} onClick={() => go('/inbox')} />
        </div>
      </Sheet>
      {Mark && (
        <div className="page-watermark" aria-hidden="true">
          <Mark size={250} strokeWidth={1.15} />
        </div>
      )}
      <div id="global-actions" />
      <main key={loc.pathname} className="flex-1 w-full overflow-y-auto overflow-x-hidden relative main page-transition">
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

export function Splash({ showResetHint = false }: { showResetHint?: boolean }) {
  const tr = useT()
  return (
    <div className="splash">
      <div className="splash-inner">
        <div className="splash-mark">M</div>
        <div className="splash-spin" aria-hidden="true" />
        {showResetHint ? (
          <p className="splash-reset-hint" role="status">
            {tr('splashResetHint')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
