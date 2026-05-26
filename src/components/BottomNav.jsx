import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'

const ICONS = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  train: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 5v14M18 5v14M2 9h4M18 9h4M2 15h4M18 15h4M6 9h12M6 15h12"/>
    </svg>
  ),
  programs: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  progress: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
}

const TABS = [
  { label: 'Inicio',    icon: ICONS.home,     ruta: '/home' },
  { label: 'Entrenar',  icon: ICONS.train,    ruta: '/entrenar' },
  { label: 'Programas', icon: ICONS.programs, ruta: '/programas' },
  { label: 'Progreso',  icon: ICONS.progress, ruta: '/progreso' },
]

const RUTAS_NAV = ['/home', '/entrenar', '/programas', '/progreso']

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const visible = RUTAS_NAV.includes(pathname) || pathname.startsWith('/programas/')

  if (!visible) return null

  const activa = (ruta) => {
    if (ruta === '/programas') return pathname.startsWith('/programas')
    return pathname === ruta
  }

  return (
    <>
      <div className="bottom-nav-spacer" style={{ height: `calc(${NAV_H}px + env(safe-area-inset-bottom))` }} />
      <motion.nav
        className="mobile-only"
        style={s.nav}
        initial={{ y: NAV_H }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      >
        {TABS.map(t => {
          const active = activa(t.ruta)
          return (
            <motion.button
              key={t.ruta}
              style={s.tab}
              onClick={() => navigate(t.ruta)}
              whileTap={{ scale: 0.92 }}
            >
              <span style={{ ...s.icon, color: active ? 'var(--orange)' : 'var(--text-dim)' }}>{t.icon}</span>
              <span style={{ ...s.label, color: active ? 'var(--orange)' : 'var(--text-dim)' }}>
                {t.label}
              </span>
              {active && (
                <motion.div
                  style={s.activeDot}
                  layoutId="nav-dot"
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                />
              )}
            </motion.button>
          )
        })}
      </motion.nav>
    </>
  )
}

const NAV_H = 64

const s = {
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    display: 'flex', alignItems: 'flex-start',
    height: `calc(${NAV_H}px + env(safe-area-inset-bottom))`,
    paddingTop: '0',
    paddingBottom: 'env(safe-area-inset-bottom)',
    background: 'var(--bg-elev)',
    borderTop: '1px solid var(--border)',
    zIndex: 50,
  },
  tab: {
    flex: 1,
    height: NAV_H,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '2px',
    padding: '10px 0 8px',
    background: 'none', border: 'none',
    position: 'relative',
  },
  icon: { lineHeight: 1, display: 'flex' },
  label: {
    fontSize: '0.68rem', fontWeight: 600,
    letterSpacing: '0.02em',
  },
  activeDot: {
    position: 'absolute', top: 0,
    width: '20px', height: '2px',
    borderRadius: '2px',
    background: 'var(--orange-grad)',
  },
}
