import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useUser } from '../context/UserContext'
import { getProgramas } from '../firebase/programas'
import { getDias } from '../firebase/dias'
import { crearSesion } from '../firebase/sesiones'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { Header, EmptyState, ListSkeleton, PageWrapper } from '../components/ui'
import { useDesktop } from '../hooks/useDesktop'

export default function Entrenar() {
  const isDesktop = useDesktop()
  const { usuario } = useUser()
  const navigate = useNavigate()
  const [programas, setProgramas] = useState([])
  const [dias, setDias] = useState([])
  const [programaId, setProgramaId] = useState(null)
  const [diaId, setDiaId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    getProgramas(usuario.id).then(p => { setProgramas(p); setCargando(false) }).catch(e => { console.error(e); setErrorMsg('Error al cargar programas'); setCargando(false) })
  }, [usuario?.id])

  async function seleccionarPrograma(id) {
    setProgramaId(id)
    setDiaId(null)
    setErrorMsg('')
    try { setDias(await getDias(id)) } catch (e) { console.error(e); setErrorMsg('Error al cargar los días') }
  }

  async function empezar() {
    if (!diaId) return
    setIniciando(true)

    const stored = localStorage.getItem(`sesion_activa_${usuario.id}`)
    if (stored) {
      try {
        const snap = await getDoc(doc(db, 'sesiones', stored))
        if (snap.exists() && !snap.data().completada && snap.data().diaId === diaId) {
          navigate(`/sesion/${stored}`)
          return
        }
      } catch { /* si falla, creamos nueva sesión */ }
    }

    try {
      const sesionId = await crearSesion(usuario.id, diaId)
      localStorage.setItem(`sesion_activa_${usuario.id}`, sesionId)
      navigate(`/sesion/${sesionId}`)
    } catch (e) { console.error(e); setErrorMsg('Error al crear la sesión'); setIniciando(false) }
  }

  const programasList = (
    <div style={s.seccion}>
      <p style={s.label}>1. Elegí un programa</p>
      <div style={s.lista}>
        {programas.length === 0 ? (
          <EmptyState mensaje="No tenés programas creados todavía" icon="📋" sub="Andá a Programas para crear tu primera rutina" action={{ label: 'Ir a Programas', onClick: () => navigate('/programas') }} />
        ) : (
          programas.map((p, i) => {
            const activo = programaId === p.id
            return (
              <motion.button
                key={p.id}
                style={{ ...s.opcionBtn, ...(activo ? s.opcionActiva : {}) }}
                onClick={() => seleccionarPrograma(p.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 240, damping: 22 }}
                whileTap={{ scale: 0.97 }}
              >
                <span style={s.opcionNombre}>{p.nombre}</span>
                {activo && (
                  <motion.span
                    style={s.check}
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                  >
                    ✓
                  </motion.span>
                )}
              </motion.button>
            )
          })
        )}
      </div>
    </div>
  )

  const diasList = dias.length > 0 && (
    <div style={s.seccion}>
      <p style={s.label}>2. Elegí el día</p>
      <div style={s.lista}>
        {dias.map((d, i) => {
          const activo = diaId === d.id
          return (
            <motion.button
              key={d.id}
              style={{ ...s.opcionBtn, ...(activo ? s.opcionActiva : {}) }}
              onClick={() => setDiaId(d.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 240, damping: 22 }}
              whileTap={{ scale: 0.97 }}
            >
              <div style={s.opcionTextWrap}>
                <span style={s.diaNum}>Día {i + 1}</span>
                <span style={s.opcionNombre}>{d.nombre}</span>
              </div>
              {activo && (
                <motion.span
                  style={s.check}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                >
                  ✓
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )

  const empezarBtn = (
    <motion.button
      style={{ ...s.empezarBtn, opacity: iniciando ? 0.7 : 1 }}
      onClick={empezar}
      disabled={iniciando}
      whileTap={{ scale: 0.97 }}
    >
      {iniciando ? <span className="spinner" /> : (
        <>
          <span>Empezar entrenamiento</span>
          <span style={s.fire}>🔥</span>
        </>
      )}
    </motion.button>
  )

  return (
    <PageWrapper style={isDesktop ? {} : { paddingBottom: '120px' }}>
      <Header
        titulo="Entrenar hoy"
        subtitulo="Iniciar sesión"
        accent="var(--orange)"
        onBack={() => navigate('/home')}
      />

      {cargando ? (
        <div style={{ padding: '14px 14px 0' }}>
          <ListSkeleton count={3} height={60} />
        </div>
      ) : isDesktop ? (
        <div style={s.desktopLayout}>
          <div style={s.desktopCol}>
            {programasList}
          </div>
          <div style={s.desktopCol}>
            <AnimatePresence>
              {diasList && (
                <motion.div
                  key="dias"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  {diasList}
                </motion.div>
              )}
            </AnimatePresence>
            {diaId && (
              <div style={{ padding: '20px 16px 0' }}>
                {empezarBtn}
              </div>
            )}
          </div>
          {errorMsg && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', padding: '8px 16px 0', margin: 0, gridColumn: '1 / -1' }}>{errorMsg}</p>}
        </div>
      ) : (
        <>
          {programasList}
          <AnimatePresence>
            {diasList && (
              <motion.div
                key="dias"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                {diasList}
              </motion.div>
            )}
          </AnimatePresence>
          {errorMsg && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', padding: '8px 16px 0', margin: 0 }}>{errorMsg}</p>}
        </>
      )}

      {!isDesktop && (
        <AnimatePresence>
          {diaId && (
            <motion.div
              style={s.footer}
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            >
              {empezarBtn}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </PageWrapper>
  )
}

const s = {
  seccion: { padding: '20px 16px 0' },
  label: {
    margin: '0 0 12px', color: 'var(--text-mute)',
    fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em',
    fontWeight: 700,
  },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  opcionBtn: {
    padding: '14px 16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text)',
    fontSize: '0.98rem',
    textAlign: 'left',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '12px',
    boxShadow: 'var(--shadow-sm)',
  },
  opcionActiva: {
    background: 'var(--orange-grad)',
    border: '1px solid rgba(240, 153, 123, 0.45)',
    boxShadow: '0 10px 28px rgba(199, 90, 48, 0.35)',
    color: '#fff',
  },
  opcionTextWrap: { display: 'flex', flexDirection: 'column', gap: '2px' },
  diaNum: { fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  opcionNombre: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  check: {
    width: '26px', height: '26px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.22)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.95rem', fontWeight: 800, color: '#fff',
    flexShrink: 0,
  },
  footer: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    padding: '14px 16px',
    paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
    background: 'linear-gradient(180deg, transparent, var(--bg) 30%)',
    zIndex: 51,
  },
  empezarBtn: {
    width: '100%', padding: '18px',
    background: 'var(--orange-grad)',
    color: '#fff', border: 'none',
    borderRadius: 'var(--r-lg)',
    fontSize: '1.05rem', fontWeight: 700,
    boxShadow: '0 14px 32px rgba(199, 90, 48, 0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
    letterSpacing: '-0.01em',
  },
  fire: { fontSize: '1.2rem' },
  desktopLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0',
    alignItems: 'start',
  },
  desktopCol: {
    borderRight: '1px solid var(--border)',
  },
}
