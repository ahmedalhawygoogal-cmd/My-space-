import { useState, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  BookOpen,
  Bot,
  CheckSquare,
  GitBranch,
  Home,
  Inbox,
  Layers,
  LayoutGrid,
  Mic,
  Search,
  Settings,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { I18nKey } from './i18n'
import { CloseBtn, Sheet, useT } from './ui'
import { SpaceSwitcher } from './components/Spaces'
import { stopSpeak } from './utils'

const NAV_ITEMS = [
  { to: '/', key: 'home', icon: Home, center: false },
  { to: '/spaces', key: 'spaces', icon: LayoutGrid, center: false },
  { to: '/ai', key: 'saturn', icon: Sparkles, center: true },
  { to: '/inbox', key: 'inbox', icon: Inbox, center: false },
  { to: '/workflows', key: 'workflows', icon: GitBranch, center: false },
] satisfies { to: string; key: I18nKey; icon: LucideIcon; center: boolean }[]

function isActiveTab(path: string, to: string): boolean {
  if (to === '/') return path === '/'
  return path === to || path.startsWith(`${to}/`)
}

function WatermarkIcon(path: string): LucideIcon | null {
  if (path === '/') return Home
  if (path.startsWith('/record')) return Mic
  if (path.startsWith('/cards')) return Layers
  if (path.startsWith('/tasks')) return CheckSquare
  if (path.startsWith('/notes')) return BookOpen
  if (path.startsWith('/habits')) return Activity
  if (path.startsWith('/spaces')) return Layers
  if (path.startsWith('/inbox')) return Inbox
  if (path.startsWith('/workflows')) return Workflow
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
  const Mark = WatermarkIcon(loc.pathname)

  function go(path: string) {
    setDiscoverOpen(false)
    nav(path)
  }

  return (
    <div className={`app-shell h-[100dvh] w-full overflow-hidden flex flex-col bg-gray-50 relative${isRoot ? ' is-home' : ' hide-chrome'}`}>
      <div className="cosmic-bg-layer" aria-hidden="true" />
      <div className="cosmic-field" aria-hidden="true" />
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
          <DiscoverTile icon={<Workflow size={20} />} title={tr('workflows')} onClick={() => go('/workflows')} />
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
      <nav className="bottom-nav glass-panel" aria-label={tr('appName')}>
        {NAV_ITEMS.map((item) => {
          const active = isActiveTab(loc.pathname, item.to)
          const Icon = item.icon
          return (
            <button
              key={item.to}
              className={`bottom-nav-tab${item.center ? ' is-center' : ''}`}
              type="button"
              aria-current={active ? 'page' : undefined}
              aria-label={tr(item.key)}
              onClick={() => nav(item.to)}
            >
              {item.center ? (
                <span className="bottom-nav-saturn">
                  <Icon size={22} />
                </span>
              ) : (
                <span className="bottom-nav-icon">
                  <Icon size={19} />
                </span>
              )}
              <span className="bottom-nav-label">{tr(item.key)}</span>
            </button>
          )
        })}
      </nav>
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
