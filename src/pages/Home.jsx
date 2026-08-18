import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useUser } from '../context/UserContext'
import { useNavigate } from 'react-router-dom'
import { getResumenGlobalConFallback } from '../firebase/statsGlobal'
import { getProximoDiaSugerido } from '../firebase/dias'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import Calendario from '../components/Calendario'
import Onboarding from '../components/Onboarding'
import PullToRefresh from '../components/PullToRefresh'
import Credit from '../components/Credit'
import { useDesktop } from '../hooks/useDesktop'
import { useToast } from '../components/Toast'
import { useIniciarSesion } from '../hooks/useIniciarSesion'
import { Layers, Zap, TrendingUp, ChevronRight, LogOut } from 'lucide-react'

const ICON_STYLE = { color: 'rgba(255,255,255,0.95)', strokeWidth: 1.8 }

function getGreeting(nombre) {
  const hour = new Date().getHours()
  const timeGreeting = hour < 6 ? 'Buenas noches' : hour < 12 ? 'Buenas, ¿qué tal?' : hour < 19 ? 'Hola' : 'Buenas noches'
  return nombre ? `${timeGreeting}, ${nombre}` : timeGreeting
}

const SECCIONES = [
  {
    label: 'Mis programas',
    sub: 'Rutinas y ejercicios',
    ruta: '/programas',
    gradient: 'var(--green-grad)',
    accent: 'var(--green)',
    glow: 'var(--green-glow)',
    shadow: 'var(--shadow-green)',
    borderToken: 'var(--border-green)',
    icon: <Layers size={22} {...ICON_STYLE} />,
  },
  {
    label: 'Entrenar hoy',
    sub: 'Iniciar sesión',
    ruta: '/entrenar',
    gradient: 'var(--orange-grad)',
    accent: 'var(--orange)',
    glow: 'var(--orange-glow)',
    shadow: 'var(--shadow-orange)',
    borderToken: 'var(--border-orange)',
    icon: <Zap size={22} {...ICON_STYLE} />,
  },
  {
    label: 'Mi progreso',
    sub: 'Gráficos e historial',
    ruta: '/progreso',
    gradient: 'var(--blue-grad)',
    accent: 'var(--blue)',
    glow: 'var(--blue-glow)',
    shadow: 'var(--shadow-blue)',
    borderToken: 'var(--border-blue)',
    icon: <TrendingUp size={22} {...ICON_STYLE} />,
  },
]

export default function Home() {
  const isDesktop = useDesktop()
  const { usuario, logout } = useUser()
  const { show } = useToast()
  const navigate = useNavigate()
  const [fechas, setFechas] = useState([])
  const [cargandoCal, setCargandoCal] = useState(true)
  const [sesionPendiente, setSesionPendiente] = useState(null)
  const [sugerenciaDia, setSugerenciaDia] = useState(null)
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem(`onboarding_${usuario?.id}`) === '1'
  )
  const mountedRef = useRef(true)
  const iniciarSesion = useIniciarSesion()
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const recargar = useCallback(async () => {
    const cacheKey = `calendario_${usuario.id}`
    let ultimoDiaId = null
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { fechas: ms } = JSON.parse(cached)
        if (mountedRef.current) setFechas(ms)
        if (mountedRef.current) setCargandoCal(false)
      }
      // 1 lectura: el agregado resumenGlobal reemplaza la descarga de sesiones.
      const resumen = await getResumenGlobalConFallback(usuario.id)
      ultimoDiaId = resumen.ultimoDiaId ?? null
      if (mountedRef.current) {
        setFechas(resumen.diasEntrenados)
        localStorage.setItem(cacheKey, JSON.stringify({ fechas: resumen.diasEntrenados }))
        if (!cached) setCargandoCal(false)
      }
    } catch (e) { console.error(e); if (mountedRef.current) setCargandoCal(false) }

    let hayPendiente = false
    try {
      const stored = localStorage.getItem(`sesion_activa_${usuario.id}`)
      if (stored) {
        const snap = await getDoc(doc(db, 'sesiones', stored))
        if (!snap.exists() || snap.data().completada) {
          localStorage.removeItem(`sesion_activa_${usuario.id}`)
        } else {
          hayPendiente = true
          const diaSnap = await getDoc(doc(db, 'dias', snap.data().diaId))
          if (mountedRef.current) setSesionPendiente({ sesionId: stored, diaNombre: diaSnap.data()?.nombre ?? 'Entrenamiento' })
        }
      }
    } catch (e) { console.error(e) }

    // La sesión sin terminar tiene prioridad: mientras exista, no tiene
    // sentido ofrecer un atajo para *empezar* una sesión nueva.
    if (ultimoDiaId && !hayPendiente) {
      try {
        const s = await getProximoDiaSugerido(ultimoDiaId)
        if (mountedRef.current && s) setSugerenciaDia(s)
      } catch (e) { console.error(e) }
    }
  }, [usuario])

  useEffect(() => { setCargandoCal(true); recargar() }, [recargar]) // eslint-disable-line

  // Con un día sugerido y sin sesión pendiente, "Entrenar hoy" salta directo
  // a esa sesión en vez de pasar por /entrenar — de Home a entrenando en 1 tap.
  const secciones = SECCIONES.map(sec => {
    if (sec.ruta === '/entrenar' && sugerenciaDia) {
      return { ...sec, sub: `Seguir: ${sugerenciaDia.dia.nombre}`, onClick: () => iniciarSesion(sugerenciaDia.dia.id) }
    }
    return { ...sec, onClick: () => navigate(sec.ruta) }
  })

  return (
    <motion.div
      className={`home-page ${isDesktop ? 'home-page--desktop' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <PullToRefresh onRefresh={() => { localStorage.removeItem(`calendario_${usuario.id}`); return recargar() }}>
        <motion.div
          className="home-header"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div>
          <p className="home-saludo">{getGreeting(usuario?.nombre)}</p>
          <p className="home-sub">¿Qué hacemos hoy?</p>
        </div>
        <motion.button
          className="home-logout-btn"
          onClick={async () => {
            try {
              await logout()
              navigate('/')
            } catch (e) {
              console.error(e)
              show({ message: 'No se pudo cerrar sesión. Intentá de nuevo.', variant: 'error' })
            }
          }}
          whileTap={{ scale: 0.95 }}
          whileHover={{ borderColor: 'var(--border-strong)' }}
          title="Salir"
        >
          <LogOut size={16} strokeWidth={2} color="var(--text-mute)" />
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
        <div className="home-desktop-grid">
          {/* Left column: section cards */}
          <div className="home-desktop-left">
            <div className="home-secciones">
              {secciones.map((sec, i) => (
                <motion.button
                  key={sec.ruta}
                  className="home-seccion-card"
                  style={{ '--sec-border': sec.borderToken, '--sec-gradient': sec.gradient, '--sec-glow': `radial-gradient(circle at 50% 0%, ${sec.glow}, transparent 70%)` }}
                  onClick={sec.onClick}
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 200, damping: 22 }}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="home-seccion-bg" />
                  <div className="home-seccion-glow" />
                  <div className="home-seccion-noise" />
                  <div className="home-seccion-icon">
                    {sec.icon}
                  </div>
                  <div className="home-seccion-texto">
                    <span className="home-seccion-label">{sec.label}</span>
                    <span className="home-seccion-sub">{sec.sub}</span>
                  </div>
                  <ChevronRight size={18} color="rgba(255,255,255,0.7)" style={{ zIndex: 1, flexShrink: 0 }} />
                </motion.button>
              ))}
            </div>
          </div>

          {/* Right column: session banner + calendar */}
          <div className="home-desktop-right">
            <AnimatePresence>
              {sesionPendiente && (
                <motion.button
                  className="home-banner-sesion"
                  onClick={() => navigate(`/sesion/${sesionPendiente.sesionId}`)}
                  initial={{ opacity: 0, y: -10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.div
                    style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'var(--orange-glow)', opacity: 0 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <div className="home-banner-dot pulse" />
                  <div className="home-banner-texto">
                    <span className="home-banner-label">Entrenamiento en curso</span>
                    <span className="home-banner-dia">{sesionPendiente.diaNombre}</span>
                  </div>
                  <ChevronRight size={16} color="var(--text-mute)" style={{ flexShrink: 0 }} />
                </motion.button>
              )}
            </AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              {cargandoCal ? (
                <div className="home-cal-skeleton skeleton" />
              ) : (
                <Calendario fechas={fechas} />
              )}
            </motion.div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          <AnimatePresence>
            {sesionPendiente && (
              <motion.button
                className="home-banner-sesion"
                onClick={() => navigate(`/sesion/${sesionPendiente.sesionId}`)}
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'var(--orange-glow)', opacity: 0 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <div className="home-banner-dot pulse" />
                <div className="home-banner-texto">
                  <span className="home-banner-label">Entrenamiento en curso</span>
                  <span className="home-banner-dia">{sesionPendiente.diaNombre}</span>
                </div>
                <span className="home-banner-flecha">→</span>
              </motion.button>
            )}
          </AnimatePresence>

          <div className="home-secciones">
            {secciones.map((sec, i) => (
              <motion.button
                key={sec.ruta}
                className="home-seccion-card"
                style={{ '--sec-border': sec.borderToken, '--sec-gradient': sec.gradient, '--sec-glow': `radial-gradient(circle at 50% 0%, ${sec.glow}, transparent 70%)` }}
                onClick={sec.onClick}
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 200, damping: 22 }}
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                <div className="home-seccion-bg" />
                <div className="home-seccion-glow" />
                <div className="home-seccion-icon">{sec.icon}</div>
                <div className="home-seccion-texto">
                  <span className="home-seccion-label">{sec.label}</span>
                  <span className="home-seccion-sub">{sec.sub}</span>
                </div>
                <span className="home-seccion-flecha">→</span>
              </motion.button>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
          >
            {cargandoCal ? (
              <div className="home-cal-skeleton skeleton" />
            ) : (
              <Calendario fechas={fechas} />
            )}
          </motion.div>
        </div>
      )}
      </PullToRefresh>
      <Credit />
    </motion.div>
  )
}
