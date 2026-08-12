import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getEjerciciosDia } from '../firebase/ejerciciosDia'
import { agregarRegistro, editarRegistro, getRegistrosSesion } from '../firebase/registros'
import { eliminarSesion, esMismoEjercicio } from '../firebase/sesiones'
import { getStatsEjerciciosConFallback } from '../firebase/statsEjercicios'
import { ConfirmDialog, EmptyState } from '../components/ui'
import { useUser } from '../context/UserContext'
import { logEvento } from '../firebase/analytics'
import { useDesktop } from '../hooks/useDesktop'
import { useToast } from '../components/Toast'
import Confetti from './sesion-activa/Confetti'
import ListaEjerciciosDesktop from './sesion-activa/ListaEjerciciosDesktop'
import EjercicioInfo from './sesion-activa/EjercicioInfo'
import SerieForm from './sesion-activa/SerieForm'
import SerieFooter from './sesion-activa/SerieFooter'

const BTN_TAP = { scale: 0.96 }
const BTN_TAP_FIRM = { scale: 0.94 }

export default function SesionActiva() {
  const isDesktop = useDesktop()
  const { sesionId } = useParams()
  const navigate = useNavigate()
  const { usuario } = useUser()
  const { show } = useToast()

  const [ejercicios, setEjercicios] = useState([])
  const [ejIdx, setEjIdx] = useState(0)
  const [serieIdx, setSerieIdx] = useState(0)
  const [repsHechas, setRepsHechas] = useState('')
  const [pesoUsado, setPesoUsado] = useState('')
  const [nota, setNota] = useState('')
  const [ultimoPeso, setUltimoPeso] = useState({})
  const [historial, setHistorial] = useState([])
  const [pendingEdits, setPendingEdits] = useState({})
  const [refAnterior, setRefAnterior] = useState(undefined) // undefined=loading, null=sin datos
  const [refCache, setRefCache] = useState({})
  const [refPR, setRefPR] = useState(undefined)
  const [prCache, setPRCache] = useState({})
  const [tabRef, setTabRef] = useState('ultima') // 'ultima' | 'pr'
  const [statsCache, setStatsCache] = useState(null) // null = loading
  const [guardando, setGuardando] = useState(false)
  const [mostrarNota, setMostrarNota] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [celebrar, setCelebrar] = useState(false)
  const [confirmData, setConfirmData] = useState(null)
  const ultimoPesoRef = useRef(ultimoPeso)
  const celebrarTimeoutRef = useRef(null)

  useEffect(() => { ultimoPesoRef.current = ultimoPeso }, [ultimoPeso])
  useEffect(() => () => clearTimeout(celebrarTimeoutRef.current), [])

  // Preload all sessions once — replaces per-exercise Firestore queries
  useEffect(() => {
    if (!usuario) return
    getStatsEjerciciosConFallback(usuario.id).then(setStatsCache).catch(e => { console.error(e); show({ variant: 'error', message: 'No se pudieron cargar las referencias.' }) })
  }, [usuario, show])

  const cargar = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'sesiones', sesionId))
      if (!snap.exists()) throw new Error(`Sesión ${sesionId} inexistente`)
      const sesionData = snap.data()
      const [ejs, registrosExistentes] = await Promise.all([
        getEjerciciosDia(sesionData.diaId),
        getRegistrosSesion(sesionId),
      ])
      setEjercicios(ejs)

    // Group registros by ejercicioId, sorted by numeroSerie
    const porEjercicio = {}
    registrosExistentes.forEach(r => {
      if (!porEjercicio[r.ejercicioId]) porEjercicio[r.ejercicioId] = []
      porEjercicio[r.ejercicioId].push(r)
    })
    Object.values(porEjercicio).forEach(arr => arr.sort((a, b) => a.numeroSerie - b.numeroSerie))

    // Find resume position and rebuild historial + ultimoPeso
    let restoredEjIdx = 0
    let restoredSerieIdx = 0
    const historialRestaurado = []
    const ultimoPesoRestaurado = {}

    for (let i = 0; i < ejs.length; i++) {
      const ej = ejs[i]
      const series = porEjercicio[ej.id] ?? []
      for (const reg of series) {
        historialRestaurado.push({
          ejIdx: i, serieIdx: reg.numeroSerie - 1,
          registroId: reg.id,
          repsHechas: String(reg.repsHechas),
          pesoUsado: reg.pesoUsado > 0 ? String(reg.pesoUsado) : '',
          nota: reg.nota || '',
        })
        ultimoPesoRestaurado[ej.id] = reg.pesoUsado > 0 ? String(reg.pesoUsado) : ''
      }
      if (series.length >= ej.seriesEsperadas) {
        restoredEjIdx = i + 1
        restoredSerieIdx = 0
      } else {
        restoredEjIdx = i
        restoredSerieIdx = series.length
        break
      }
    }

    if (restoredEjIdx >= ejs.length) {
      navigate(`/sesion/${sesionId}/resumen`)
      return
    }

    if (historialRestaurado.length > 0) {
      setHistorial(historialRestaurado)
      setUltimoPeso(ultimoPesoRestaurado)
    }
    setEjIdx(restoredEjIdx)
    setSerieIdx(restoredSerieIdx)
    setRepsHechas(String(ejs[restoredEjIdx].repsEsperadas))
    setPesoUsado(ultimoPesoRestaurado[ejs[restoredEjIdx].id] ?? '')
    } catch (e) { console.error(e); show({ variant: 'error', message: 'No se pudo cargar la sesion.' }) }
    setCargando(false)
  }, [sesionId, navigate, show])

  useEffect(() => {
    if (usuario?.id) localStorage.setItem(`sesion_activa_${usuario.id}`, sesionId)
    logEvento('sesion_iniciada')
    cargar()
  }, [cargar, sesionId, usuario?.id])

  useEffect(() => {
    const ejercicio = ejercicios[ejIdx]
    if (!ejercicio || !usuario || statsCache === null) return
    const stats = statsCache.find(st => esMismoEjercicio(st, ejercicio))
    if (refCache[ejercicio.id] !== undefined) {
      setRefAnterior(refCache[ejercicio.id]) // eslint-disable-line
    } else {
      // Ignorar referencias de la sesión en curso (no debería estar en stats).
      const data = (stats?.ultimaVez && stats.ultimaVez.sesionId !== sesionId) ? stats.ultimaVez : null
      setRefCache(c => ({ ...c, [ejercicio.id]: data }))
      setRefAnterior(data)
    }
    if (prCache[ejercicio.id] !== undefined) {
      setRefPR(prCache[ejercicio.id])
    } else {
      const prData = (stats?.pr && stats.pr.sesionId !== sesionId) ? stats.pr : null
      setPRCache(c => ({ ...c, [ejercicio.id]: prData }))
      setRefPR(prData)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejIdx, ejercicios, sesionId, usuario, statsCache])

  const ejercicio = ejercicios[ejIdx]
  const totalSeries = ejercicio?.seriesEsperadas ?? 0
  const serieActual = serieIdx + 1
  const esUltimaSerie = serieActual >= totalSeries
  const esUltimoEjercicio = ejIdx >= ejercicios.length - 1

  // Progreso total = (ejercicios completos + porcentaje del actual)
  const { seriesTotales, seriesCompletadas, progresoPct } = useMemo(() => {
    const total = ejercicios.reduce((acc, e) => acc + e.seriesEsperadas, 0)
    const completadas = ejercicios.slice(0, ejIdx).reduce((acc, e) => acc + e.seriesEsperadas, 0) + serieIdx
    return {
      seriesTotales: total,
      seriesCompletadas: completadas,
      progresoPct: total > 0 ? (completadas / total) * 100 : 0,
    }
  }, [ejercicios, ejIdx, serieIdx])

  function avanzar() {
    const ultimoPesoActual = ultimoPesoRef.current
    if (!esUltimaSerie) {
      setSerieIdx(s => s + 1)
      setRepsHechas(String(ejercicio.repsEsperadas))
      setPesoUsado(ultimoPesoActual[ejercicio.id] ?? '')
      setNota('')
      setMostrarNota(false)
    } else if (!esUltimoEjercicio) {
      const siguiente = ejercicios[ejIdx + 1]
      setEjIdx(i => i + 1)
      setSerieIdx(0)
      setRepsHechas(String(siguiente.repsEsperadas))
      setPesoUsado(ultimoPesoActual[siguiente.id] ?? '')
      setNota('')
      setMostrarNota(false)
    } else {
      if (usuario?.id) localStorage.removeItem(`sesion_activa_${usuario.id}`)
      navigate(`/sesion/${sesionId}/resumen`)
    }
  }

  async function completarSerie() {
    if (!repsHechas) return
    setGuardando(true)
    const pendingKey = `${ejIdx}_${serieIdx}`
    const pendingId = pendingEdits[pendingKey]
    let registroId
    try {
      if (pendingId) {
        await editarRegistro(pendingId, {
          pesoUsado: Number(pesoUsado) || 0,
          repsHechas: Number(repsHechas),
          nota,
        })
        registroId = pendingId
        setPendingEdits(pe => { const next = { ...pe }; delete next[pendingKey]; return next })
      } else {
        registroId = await agregarRegistro({
          sesionId,
          ejercicioId: ejercicio.id,
          nombreEjercicio: ejercicio.nombre,
          grupoMuscular: ejercicio.grupoMuscular,
          catalogoId: ejercicio.catalogoId ?? null,
          numeroSerie: serieActual,
          repsEsperadas: ejercicio.repsEsperadas,
          repsHechas: Number(repsHechas),
          pesoUsado: Number(pesoUsado) || 0,
          nota,
        })
      }
    } catch (e) { console.error(e); setGuardando(false); show({ variant: 'error', message: 'No se pudo guardar. Intentá de nuevo.' }); return }
    setHistorial(h => [...h, { ejIdx, serieIdx, registroId, repsHechas, pesoUsado, nota }])
    setUltimoPeso(prev => ({ ...prev, [ejercicio.id]: pesoUsado }))
    logEvento('serie_completada', {
      ejercicio: ejercicio.nombre,
      grupo_muscular: ejercicio.grupoMuscular,
      numero_serie: serieActual,
      peso: Number(pesoUsado) || 0,
      reps: Number(repsHechas),
    })
    setGuardando(false)
    setCelebrar(true)
    clearTimeout(celebrarTimeoutRef.current)
    celebrarTimeoutRef.current = setTimeout(() => setCelebrar(false), 600)
    if (esUltimaSerie && esUltimoEjercicio) {
      show({ message: '¡Entrenamiento completado!', variant: 'success' })
    }

    avanzar()
  }

  function retroceder() {
    if (historial.length === 0) return
    const prev = historial[historial.length - 1]
    setHistorial(h => h.slice(0, -1))
    setPendingEdits(pe => ({ ...pe, [`${prev.ejIdx}_${prev.serieIdx}`]: prev.registroId }))
    setEjIdx(prev.ejIdx)
    setSerieIdx(prev.serieIdx)
    setRepsHechas(prev.repsHechas)
    setPesoUsado(prev.pesoUsado)
    setNota(prev.nota)
    setMostrarNota(!!prev.nota)
  }

  function cancelarSesion() {
    setConfirmData({
      titulo: '¿Cancelar entrenamiento?',
      descripcion: 'Se borrarán todos los registros de esta sesión. Esta acción no se puede deshacer.',
      icon: '🗑️',
      confirmLabel: 'Cancelar sesión',
      danger: true,
      onConfirm: async () => {
        try {
          await eliminarSesion(sesionId)
        } catch (e) {
          console.error(e)
          show({ variant: 'error', message: 'No se pudo cancelar la sesion.' })
          return
        }
        if (usuario?.id) localStorage.removeItem(`sesion_activa_${usuario.id}`)
        if (usuario?.id) localStorage.removeItem(`calendario_${usuario.id}`)
        show({ message: 'Sesion cancelada.', variant: 'success' })
        navigate('/home')
      },
    })
  }

  function terminarAntes() {
    setConfirmData({
      titulo: '¿Terminar entrenamiento?',
      descripcion: 'Vas a saltarte los ejercicios restantes. Se guardará lo que ya hiciste.',
      icon: '⏹️',
      confirmLabel: 'Terminar',
      danger: false,
      onConfirm: () => {
        if (usuario?.id) localStorage.removeItem(`sesion_activa_${usuario.id}`)
        navigate(`/sesion/${sesionId}/resumen`)
      },
    })
  }

  if (cargando) return (
    <div style={s.page}>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: '0%' }} /></div>
      <div style={{ ...s.body, justifyContent: 'center' }}>
        <span className="spinner" style={{ color: 'var(--orange)' }} />
      </div>
    </div>
  )

  if (ejercicios.length === 0) return (
    <div style={s.page}>
      <div style={s.body}>
        <EmptyState mensaje="Este día no tiene ejercicios" icon="🏋️" sub="Agregá ejercicios desde la app web" />
      </div>
    </div>
  )

  const serieFormProps = {
    ejercicio, pesoUsado, setPesoUsado, repsHechas, setRepsHechas, ultimoPeso,
    mostrarNota, setMostrarNota, nota, setNota,
    ejIdx, serieIdx, tabRef, refPR, refAnterior, serieActual,
  }

  const footerProps = {
    onCompletar: completarSerie, repsHechas, guardando, celebrar,
    esUltimaSerie, esUltimoEjercicio, serieActual,
    hayHistorial: historial.length > 0, onVolver: retroceder,
  }

  return (
    <motion.div
      style={isDesktop ? s.pageDesktop : s.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div style={isDesktop ? s.headerDesktop : s.header}>
        <div style={s.progressBar}>
          <motion.div
            style={s.progressFill}
            animate={{ width: `${progresoPct}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 28 }}
          />
        </div>
        <div style={s.headerRow}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={s.ejercicioCounter}>
              Ejercicio <strong style={{ color: 'var(--text)' }}>{ejIdx + 1}</strong> / {ejercicios.length}
              <span style={{ color: 'var(--text-mute)', fontWeight: 400 }}> · </span>
              <span className="num" style={{ color: 'var(--orange)', fontWeight: 700 }}>{seriesCompletadas}</span>
              <span style={{ color: 'var(--text-mute)', fontWeight: 400 }}>/{seriesTotales} series</span>
            </span>
            <motion.button style={s.cancelarBtn} onClick={cancelarSesion} whileTap={BTN_TAP}>
              Cancelar sesión
            </motion.button>
          </div>
          <motion.button style={s.terminarBtn} onClick={terminarAntes} whileTap={BTN_TAP_FIRM}>
            Terminar
          </motion.button>
        </div>
      </div>

      {isDesktop ? (
        <div style={s.desktopCols}>
          <div style={s.desktopLeft}>
            <ListaEjerciciosDesktop ejercicios={ejercicios} ejIdx={ejIdx} historial={historial} />
          </div>
          <div style={s.desktopRight}>
            <EjercicioInfo
              ejIdx={ejIdx} serieIdx={serieIdx} ejercicio={ejercicio}
              serieActual={serieActual} totalSeries={totalSeries}
              tabRef={tabRef} setTabRef={setTabRef} refAnterior={refAnterior} refPR={refPR}
            />
            <SerieForm {...serieFormProps} />
            <SerieFooter {...footerProps} footerStyle={s.footerDesktop} />
          </div>
        </div>
      ) : (
        <>
          <div style={s.body}>
            <EjercicioInfo
              ejIdx={ejIdx} serieIdx={serieIdx} ejercicio={ejercicio}
              serieActual={serieActual} totalSeries={totalSeries}
              tabRef={tabRef} setTabRef={setTabRef} refAnterior={refAnterior} refPR={refPR}
            />
            <SerieForm {...serieFormProps} />
          </div>
          <SerieFooter {...footerProps} footerStyle={s.footer} />
        </>
      )}

      <ConfirmDialog open={!!confirmData} data={confirmData} onClose={() => setConfirmData(null)} />

      <AnimatePresence>{celebrar && <Confetti />}</AnimatePresence>
    </motion.div>
  )
}

const s = {
  page: { minHeight: '100dvh', color: 'var(--text)', display: 'flex', flexDirection: 'column', position: 'relative' },
  header: { flexShrink: 0, paddingTop: 'env(safe-area-inset-top)' },
  progressBar: { height: '4px', background: 'var(--bg-elev)', overflow: 'hidden' },
  progressFill: {
    height: '100%',
    background: 'var(--orange-grad)',
    boxShadow: '0 0 12px rgba(240, 153, 123, 0.6)',
  },
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px',
  },
  ejercicioCounter: { fontSize: '0.85rem', color: 'var(--text-mute)' },
  terminarBtn: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    padding: '10px 18px',
    borderRadius: '20px',
    fontSize: '0.88rem',
  },
  cancelarBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--danger)',
    fontSize: '0.72rem',
    padding: 0,
    opacity: 0.7,
    textAlign: 'left',
  },
  body: {
    flex: 1, display: 'flex', flexDirection: 'column',
    padding: '8px 16px 0', gap: '12px',
  },
  footer: {
    padding: '16px',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  pageDesktop: {
    minHeight: '100dvh', color: 'var(--text)',
    display: 'flex', flexDirection: 'column', position: 'relative',
  },
  headerDesktop: {
    flexShrink: 0,
    borderBottom: '1px solid var(--border)',
  },
  desktopCols: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    flex: 1,
    minHeight: 0,
  },
  desktopLeft: {
    borderRight: '1px solid var(--border)',
    overflowY: 'auto',
  },
  desktopRight: {
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 32px',
    gap: '20px',
    overflowY: 'auto',
  },
  footerDesktop: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingTop: '8px',
  },
}
