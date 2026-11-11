import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CheckSquare, Home, Layers, Mic, Search, Settings, Sparkles } from 'lucide-react'
import { BackBtn, Sheet, useT } from './ui'

const ROOT_PATHS = new Set(['/', '/record', '/cards', '/tasks', '/notes', '/habits'])

export function Layout() {
  const tr = useT()
  const nav = useNavigate()
  const loc = useLocation()
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const isRoot = ROOT_PATHS.has(loc.pathname)

  return (
    <div className={`app-shell${isRoot ? '' : ' hide-chrome'}`}>
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
        <header className="topbar inner-topbar">
          <BackBtn />
        </header>
      )}
      <Sheet open={discoverOpen} onClose={() => setDiscoverOpen(false)} title={tr('discover')}>
        <div className="discover-grid">
          <button
            className="card pressable discover-tile"
            type="button"
            onClick={() => {
              setDiscoverOpen(false)
              nav('/motivate')
            }}
          >
            <div className="discover-tile-icon">
              <Sparkles size={20} />
            </div>
            <div className="grow">
              <b>{tr('motivateMe')}</b>
              <div className="muted" style={{ fontSize: 12 }}>
                {tr('motivateSubtitle')}
              </div>
            </div>
          </button>
        </div>
      </Sheet>
      <main className="main">
        <Outlet />
      </main>
      {isRoot && (
        <nav className="bottom-nav">
          <Item to="/" icon={<Home />} label={tr('home')} />
          <Item to="/record" icon={<Mic />} label={tr('recorder')} />
          <Item to="/cards" icon={<Layers />} label={tr('flashcards')} />
          <Item to="/tasks" icon={<CheckSquare />} label={tr('tasks')} />
          <Item to="/notes" icon={<BookOpen />} label={tr('notebook')} />
        </nav>
      )}
    </div>
  )
}

function Item({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      {icon}
      <span>{label}</span>
    </NavLink>
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
