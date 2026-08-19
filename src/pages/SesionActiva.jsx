import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getEjerciciosDia } from '../firebase/ejerciciosDia'
import { agregarRegistro, editarRegistro, getRegistrosSesion } from '../firebase/registros'
import { eliminarSesion, esMismoEjercicio } from '../firebase/sesiones'
import { getStatsEjerciciosConFallback } from '../firebase/statsEjercicios'
import { ConfirmDialog, EmptyState, ErrorState, Modal } from '../components/ui'
import { useUser } from '../context/UserContext'
import { logEvento } from '../firebase/analytics'
import { useDesktop } from '../hooks/useDesktop'
import { useToast } from '../components/Toast'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { useLongPress } from '../hooks/useLongPress'
import { parsePeso, sanitizarPeso } from '../utils/stats'
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
  const syncStatus = useSyncStatus(sesionId)
  const syncLabel = syncStatus.estado === 'offline' ? 'Sin conexión'
    : syncStatus.estado === 'pendiente' ? `${syncStatus.pendientes} serie${syncStatus.pendientes === 1 ? '' : 's'} sin sincronizar`
    : 'En línea'

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
  const [errorCarga, setErrorCarga] = useState(false)
  const [celebrar, setCelebrar] = useState(false)
  const [confirmData, setConfirmData] = useState(null)
  const [editandoSerie, setEditandoSerie] = useState(null)
  const [editSeriePeso, setEditSeriePeso] = useState('')
  const [editSerieReps, setEditSerieReps] = useState('')
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
    setErrorCarga(false)
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

    // Un día sin ejercicios cae al EmptyState y la sesión queda SIN completar.
    // Antes entraba en la guarda de abajo (el for no corre, restoredEjIdx
    // queda en 0, y 0 >= 0 mandaba al resumen), que la completaba vacía y la
    // dejaba en el historial, en el calendario y en la racha sin una sola
    // serie hecha.
    if (ejs.length === 0) { setCargando(false); return }

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
    } catch (e) { console.error(e); setErrorCarga(true); show({ variant: 'error', message: 'No se pudo cargar la sesion.' }) }
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

  function completarSerie() {
    if (!repsHechas) return
    setGuardando(true)
    const pendingKey = `${ejIdx}_${serieIdx}`
    const pendingId = pendingEdits[pendingKey]
    let registroId
    // No se espera el ACK del servidor: con persistentLocalCache la
    // escritura ya se aplicó al cache local al llamarla. `guardando` acá
    // funciona como guard anti-doble-tap durante la actualización de
    // estado local (se resuelve en el mismo tick), no como espera de red.
    const onFalloSync = e => { console.error(e); show({ variant: 'warning', message: 'Se sincronizará cuando haya conexión.' }) }
    try {
      if (pendingId) {
        editarRegistro(pendingId, {
          pesoUsado: parsePeso(pesoUsado) || 0,
          repsHechas: Number(repsHechas),
          nota,
        }).catch(onFalloSync)
        registroId = pendingId
        setPendingEdits(pe => { const next = { ...pe }; delete next[pendingKey]; return next })
      } else {
        const { id, listo } = agregarRegistro({
          sesionId,
          ejercicioId: ejercicio.id,
          nombreEjercicio: ejercicio.nombre,
          grupoMuscular: ejercicio.grupoMuscular,
          catalogoId: ejercicio.catalogoId ?? null,
          numeroSerie: serieActual,
          repsEsperadas: ejercicio.repsEsperadas,
          repsHechas: Number(repsHechas),
          pesoUsado: parsePeso(pesoUsado) || 0,
          nota,
        })
        registroId = id
        listo.catch(onFalloSync)
      }
    } catch (e) { console.error(e); setGuardando(false); show({ variant: 'error', message: 'No se pudo guardar. Intentá de nuevo.' }); return }
    setHistorial(h => [...h, { ejIdx, serieIdx, registroId, repsHechas, pesoUsado, nota }])
    // El efecto que sincroniza ultimoPesoRef corre después del commit, pero
    // avanzar() se llama sincrónicamente más abajo y lo lee para prefillear la
    // serie siguiente: sin actualizar el ref acá, esa serie arranca con el
    // campo de peso vacío y completarla sin reescribirlo guarda 0 kg.
    const ultimoPesoActualizado = { ...ultimoPesoRef.current, [ejercicio.id]: pesoUsado }
    ultimoPesoRef.current = ultimoPesoActualizado
    setUltimoPeso(ultimoPesoActualizado)
    logEvento('serie_completada', {
      ejercicio: ejercicio.nombre,
      grupo_muscular: ejercicio.grupoMuscular,
      numero_serie: serieActual,
      peso: parsePeso(pesoUsado) || 0,
      reps: Number(repsHechas),
    })
    // Récord de volumen en esta serie (peso × reps): compara contra
    // statsCache (el mejor de ANTES de esta sesión) y contra las series ya
    // completadas de este mismo ejercicio en la sesión en curso, para
    // detectar también una segunda mejora dentro de la misma sesión sin
    // necesitar un ref/estado propio.
    const volumenSerieActual = (parsePeso(pesoUsado) || 0) * (Number(repsHechas) || 0)
    if (volumenSerieActual > 0 && statsCache) {
      const statsEj = statsCache.find(st => esMismoEjercicio(st, ejercicio))
      const volumenPrevio = (statsEj?.prVolumen && statsEj.prVolumen.sesionId !== sesionId) ? statsEj.prVolumen.volumen : 0
      const volumenEnEstaSesion = Math.max(0, ...historial
        .filter(h => h.ejIdx === ejIdx)
        .map(h => (parsePeso(h.pesoUsado) || 0) * (Number(h.repsHechas) || 0)))
      if (volumenSerieActual > Math.max(volumenPrevio, volumenEnEstaSesion)) {
        show({ variant: 'success', message: `🏆 Nuevo récord de volumen en ${ejercicio.nombre}: ${pesoUsado || 0}kg × ${repsHechas}`, duration: 4000 })
      }
    }
    setGuardando(false)
    try { navigator.vibrate?.(15) } catch { /* vibración es best-effort, no debe cortar el flujo de guardado */ }
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

  // Corrección no lineal: tocar el dot de una serie ya completada del
  // ejercicio actual la edita en el momento (mismo patrón que ResumenSesion),
  // sin tocar ejIdx/serieIdx ni perder lo que se esté tipeando en la serie
  // en curso — a diferencia de retroceder(), que solo desanda un paso.
  function abrirEditarSerie(i) {
    const entry = historial.find(h => h.ejIdx === ejIdx && h.serieIdx === i)
    if (!entry) return
    setEditandoSerie(entry)
    setEditSeriePeso(entry.pesoUsado)
    setEditSerieReps(entry.repsHechas)
  }

  function guardarEdicionSerie() {
    if (!editSerieReps || !editandoSerie) return
    const { registroId, ejIdx: ejIdxEditado, serieIdx: serieIdxEditado } = editandoSerie
    const nuevoPeso = parsePeso(editSeriePeso) || 0
    const nuevasReps = Number(editSerieReps)
    editarRegistro(registroId, { pesoUsado: nuevoPeso, repsHechas: nuevasReps }).catch(e => {
      console.error(e)
      show({ variant: 'warning', message: 'Se sincronizará cuando haya conexión.' })
    })
    setHistorial(h => h.map(entry => (
      entry.ejIdx === ejIdxEditado && entry.serieIdx === serieIdxEditado
        ? { ...entry, pesoUsado: editSeriePeso, repsHechas: editSerieReps }
        : entry
    )))
    // Corregir la última serie ya hecha de este ejercicio tiene que arrastrar
    // el peso que prefillea la serie siguiente (y el hint "↳ Última vez"): si
    // no, la próxima arranca con el valor viejo. Es el mismo motivo por el que
    // completarSerie mantiene ultimoPesoRef sincronizado a mano.
    const ultimaSerieHecha = Math.max(...historial.filter(h => h.ejIdx === ejIdxEditado).map(h => h.serieIdx))
    if (ejIdxEditado === ejIdx && serieIdxEditado === ultimaSerieHecha) {
      const ultimoPesoActualizado = { ...ultimoPesoRef.current, [ejercicio.id]: editSeriePeso }
      ultimoPesoRef.current = ultimoPesoActualizado
      setUltimoPeso(ultimoPesoActualizado)
    }
    setEditandoSerie(null)
  }

  const restarEditSeriePesoPress = useLongPress(() => setEditSeriePeso(p => String(Math.round(Math.max(0, (parsePeso(p) || 0) - 2.5) * 10) / 10)))
  const sumarEditSeriePesoPress = useLongPress(() => setEditSeriePeso(p => String(Math.round(((parsePeso(p) || 0) + 2.5) * 10) / 10)))
  const restarEditSerieRepsPress = useLongPress(() => setEditSerieReps(r => String(Math.max(1, (Number(r) || 1) - 1))))
  const sumarEditSerieRepsPress = useLongPress(() => setEditSerieReps(r => String((Number(r) || 1) + 1)))

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
    <div className="sa-page">
      <div className="sa-progress-bar"><div className="sa-progress-fill" style={{ width: '0%' }} /></div>
      <div className="sa-body" style={{ justifyContent: 'center' }}>
        <span className="spinner" style={{ color: 'var(--orange)' }} />
      </div>
    </div>
  )

  // Debe evaluarse antes que el EmptyState de abajo: un fallo de red en
  // cargar() deja `ejercicios` en su valor inicial `[]` (recién se setea
  // después de las llamadas a Firestore), y sin este chequeo el error se
  // disfrazaba de "día sin ejercicios" — mensaje engañoso para lo que en
  // realidad es un problema de carga.
  if (errorCarga) return (
    <div className="sa-page">
      <div className="sa-body">
        <ErrorState mensaje="No se pudo cargar la sesión." onRetry={cargar} />
      </div>
    </div>
  )

  if (ejercicios.length === 0) return (
    <div className="sa-page">
      <div className="sa-body">
        <EmptyState mensaje="Este día no tiene ejercicios" icon="🏋️" sub="Agregá ejercicios desde la app web" />
      </div>
    </div>
  )

  const serieFormProps = {
    ejercicio, pesoUsado, setPesoUsado, repsHechas, setRepsHechas, ultimoPeso,
    mostrarNota, nota, setNota,
  }

  const footerProps = {
    onCompletar: completarSerie, repsHechas, guardando, celebrar,
    esUltimaSerie, esUltimoEjercicio, serieActual,
    hayHistorial: historial.length > 0, onVolver: retroceder,
  }

  return (
    <motion.div
      className={isDesktop ? 'sa-page-desktop' : 'sa-page'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className={isDesktop ? 'sa-header-desktop' : 'sa-header'}>
        <div className="sa-progress-bar">
          <motion.div
            className="sa-progress-fill"
            animate={{ width: `${progresoPct}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 28 }}
          />
        </div>
        <div className="sa-header-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span className="sa-ejercicio-counter">
              Ejercicio <strong style={{ color: 'var(--text)' }}>{ejIdx + 1}</strong> / {ejercicios.length}
              <span style={{ color: 'var(--text-mute)', fontWeight: 400 }}> · </span>
              <span className="num" style={{ color: 'var(--orange)', fontWeight: 700 }}>{seriesCompletadas}</span>
              <span style={{ color: 'var(--text-mute)', fontWeight: 400 }}>/{seriesTotales} series</span>
              <span className={`sa-sync-dot sa-sync-dot--${syncStatus.estado}`} role="img" aria-label={syncLabel} title={syncLabel} />
            </span>
            <motion.button className="sa-cancelar-btn" onClick={cancelarSesion} whileTap={BTN_TAP}>
              Cancelar sesión
            </motion.button>
          </div>
          <motion.button className="sa-terminar-btn" onClick={terminarAntes} whileTap={BTN_TAP_FIRM}>
            Terminar
          </motion.button>
        </div>
      </div>

      {isDesktop ? (
        <div className="sa-desktop-cols">
          <div className="sa-desktop-left">
            <ListaEjerciciosDesktop ejercicios={ejercicios} ejIdx={ejIdx} historial={historial} />
          </div>
          <div className="sa-desktop-right">
            <EjercicioInfo
              ejIdx={ejIdx} serieIdx={serieIdx} ejercicio={ejercicio}
              serieActual={serieActual} totalSeries={totalSeries}
              tabRef={tabRef} setTabRef={setTabRef} refAnterior={refAnterior} refPR={refPR}
              mostrarNota={mostrarNota} setMostrarNota={setMostrarNota}
              onEditarSerie={abrirEditarSerie}
            />
            <SerieForm {...serieFormProps} />
            <SerieFooter {...footerProps} footerClassName="sa-footer-desktop" />
          </div>
        </div>
      ) : (
        <>
          <div className="sa-body">
            <EjercicioInfo
              ejIdx={ejIdx} serieIdx={serieIdx} ejercicio={ejercicio}
              serieActual={serieActual} totalSeries={totalSeries}
              tabRef={tabRef} setTabRef={setTabRef} refAnterior={refAnterior} refPR={refPR}
              mostrarNota={mostrarNota} setMostrarNota={setMostrarNota}
              onEditarSerie={abrirEditarSerie}
            />
            <SerieForm {...serieFormProps} />
          </div>
          <SerieFooter {...footerProps} footerClassName="sa-footer" />
        </>
      )}

      <ConfirmDialog open={!!confirmData} data={confirmData} onClose={() => setConfirmData(null)} />

      <Modal open={!!editandoSerie} onClose={() => setEditandoSerie(null)}>
        <p className="resumen-modal-ejercicio">{ejercicio?.nombre}</p>
        <h2 className="resumen-modal-titulo">Serie {editandoSerie ? editandoSerie.serieIdx + 1 : ''}</h2>
        <div className="resumen-row">
          <div className="resumen-field">
            <label className="resumen-label">Peso (kg)</label>
            <div className="resumen-stepper">
              <motion.button className="resumen-stepper-btn" aria-label="Restar 2,5 kg" {...restarEditSeriePesoPress} whileTap={BTN_TAP}>−</motion.button>
              <input
                className="resumen-input-num"
                type="text" inputMode="decimal" placeholder="0"
                value={editSeriePeso} onChange={e => setEditSeriePeso(sanitizarPeso(e.target.value))}
                autoFocus
              />
              <motion.button className="resumen-stepper-btn" aria-label="Sumar 2,5 kg" {...sumarEditSeriePesoPress} whileTap={BTN_TAP}>+</motion.button>
            </div>
          </div>
          <div className="resumen-field">
            <label className="resumen-label">Reps</label>
            <div className="resumen-stepper">
              <motion.button className="resumen-stepper-btn" aria-label="Restar una repetición" {...restarEditSerieRepsPress} whileTap={BTN_TAP}>−</motion.button>
              <input
                className="resumen-input-num"
                type="number" inputMode="numeric"
                value={editSerieReps} onChange={e => setEditSerieReps(e.target.value)}
              />
              <motion.button className="resumen-stepper-btn" aria-label="Sumar una repetición" {...sumarEditSerieRepsPress} whileTap={BTN_TAP}>+</motion.button>
            </div>
          </div>
        </div>
        <div className="resumen-modal-btns">
          <motion.button className="resumen-cancel-btn" onClick={() => setEditandoSerie(null)} whileTap={BTN_TAP}>Cancelar</motion.button>
          <motion.button
            className="resumen-save-btn"
            style={{ opacity: !editSerieReps ? 0.5 : 1 }}
            onClick={guardarEdicionSerie}
            disabled={!editSerieReps}
            whileTap={BTN_TAP}
          >
            Guardar
          </motion.button>
        </div>
      </Modal>

      <AnimatePresence>{celebrar && <Confetti />}</AnimatePresence>
    </motion.div>
  )
}
