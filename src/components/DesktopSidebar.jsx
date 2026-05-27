import { useNavigate, useLocation } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { Home, Zap, Layers, TrendingUp, LogOut } from 'lucide-react'

const TABS = [
  { label: 'Inicio',    Icon: Home,       ruta: '/home' },
  { label: 'Entrenar',  Icon: Zap,        ruta: '/entrenar' },
  { label: 'Programas', Icon: Layers,     ruta: '/programas' },
  { label: 'Progreso',  Icon: TrendingUp, ruta: '/progreso' },
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
    <nav className="desktop-only" style={s.sidebar}>
      {/* Logo */}
      <div style={s.logo}>
        <div style={s.logoCircle}>R</div>
      </div>

      {/* Nav items */}
      <div style={s.navItems}>
        {TABS.map((tab) => {
          const active = activa(tab.ruta)
          return (
            <div key={tab.ruta} style={s.itemWrap} className="sidebar-item-wrap">
              <button
                style={{ ...s.item, ...(active ? s.itemActive : {}) }}
                onClick={() => navigate(tab.ruta)}
                title={tab.label}
              >
                {active && <div style={s.activeLine} />}
                <tab.Icon
                  size={21}
                  strokeWidth={active ? 2.2 : 1.8}
                  color={active ? 'var(--orange)' : 'var(--text-dim)'}
                />
              </button>
              <div style={s.tooltip}>{tab.label}</div>
            </div>
          )
        })}
      </div>

      {/* Avatar / logout */}
      <div style={s.avatarWrap} className="sidebar-item-wrap">
        <button style={s.avatar} onClick={logout} title="Salir">
          <span style={s.avatarInitial}>{inicial}</span>
          <span style={s.avatarLogout}><LogOut size={14} strokeWidth={2} /></span>
        </button>
        <div style={s.tooltip}>Salir</div>
      </div>
    </nav>
  )
}

const s = {
  sidebar: {
    position: 'fixed',
    left: 0, top: 0,
    width: '60px',
    height: '100vh',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-elev)',
    borderRight: '1px solid var(--border)',
    zIndex: 100,
    paddingTop: '12px',
    paddingBottom: '16px',
    gap: '0',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--border)',
    marginBottom: '8px',
  },
  logoCircle: {
    width: '36px', height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #f0997b 0%, #c75a30 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 800, fontSize: '1rem',
    boxShadow: '0 4px 12px rgba(240,153,123,0.3)',
  },
  navItems: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    width: '100%',
    paddingTop: '4px',
  },
  itemWrap: {
    position: 'relative',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
  },
  item: {
    width: '100%',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    borderRadius: '0',
    position: 'relative',
    cursor: 'pointer',
  },
  itemActive: {
    background: 'rgba(240,153,123,0.08)',
  },
  activeLine: {
    position: 'absolute',
    left: 0, top: '50%',
    transform: 'translateY(-50%)',
    width: '3px', height: '24px',
    borderRadius: '0 2px 2px 0',
    background: 'var(--orange-grad)',
  },
  tooltip: {
    position: 'absolute',
    left: '68px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    opacity: 0,
    transition: 'opacity 0.15s',
    zIndex: 200,
    boxShadow: 'var(--shadow-md)',
  },
  avatarWrap: {
    position: 'relative',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '36px', height: '36px',
    borderRadius: '50%',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    fontSize: '0.9rem', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarInitial: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.15s',
  },
  avatarLogout: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: 0,
    background: 'rgba(255,107,107,0.15)',
    color: 'var(--danger)',
    transition: 'opacity 0.15s',
  },
}
