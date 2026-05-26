import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useUser } from '../context/UserContext'
import { useNavigate } from 'react-router-dom'
import { getFechasSesiones } from '../firebase/sesiones'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import Calendario from '../components/Calendario'
import Onboarding from '../components/Onboarding'
import PullToRefresh from '../components/PullToRefresh'
import { useDesktop } from '../hooks/useDesktop'

const SECCIONES = [
  {
    label: 'Mis programas',
    sub: 'Rutinas y ejercicios',
    ruta: '/programas',
    gradient: 'var(--green-grad)',
    accent: 'var(--green)',
    glow: 'var(--green-glow)',
    icon: '📋',
  },
  {
    label: 'Entrenar hoy',
    sub: 'Iniciar sesión',
    ruta: '/entrenar',
    gradient: 'var(--orange-grad)',
    accent: 'var(--orange)',
    glow: 'var(--orange-glow)',
    icon: '🔥',
  },
  {
    label: 'Mi progreso',
    sub: 'Gráficos e historial',
    ruta: '/progreso',
    gradient: 'var(--blue-grad)',
    accent: 'var(--blue)',
    glow: 'var(--blue-glow)',
    icon: '📈',
  },
]

export default function Home() {
  const isDesktop = useDesktop()
  const { usuario, logout } = useUser()
  const navigate = useNavigate()
  const [fechas, setFechas] = useState([])
  const [cargandoCal, setCargandoCal] = useState(true)
  const [sesionPendiente, setSesionPendiente] = useState(null)
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem(`onboarding_${usuario?.id}`) === '1'
  )

  const recargar = useCallback(async () => {
    const cacheKey = `calendario_${usuario.id}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { fechas: ms } = JSON.parse(cached)
        setFechas(ms.map(t => ({ toDate: () => new Date(t), toMillis: () => t })))
        setCargandoCal(false)
      } else {
        const fetched = await getFechasSesiones(usuario.id)
        setFechas(fetched)
        localStorage.setItem(cacheKey, JSON.stringify({
          fechas: fetched.map(f => f?.toMillis?.() ?? null).filter(Boolean),
        }))
        setCargandoCal(false)
      }
    } catch (e) { console.error(e); setCargandoCal(false) }

    try {
      const stored = localStorage.getItem(`sesion_activa_${usuario.id}`)
      if (!stored) return
      const snap = await getDoc(doc(db, 'sesiones', stored))
      if (!snap.exists() || snap.data().completada) {
        localStorage.removeItem(`sesion_activa_${usuario.id}`)
        return
      }
      const diaSnap = await getDoc(doc(db, 'dias', snap.data().diaId))
      setSesionPendiente({ sesionId: stored, diaNombre: diaSnap.data()?.nombre ?? 'Entrenamiento' })
    } catch (e) { console.error(e) }
  }, [usuario])

  useEffect(() => { setCargandoCal(true); recargar() }, [recargar]) // eslint-disable-line

  return (
    <motion.div
      style={{ ...s.page, ...(isDesktop ? s.pageDesktop : {}) }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <PullToRefresh onRefresh={() => { localStorage.removeItem(`calendario_${usuario.id}`); return recargar() }}>
        <motion.div
          style={s.header}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div>
          <p style={s.saludo}>Hola, <span style={s.nombreAccent}>{usuario?.nombre}</span></p>
          <p style={s.sub}>¿Qué hacemos hoy?</p>
        </div>
        <motion.button
          style={s.logoutBtn}
          onClick={() => { logout(); navigate('/') }}
          whileTap={{ scale: 0.95 }}
          whileHover={{ borderColor: 'var(--border-strong)' }}
        >
          Salir
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {!onboardingDone && (
          <Onboarding
            usuarioId={usuario.id}
            onCompletar={() => {
              localStorage.setItem(`onboarding_${usuario.id}`, '1')
              setOnboardingDone(true)
            }}
          />
        )}
      </AnimatePresence>

      {isDesktop ? (
        <div style={s.desktopGrid}>
          {/* Left column: section cards */}
          <div style={s.desktopLeft}>
            <div style={s.secciones}>
              {SECCIONES.map((sec, i) => (
                <motion.button
                  key={sec.ruta}
                  style={s.seccionCard}
                  onClick={() => navigate(sec.ruta)}
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 200, damping: 22 }}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div style={{ ...s.seccionBg, background: sec.gradient }} />
                  <div style={{ ...s.seccionGlow, background: `radial-gradient(circle at 50% 0%, ${sec.glow}, transparent 70%)` }} />
                  <div style={s.seccionIcon}>{sec.icon}</div>
                  <div style={s.seccionTexto}>
                    <span style={s.seccionLabel}>{sec.label}</span>
                    <span style={s.seccionSub}>{sec.sub}</span>
                  </div>
                  <span style={s.seccionFlecha}>→</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Right column: session banner + calendar */}
          <div style={s.desktopRight}>
            <AnimatePresence>
              {sesionPendiente && (
                <motion.button
                  style={s.bannerSesion}
                  onClick={() => navigate(`/sesion/${sesionPendiente.sesionId}`)}
                  initial={{ opacity: 0, y: -10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div style={s.bannerDot} className="pulse" />
                  <div style={s.bannerTexto}>
                    <span style={s.bannerLabel}>Entrenamiento en curso</span>
                    <span style={s.bannerDia}>{sesionPendiente.diaNombre}</span>
                  </div>
                  <span style={s.bannerFlecha}>→</span>
                </motion.button>
              )}
            </AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              {cargandoCal ? (
                <div style={s.calSkeleton} className="skeleton" />
              ) : (
                <Calendario fechas={fechas} />
              )}
            </motion.div>
          </div>
        </div>
      ) : (
        <>
          <AnimatePresence>
            {sesionPendiente && (
              <motion.button
                style={s.bannerSesion}
                onClick={() => navigate(`/sesion/${sesionPendiente.sesionId}`)}
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                whileTap={{ scale: 0.98 }}
              >
                <div style={s.bannerDot} className="pulse" />
                <div style={s.bannerTexto}>
                  <span style={s.bannerLabel}>Entrenamiento en curso</span>
                  <span style={s.bannerDia}>{sesionPendiente.diaNombre}</span>
                </div>
                <span style={s.bannerFlecha}>→</span>
              </motion.button>
            )}
          </AnimatePresence>

          <div style={s.secciones}>
            {SECCIONES.map((sec, i) => (
              <motion.button
                key={sec.ruta}
                style={s.seccionCard}
                onClick={() => navigate(sec.ruta)}
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 200, damping: 22 }}
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                <div style={{ ...s.seccionBg, background: sec.gradient }} />
                <div style={{ ...s.seccionGlow, background: `radial-gradient(circle at 50% 0%, ${sec.glow}, transparent 70%)` }} />
                <div style={s.seccionIcon}>{sec.icon}</div>
                <div style={s.seccionTexto}>
                  <span style={s.seccionLabel}>{sec.label}</span>
                  <span style={s.seccionSub}>{sec.sub}</span>
                </div>
                <span style={s.seccionFlecha}>→</span>
              </motion.button>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            style={{ marginTop: '20px' }}
          >
            {cargandoCal ? (
              <div style={s.calSkeleton} className="skeleton" />
            ) : (
              <Calendario fechas={fechas} />
            )}
          </motion.div>
        </>
      )}
      </PullToRefresh>
    </motion.div>
  )
}

const s = {
  page: {
    minHeight: '100dvh',
    color: 'var(--text)',
    padding: '20px 16px max(24px, env(safe-area-inset-bottom))',
    paddingTop: 'max(20px, env(safe-area-inset-top))',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxSizing: 'border-box',
  },
  pageDesktop: {
    padding: '32px 40px 40px',
    maxWidth: '960px',
    margin: '0 auto',
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  saludo: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' },
  nombreAccent: { color: 'var(--orange)' },
  sub: { marginTop: '4px', color: 'var(--text-mute)', fontSize: '0.9rem' },
  logoutBtn: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    padding: '10px 16px',
    borderRadius: 'var(--r-md)',
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  bannerSesion: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 16px',
    background: 'var(--bg-card)',
    border: '1px solid rgba(240, 153, 123, 0.45)',
    borderRadius: 'var(--r-lg)',
    color: 'var(--text)',
    textAlign: 'left',
    boxShadow: '0 0 0 1px rgba(240,153,123,0.15), 0 6px 20px rgba(199,90,48,0.12)',
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  bannerDot: {
    width: '10px', height: '10px',
    borderRadius: '50%',
    background: 'var(--orange)',
    boxShadow: '0 0 8px var(--orange)',
    flexShrink: 0,
  },
  bannerTexto: { display: 'flex', flexDirection: 'column', flex: 1, gap: '2px' },
  bannerLabel: { fontSize: '0.7rem', fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  bannerDia: { fontSize: '0.97rem', fontWeight: 600 },
  bannerFlecha: { fontSize: '1.1rem', color: 'var(--text-mute)' },
  secciones: { display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 },
  seccionCard: {
    position: 'relative',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '16px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    background: 'transparent',
    overflow: 'hidden',
    textAlign: 'left',
    color: '#fff',
    boxShadow: 'var(--shadow-md)',
  },
  seccionBg: {
    position: 'absolute', inset: 0,
    opacity: 0.95,
    zIndex: 0,
  },
  seccionGlow: {
    position: 'absolute', inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
  },
  seccionIcon: {
    width: '44px', height: '44px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.5rem',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
    backdropFilter: 'blur(8px)',
    zIndex: 1, flexShrink: 0,
  },
  seccionTexto: { display: 'flex', flexDirection: 'column', flex: 1, zIndex: 1 },
  seccionLabel: { fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' },
  seccionSub: { color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem', marginTop: '2px' },
  seccionFlecha: { color: 'rgba(255,255,255,0.85)', fontSize: '1.2rem', zIndex: 1 },
  calSkeleton: { width: '100%', height: '280px', borderRadius: 'var(--r-lg)' },
  desktopGrid: {
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    gap: '24px',
    alignItems: 'start',
  },
  desktopLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  desktopRight: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
}
