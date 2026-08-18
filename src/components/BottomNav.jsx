import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { Home, Zap, Layers, TrendingUp, Timer } from 'lucide-react'
import { useTimerActivo } from '../context/TimerActivoContext'
import { ConfirmDialog } from './ui'

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
  const { timerActivo } = useTimerActivo()
  const [destinoPendiente, setDestinoPendiente] = useState(null)

  const visible = RUTAS_NAV.includes(pathname) || pathname.startsWith('/programas/')

  if (!visible) return null

  const activa = (ruta) => {
    if (ruta === '/programas') return pathname.startsWith('/programas')
    return pathname === ruta
  }

  function irA(ruta) {
    // Salir de /timer con el timer corriendo pierde la fase y el tiempo
    // transcurrido (no se persiste en ningún lado) — se confirma antes.
    if (timerActivo && pathname === '/timer' && ruta !== '/timer') {
      setDestinoPendiente(ruta)
      return
    }
    navigate(ruta)
  }

  return (
    <>
      <div className="bottom-nav-spacer" />
      <motion.nav
        className="mobile-only bottom-nav"
        initial={{ y: NAV_H }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      >
        {TABS.map(t => {
          const active = activa(t.ruta)
          return (
            <motion.button
              key={t.ruta}
              className="bottom-nav-tab"
              onClick={() => irA(t.ruta)}
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
              <span className="bottom-nav-label" style={{ color: active ? 'var(--orange)' : 'var(--text-dim)', position: 'relative', zIndex: 1 }}>
                {t.label}
              </span>
            </motion.button>
          )
        })}
      </motion.nav>
      <ConfirmDialog
        open={!!destinoPendiente}
        data={{
          titulo: '¿Salir del timer?',
          descripcion: 'Vas a perder el tiempo transcurrido.',
          confirmLabel: 'Salir',
          cancelLabel: 'Seguir',
          onConfirm: () => navigate(destinoPendiente),
        }}
        onClose={() => setDestinoPendiente(null)}
      />
    </>
  )
}

const NAV_H = 64
