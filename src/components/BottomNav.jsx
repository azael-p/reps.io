import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { Home, Zap, Layers, TrendingUp, Timer } from 'lucide-react'

const TABS = [
  { label: 'Inicio',    Icon: Home,        ruta: '/home' },
  { label: 'Entrenar',  Icon: Zap,         ruta: '/entrenar' },
  { label: 'Programas', Icon: Layers,      ruta: '/programas' },
  { label: 'Progreso',  Icon: TrendingUp,  ruta: '/progreso' },
  { label: 'Timer',     Icon: Timer,       ruta: '/timer' },
]

const RUTAS_NAV = ['/home', '/entrenar', '/programas', '/progreso', '/timer']

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
              {active && (
                <motion.div
                  style={{
                    position: 'absolute',
                    inset: '6px 10px',
                    borderRadius: '12px',
                    background: 'rgba(240, 153, 123, 0.14)',
                    border: '1px solid rgba(240, 153, 123, 0.3)',
                    boxShadow: '0 0 16px rgba(240,153,123,0.4)',
                  }}
                  layoutId="nav-pill"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <t.Icon
                size={21}
                strokeWidth={active ? 2.2 : 1.8}
                color={active ? 'var(--orange)' : 'var(--text-mute)'}
                style={{ position: 'relative', zIndex: 1, transition: 'color var(--transition-base)' }}
              />
              <span style={{ ...s.label, color: active ? 'var(--orange)' : 'var(--text-dim)', position: 'relative', zIndex: 1 }}>
                {t.label}
              </span>
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
    borderTop: '1px solid var(--border-strong)',
    boxShadow: '0 -8px 24px rgba(0,0,0,0.4)',
    zIndex: 50,
  },
  tab: {
    flex: 1,
    height: NAV_H,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '3px',
    padding: '10px 0 8px',
    background: 'none', border: 'none',
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    inset: '6px 10px',
    borderRadius: '12px',
    background: 'rgba(240, 153, 123, 0.14)',
    border: '1px solid rgba(240, 153, 123, 0.3)',
  },
  label: {
    fontSize: '0.68rem', fontWeight: 600,
    letterSpacing: '0.02em',
  },
}
