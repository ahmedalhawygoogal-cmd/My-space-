import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CheckSquare, Home, Layers, Mic, Search, Settings } from 'lucide-react'
import { useT } from './ui'

export function Layout() {
  const tr = useT()
  const nav = useNavigate()
  const loc = useLocation()
  const hideNav =
    loc.pathname.includes('/study') ||
    loc.pathname.includes('/test') ||
    loc.pathname.includes('/game') ||
    loc.pathname.includes('/record/live') ||
    loc.pathname === '/notes/new' ||
    loc.pathname.endsWith('/edit')

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <span>{tr('appName')}</span>
        </div>
        <div className="row">
          <button className="icon-btn" type="button" aria-label={tr('search')} onClick={() => nav('/search')}>
            <Search size={18} />
          </button>
          <button className="icon-btn" type="button" aria-label={tr('settings')} onClick={() => nav('/settings')}>
            <Settings size={18} />
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      {!hideNav && (
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
      <div className="splash-mark">M</div>
    </div>
  )
}
