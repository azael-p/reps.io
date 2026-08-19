import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useUser } from '../context/UserContext'
import { getProgramas } from '../firebase/programas'
import { getDias, getProximoDiaSugerido } from '../firebase/dias'
import { eliminarSesion } from '../firebase/sesiones'
import { getResumenGlobalConFallback } from '../firebase/statsGlobal'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { Header, EmptyState, ListSkeleton, PageWrapper, Modal } from '../components/ui'
import { useDesktop } from '../hooks/useDesktop'
import { useToast } from '../components/Toast'
import { useIniciarSesion } from '../hooks/useIniciarSesion'

// Footer de "Empezar" (~90px) + BottomNav (64px) + aire: sin esto el último día
// de la lista queda debajo de las dos capas fijas.
const PADDING_INFERIOR_MOBILE = '190px'

export default function Entrenar() {
  const isDesktop = useDesktop()
  const { usuario } = useUser()
  const { show } = useToast()
  const navigate = useNavigate()
  const iniciarSesion = useIniciarSesion()
  const [programas, setProgramas] = useState([])
  const [dias, setDias] = useState([])
  const [programaId, setProgramaId] = useState(null)
  const [diaId, setDiaId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [conflicto, setConflicto] = useState(null)
  const [descartando, setDescartando] = useState(false)
  const [sugerencia, setSugerencia] = useState(null)

  useEffect(() => {
    if (!usuario?.id) return
    getProgramas(usuario.id).then(p => {
      setProgramas(p)
      setCargando(false)
      // Con un solo programa, elegirlo no decide nada: nos ahorramos el tap.
      if (p.length === 1) {
        const id = p[0].id
        setProgramaId(id)
        getDias(id).then(setDias).catch(e => { console.error(e); setErrorMsg('Error al cargar los días') })
      }
    }).catch(e => { console.error(e); setErrorMsg('Error al cargar programas'); setCargando(false) })
  }, [usuario?.id])

  useEffect(() => {
    if (!usuario?.id) return
    getResumenGlobalConFallback(usuario.id)
      .then(({ ultimoDiaId }) => ultimoDiaId ? getProximoDiaSugerido(ultimoDiaId) : null)
      .then(s => { if (s) setSugerencia(s) })
      .catch(e => console.error(e))
  }, [usuario?.id])

  async function seleccionarPrograma(id) {
    setProgramaId(id)
    setDiaId(null)
    setErrorMsg('')
    try { setDias(await getDias(id)) } catch (e) { console.error(e); setErrorMsg('Error al cargar los días') }
  }

  function crearYNavegar() {
    try {
      iniciarSesion(diaId)
    } catch (e) { console.error(e); setErrorMsg('Error al crear la sesión'); setIniciando(false) }
  }

  async function aceptarSugerencia() {
    await seleccionarPrograma(sugerencia.programaId)
    setDiaId(sugerencia.dia.id)
  }

  async function empezar() {
    if (!diaId) return
    setIniciando(true)

    const stored = localStorage.getItem(`sesion_activa_${usuario.id}`)
    if (stored) {
      try {
        const snap = await getDoc(doc(db, 'sesiones', stored))
        if (snap.exists() && !snap.data().completada) {
          if (snap.data().diaId === diaId) {
            navigate(`/sesion/${stored}`)
            return
          }
          // Sesión pendiente de OTRO día: preguntar antes de pisarla y
          // dejar sus registros huérfanos (ver useEliminarConUndo para el
          // mismo patrón de "avisar antes de perder algo sin terminar").
          const diaSnap = await getDoc(doc(db, 'dias', snap.data().diaId))
          setConflicto({ sesionId: stored, diaNombre: diaSnap.data()?.nombre ?? 'Entrenamiento' })
          setIniciando(false)
          return
        }
      } catch (e) { console.error('No se pudo verificar la sesión previa:', e) /* si falla, creamos nueva sesión */ }
    }

    await crearYNavegar()
  }

  function continuarSesionPendiente() {
    navigate(`/sesion/${conflicto.sesionId}`)
  }

  async function descartarYEmpezar() {
    setDescartando(true)
    try {
      await eliminarSesion(conflicto.sesionId)
    } catch (e) {
      console.error(e)
      show({ message: 'No se pudo descartar la sesión anterior. Intentá de nuevo.', variant: 'error' })
      setDescartando(false)
      return
    }
    setConflicto(null)
    setDescartando(false)
    await crearYNavegar()
  }

  const programasList = (
    <div className="entrenar-seccion">
      <p className="entrenar-label">1. Elegí un programa</p>
      <div className="entrenar-lista">
        {programas.length === 0 ? (
          <EmptyState mensaje="Necesitás un programa primero" icon="📋" sub="Andá a Programas para crear tu primera rutina y empezar a entrenar" action={{ label: 'Crear programa', onClick: () => navigate('/programas') }} />
        ) : (
          programas.map((p, i) => {
            const activo = programaId === p.id
            return (
              <motion.button
                key={p.id}
                className={`entrenar-opcion-btn ${activo ? 'entrenar-opcion-activa' : ''}`}
                onClick={() => seleccionarPrograma(p.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.05, type: 'spring', stiffness: 240, damping: 22 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="entrenar-opcion-nombre">{p.nombre}</span>
                {activo && (
                  <motion.span
                    className="entrenar-check"
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

  const diasList = dias.length > 0 ? (
    <div className="entrenar-seccion">
      <p className="entrenar-label">2. Elegí el día</p>
      <div className="entrenar-lista">
        {dias.map((d, i) => {
          const activo = diaId === d.id
          return (
            <motion.button
              key={d.id}
              className={`entrenar-opcion-btn ${activo ? 'entrenar-opcion-activa' : ''}`}
              onClick={() => setDiaId(d.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04, type: 'spring', stiffness: 240, damping: 22 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="entrenar-opcion-text-wrap">
                <span className="entrenar-dia-num">Día {i + 1}</span>
                <span className="entrenar-opcion-nombre">{d.nombre}</span>
              </div>
              {activo && (
                <motion.span
                  className="entrenar-check"
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
  ) : programaId ? (
    <EmptyState mensaje="Este programa no tiene días" icon="📅" sub="Agregá días al programa antes de entrenar" action={{ label: 'Agregar día', onClick: () => navigate(`/programas/${programaId}`) }} />
  ) : null

  const sugerenciaBanner = !cargando && sugerencia && !diaId ? (
    <div className="entrenar-seccion" style={{ paddingBottom: 0 }}>
      <motion.button
        className="entrenar-sugerencia-btn"
        onClick={aceptarSugerencia}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.97 }}
      >
        <span className="entrenar-sugerencia-label">Seguir: Día {sugerencia.numero}</span>
        <span className="entrenar-sugerencia-nombre">{sugerencia.dia.nombre}</span>
      </motion.button>
    </div>
  ) : null

  const empezarBtn = (
    <motion.button
      className="btn btn-primary btn-lg entrenar-empezar-btn"
      style={{ opacity: iniciando ? 0.7 : 1 }}
      onClick={empezar}
      disabled={iniciando}
      whileTap={{ scale: 0.97 }}
    >
      {iniciando ? <span className="spinner" /> : (
        <>
          <span>Empezar entrenamiento</span>
          <span className="entrenar-fire">🔥</span>
        </>
      )}
    </motion.button>
  )

  return (
    <PageWrapper style={isDesktop ? {} : { paddingBottom: PADDING_INFERIOR_MOBILE }}>
      <Header
        titulo="Entrenar hoy"
        subtitulo="Iniciar sesión"
        accent="var(--orange)"
        onBack={() => navigate('/home')}
      />

      {sugerenciaBanner}

      {cargando ? (
        <div style={{ padding: '14px 14px 0' }}>
          <ListSkeleton count={3} height={60} />
        </div>
      ) : isDesktop ? (
        <div className="entrenar-desktop-layout">
          <div className="entrenar-desktop-col">
            {programasList}
          </div>
          <div className="entrenar-desktop-col">
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
              className="entrenar-footer"
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

      <Modal open={!!conflicto} onClose={() => setConflicto(null)}>
        <h2 className="entrenar-modal-titulo">Sesión sin terminar</h2>
        <p className="entrenar-modal-texto">
          Tenés un entrenamiento de <strong>{conflicto?.diaNombre}</strong> sin
          terminar. Si empezás uno nuevo vas a perder las series que ya
          cargaste ahí.
        </p>
        <div className="entrenar-modal-acciones">
          <motion.button className="entrenar-modal-cancelar-btn" onClick={() => setConflicto(null)} whileTap={{ scale: 0.97 }}>
            Volver
          </motion.button>
          <motion.button className="entrenar-modal-continuar-btn" onClick={continuarSesionPendiente} whileTap={{ scale: 0.97 }}>
            Continuar
          </motion.button>
        </div>
        <motion.button
          className="entrenar-modal-descartar-btn"
          style={{ opacity: descartando ? 0.7 : 1 }}
          onClick={descartarYEmpezar}
          disabled={descartando}
          whileTap={{ scale: 0.97 }}
        >
          {descartando ? <span className="spinner" /> : 'Descartar y empezar de nuevo'}
        </motion.button>
      </Modal>
    </PageWrapper>
  )
}
