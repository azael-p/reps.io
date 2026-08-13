import { useNavigate, useLocation } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { Home, Zap, Layers, TrendingUp, Timer, LogOut } from 'lucide-react'

const TABS = [
  { label: 'Inicio',    Icon: Home,       ruta: '/home' },
  { label: 'Entrenar',  Icon: Zap,        ruta: '/entrenar' },
  { label: 'Programas', Icon: Layers,     ruta: '/programas' },
  { label: 'Progreso',  Icon: TrendingUp, ruta: '/progreso' },
  { label: 'Timer',     Icon: Timer,      ruta: '/timer' },
]

export default function DesktopSidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { usuario, logout } = useUser()

  const activa = (ruta) => {
    if (ruta === '/programas') return pathname.startsWith('/programas')
    return pathname === ruta
  }

  const inicial = usuario?.nombre?.[0]?.toUpperCase() ?? '?'

  return (
    <nav className="desktop-only desktop-sidebar">
      {/* Logo */}
      <div className="desktop-sidebar-logo">
        <div className="desktop-sidebar-logo-circle">R</div>
      </div>

      {/* Nav items */}
      <div className="desktop-sidebar-nav-items">
        {TABS.map((tab) => {
          const active = activa(tab.ruta)
          return (
            <div key={tab.ruta} className="sidebar-item-wrap">
              <button
                className={`desktop-sidebar-item ${active ? 'desktop-sidebar-item--active' : ''}`}
                onClick={() => navigate(tab.ruta)}
                title={tab.label}
              >
                {active && <div className="desktop-sidebar-active-line" />}
                <tab.Icon
                  size={21}
                  strokeWidth={active ? 2.2 : 1.8}
                  color={active ? 'var(--orange)' : 'var(--text-dim)'}
                />
              </button>
              <div className="sidebar-tooltip">{tab.label}</div>
            </div>
          )
        })}
      </div>

      {/* Avatar / logout */}
      <div className="sidebar-item-wrap">
        <button className="desktop-sidebar-avatar" onClick={logout} title="Salir">
          <span className="desktop-sidebar-avatar-initial">{inicial}</span>
          <span className="desktop-sidebar-avatar-logout"><LogOut size={14} strokeWidth={2} /></span>
        </button>
        <div className="sidebar-tooltip">Salir</div>
      </div>
    </nav>
  )
}
