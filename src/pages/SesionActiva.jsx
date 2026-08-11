import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getEjerciciosDia } from '../firebase/ejerciciosDia'
import { agregarRegistro, editarRegistro, getUltimaVezEjercicioLocal, getRegistrosSesion } from '../firebase/registros'
import {
  getSesionesConResumen, eliminarSesion, getRegistrosPorEjercicioLocal,
} from '../firebase/sesiones'
import { ConfirmDialog, Badge, EmptyState } from '../components/ui'
import { useUser } from '../context/UserContext'
import { logEvento } from '../firebase/analytics'
import { useDesktop } from '../hooks/useDesktop'
import { useToast } from '../components/Toast'
import { CornerUpLeft } from 'lucide-react'

const INPUT_FOCUS = { borderColor: 'var(--orange)', boxShadow: '0 0 0 4px var(--orange-glow)' }
const BTN_TAP_SMALL = { scale: 0.92 }
const BTN_TAP = { scale: 0.96 }
const BTN_TAP_FIRM = { scale: 0.94 }
const CONFETTI_COLORS = ['#f0997b', '#5dcaa5', '#85b7eb', '#ffd166']
const CONFETTI_STYLE = {
  position: 'absolute',
  bottom: '120px',
  left: '50%',
  transform: 'translateX(-50%)',
  pointerEvents: 'none',
  zIndex: 99,
}
const CONFETTI_PARTICLE = {
  position: 'absolute',
  width: '8px', height: '8px',
  borderRadius: '2px',
  top: 0, left: 0,
}

const Confetti = memo(function Confetti() {
  return (
    <motion.div
      style={CONFETTI_STYLE}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.55 }}
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.span
          key={i}
          style={{ ...CONFETTI_PARTICLE, background: CONFETTI_COLORS[i % 4] }}
          initial={{ x: 0, y: 0, scale: 0 }}
          animate={{
            x: Math.cos((i / 10) * Math.PI * 2) * 90,
            y: Math.sin((i / 10) * Math.PI * 2) * 90 - 30,
            scale: [0, 1, 0],
            rotate: 360,
          }}
          transition={{ duration: 0.6 }}
        />
      ))}
    </motion.div>
  )
})

function tiempoRelativo(timestamp) {
  if (!timestamp) return ''
  const ms = timestamp?.toMillis?.() ?? new Date(timestamp).getTime()
  const diff = Date.now() - ms
  const dias = Math.floor(diff / 86400000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  if (dias < 30) return `hace ${Math.floor(dias / 7)} sem`
  return `hace ${Math.floor(dias / 30)} mes`
}

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
  const [sesionesCache, setSesionesCache] = useState(null) // null = loading
  const [guardando, setGuardando] = useState(false)
  const [mostrarNota, setMostrarNota] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [celebrar, setCelebrar] = useState(false)
  const [confirmData, setConfirmData] = useState(null)
  const ultimoPesoRef = useRef(ultimoPeso)

  useEffect(() => { ultimoPesoRef.current = ultimoPeso }, [ultimoPeso])

  // Preload all sessions once — replaces per-exercise Firestore queries
  useEffect(() => {
    if (!usuario) return
    getSesionesConResumen(usuario.id).then(setSesionesCache).catch(e => { console.error(e); show({ variant: 'error', message: 'No se pudieron cargar las sesiones.' }) })
  }, [usuario])

  const cargar = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'sesiones', sesionId))
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
  }, [sesionId, navigate])

  useEffect(() => {
    localStorage.setItem(`sesion_activa_${usuario?.id}`, sesionId)
    logEvento('sesion_iniciada')
    setCargando(true); cargar() // eslint-disable-line
  }, [cargar, sesionId, usuario?.id])

  useEffect(() => {
    const ejercicio = ejercicios[ejIdx]
    if (!ejercicio || !usuario || sesionesCache === null) return
    if (refCache[ejercicio.id] !== undefined) {
      setRefAnterior(refCache[ejercicio.id]) // eslint-disable-line
    } else {
      setRefAnterior(undefined)
      const data = getUltimaVezEjercicioLocal(sesionesCache, ejercicio.id, sesionId)
      setRefCache(c => ({ ...c, [ejercicio.id]: data }))
      setRefAnterior(data)
    }
    if (prCache[ejercicio.id] !== undefined) {
      setRefPR(prCache[ejercicio.id])
    } else {
      setRefPR(undefined)
      let maxPeso = 0; let prData = null
      for (const sesion of sesionesCache) {
        if (sesion.id === sesionId) continue
        const ej = sesion.resumen?.ejercicios?.find(e => e.ejercicioId === ejercicio.id)
        if (!ej?.series?.length) continue
        const max = Math.max(...ej.series.map(s => s.pesoUsado || 0))
        if (max > maxPeso) { maxPeso = max; prData = { maxPeso: max, series: ej.series, fecha: sesion.fecha } }
      }
      setPRCache(c => ({ ...c, [ejercicio.id]: prData }))
      setRefPR(prData)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejIdx, ejercicios, sesionId, usuario, sesionesCache])

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
      localStorage.removeItem(`sesion_activa_${usuario?.id}`)
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
    setTimeout(() => setCelebrar(false), 600)
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
        localStorage.removeItem(`sesion_activa_${usuario?.id}`)
        localStorage.removeItem(`calendario_${usuario?.id}`)
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
        localStorage.removeItem(`sesion_activa_${usuario?.id}`)
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

  const ejercicioListDesktop = (
    <div style={s.desktopEjercicioList}>
      <p style={s.desktopListTitle}>Ejercicios</p>
      {ejercicios.map((ej, i) => {
        const completado = i < ejIdx || (i === ejIdx && historial.some(h => h.ejIdx === i && h.serieIdx === ej.seriesEsperadas - 1))
        const actual = i === ejIdx && !completado
        return (
          <div
            key={ej.id}
            style={{
              ...s.desktopEjItem,
              ...(actual ? s.desktopEjItemActual : {}),
              ...(completado ? s.desktopEjItemDone : {}),
            }}
          >
            <span style={s.desktopEjNum}>{completado ? '✓' : i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={s.desktopEjNombre}>{ej.nombre}</span>
              <span style={s.desktopEjGrupo}>{ej.grupoMuscular}</span>
            </div>
            <span style={s.desktopEjSeries}>{ej.seriesEsperadas}×{ej.repsEsperadas}</span>
          </div>
        )
      })}
    </div>
  )

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

      {(() => {
        const ejercicioInfoBlock = (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${ejIdx}-${serieIdx}`}
              style={s.ejercicioInfo}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              <div style={s.tituloRow}>
                <h1 style={s.ejercicioNombre}>{ejercicio.nombre}</h1>
                <Badge color="orange">{ejercicio.grupoMuscular}</Badge>
              </div>
              <div style={s.serieRow}>
                <p style={s.serieLabel} aria-live="polite">
                  Serie <strong style={s.serieStrong}>{serieActual}</strong> de {totalSeries}
                </p>
                <div style={s.serieDots}>
                  {Array.from({ length: totalSeries }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        ...s.serieDot,
                        ...(i < serieIdx ? s.serieDotDone : {}),
                        ...(i === serieIdx ? s.serieDotActive : {}),
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={s.refTabsWrap}>
                <div style={s.refTabs}>
                  {['ultima', 'pr'].map(tab => (
                    <button
                      key={tab}
                      style={{ ...s.refTab, ...(tabRef === tab ? s.refTabActivo : {}) }}
                      onClick={() => setTabRef(tab)}
                    >
                      {tab === 'ultima' ? 'Última' : 'PR personal'}
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  {tabRef === 'ultima' ? (
                    refAnterior === undefined ? (
                      <motion.div key="ref-loading" style={s.refCardCompact} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <span style={s.refLabelCompact}>Última vez</span>
                        <span style={{ ...s.refValorCompact, color: 'transparent', background: 'var(--bg-elev)', borderRadius: '4px' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                      </motion.div>
                    ) : refAnterior ? (
                      <motion.div key="ref-data" style={s.refCardCompact} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                        <span style={s.refLabelCompact}>Última vez {tiempoRelativo(refAnterior.fecha)}:</span>
                        <span style={s.refValorCompact}>
                          {refAnterior.series.map((serie, i) => (
                            <span key={serie.numeroSerie}>
                              {i > 0 && <span style={{ color: 'var(--border-strong)' }}> · </span>}
                              {serie.pesoUsado > 0 ? `${serie.pesoUsado}kg × ` : ''}{serie.repsHechas}
                            </span>
                          ))}
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div key="ref-empty" style={s.refCardCompact} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <span style={s.refLabelCompact}>Primera vez con este ejercicio 🎉</span>
                      </motion.div>
                    )
                  ) : (
                    refPR === undefined ? (
                      <motion.div key="pr-loading" style={s.refCardCompact} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <span style={s.refLabelCompact}>PR personal</span>
                        <span style={{ ...s.refValorCompact, color: 'transparent', background: 'var(--bg-elev)', borderRadius: '4px' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                      </motion.div>
                    ) : refPR ? (
                      <motion.div key="pr-data" style={s.refCardCompact} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                        <span style={{ ...s.refLabelCompact, color: 'var(--blue)' }}>🏆 Tu marca: {refPR.maxPeso}kg</span>
                        <span style={s.refValorCompact}>
                          {refPR.series.map((serie, i) => (
                            <span key={serie.numeroSerie}>
                              {i > 0 && <span style={{ color: 'var(--border-strong)' }}> · </span>}
                              {serie.pesoUsado > 0 ? `${serie.pesoUsado}kg × ` : ''}{serie.repsHechas}
                            </span>
                          ))}
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div key="pr-empty" style={s.refCardCompact} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <span style={s.refLabelCompact}>Sin marca todavía</span>
                      </motion.div>
                    )
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        )

        const inputsBlock = (
          <div style={s.inputs}>
            <div style={s.inputGroup}>
              <label style={s.inputLabel}>Peso (kg)</label>
              <div style={s.stepper}>
                <motion.button style={s.stepperBtn} onClick={() => setPesoUsado(p => String(Math.round(Math.max(0, (Number(p) || 0) - 2.5) * 10) / 10))} whileTap={BTN_TAP_SMALL}>−</motion.button>
                <motion.input style={s.inputBig} type="number" inputMode="decimal" placeholder={ultimoPeso[ejercicio.id] ? String(ultimoPeso[ejercicio.id]) : ''} value={pesoUsado} onChange={e => setPesoUsado(e.target.value)} aria-label="Peso (kg)" whileFocus={INPUT_FOCUS} />
                <motion.button style={s.stepperBtn} onClick={() => setPesoUsado(p => String(Math.round(((Number(p) || 0) + 2.5) * 10) / 10))} whileTap={BTN_TAP_SMALL}>+</motion.button>
              </div>
              {ultimoPeso[ejercicio.id] && !pesoUsado && (
                <p style={s.hintTocable} onClick={() => setPesoUsado(String(ultimoPeso[ejercicio.id]))}>↳ Última vez: {ultimoPeso[ejercicio.id]}kg</p>
              )}
            </div>
            <div style={s.inputGroup}>
              <label style={s.inputLabel}>Reps</label>
              <div style={s.stepper}>
                <motion.button style={s.stepperBtn} onClick={() => setRepsHechas(r => String(Math.max(1, (Number(r) || ejercicio.repsEsperadas) - 1)))} whileTap={BTN_TAP_SMALL}>−</motion.button>
                <motion.input style={s.inputBig} type="number" inputMode="numeric" placeholder={String(ejercicio.repsEsperadas)} value={repsHechas} onChange={e => setRepsHechas(e.target.value)} aria-label="Repeticiones" whileFocus={INPUT_FOCUS} />
                <motion.button style={s.stepperBtn} onClick={() => setRepsHechas(r => String((Number(r) || ejercicio.repsEsperadas) + 1))} whileTap={BTN_TAP_SMALL}>+</motion.button>
              </div>
            </div>
          </div>
        )

        const notaBlock = (
          <AnimatePresence mode="wait">
            {mostrarNota ? (
              <motion.textarea key="textarea" style={s.notaInput} placeholder="Nota para esta serie..." value={nota} onChange={e => setNota(e.target.value)} rows={2} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} autoFocus />
            ) : (
              <motion.button key="addNoteBtn" style={s.notaBtn} onClick={() => setMostrarNota(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} whileTap={{ scale: 0.97 }}>+ Nota</motion.button>
            )}
          </AnimatePresence>
        )

        const serieRef = tabRef === 'pr'
          ? refPR?.series?.find(s => s.numeroSerie === serieActual)
          : refAnterior?.series?.find(s => s.numeroSerie === serieActual)
        const refSerieBlock = serieRef ? (
          <motion.div
            key={`ref-serie-${ejIdx}-${serieIdx}-${tabRef}`}
            style={{ ...s.refSerieCard, ...(tabRef === 'pr' ? s.refSerieCardPR : {}) }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <span style={s.refSerieIcon}>{tabRef === 'pr' ? '🏆' : '🎯'}</span>
            <div style={{ flex: 1 }}>
              <span style={{ ...s.refSerieLabel, ...(tabRef === 'pr' ? { color: 'var(--blue)' } : {}) }}>
                {tabRef === 'pr' ? 'PR personal' : 'Última vez'} — serie {serieActual}
              </span>
              <span style={s.refSerieValor}>
                {serieRef.pesoUsado > 0 ? `${serieRef.pesoUsado} kg` : 'Sin peso'} × {serieRef.repsHechas} reps
              </span>
            </div>
          </motion.div>
        ) : null

        const footerBlock = (footerStyle) => (
          <div style={footerStyle}>
            <motion.button
              style={s.completarBtn}
              onClick={completarSerie}
              disabled={!repsHechas || guardando}
              whileTap={!repsHechas || guardando ? {} : { scale: 0.97 }}
              animate={celebrar ? { scale: [1, 1.04, 1] } : {}}
              transition={{ duration: 0.35 }}
            >
              {guardando ? <span className="spinner" /> : esUltimaSerie && esUltimoEjercicio ? 'Finalizar entrenamiento ✓' : esUltimaSerie ? 'Siguiente ejercicio →' : `Completar serie ${serieActual} →`}
            </motion.button>
            <AnimatePresence>
              {historial.length > 0 && (
                <motion.button style={s.volverBtn} onClick={retroceder} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }} whileTap={{ scale: 0.96 }}>
                  <CornerUpLeft size={15} style={{ flexShrink: 0 }} /> Corregir serie anterior
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )

        if (isDesktop) return (
          <div style={s.desktopCols}>
            <div style={s.desktopLeft}>{ejercicioListDesktop}</div>
            <div style={s.desktopRight}>
              {ejercicioInfoBlock}
              {inputsBlock}
              {notaBlock}
              {refSerieBlock}
              {footerBlock(s.footerDesktop)}
            </div>
          </div>
        )
        return (
          <>
            <div style={s.body}>
              {ejercicioInfoBlock}
              {inputsBlock}
              {notaBlock}
              {refSerieBlock}
            </div>
            {footerBlock(s.footer)}
          </>
        )
      })()}

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
  ejercicioInfo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  tituloRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  grupoBadge: {
    fontSize: '0.6rem', fontWeight: 700,
    color: 'var(--orange)',
    background: 'var(--orange-glow)',
    border: '1px solid rgba(240, 153, 123, 0.3)',
    padding: '3px 8px', borderRadius: '20px',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  ejercicioNombre: {
    margin: 0, fontSize: '1.55rem', fontWeight: 800,
    lineHeight: 1.15, letterSpacing: '-0.03em',
  },
  serieRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  serieLabel: { margin: 0, color: 'var(--text-mute)', fontSize: '0.95rem' },
  serieStrong: {
    color: 'var(--orange)', fontWeight: 800, fontSize: '1.1em',
  },
  serieDots: { display: 'flex', gap: '6px', alignItems: 'center' },
  serieDot: {
    width: '8px', height: '8px',
    borderRadius: '50%',
    background: 'var(--border-strong)',
    transition: 'background 0.2s, transform 0.2s',
  },
  serieDotDone: {
    background: 'var(--orange)',
    boxShadow: '0 0 6px rgba(240, 153, 123, 0.5)',
  },
  serieDotActive: {
    background: 'var(--orange)',
    transform: 'scale(1.3)',
    boxShadow: '0 0 10px rgba(240, 153, 123, 0.8)',
  },
  refTabsWrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
  refTabs: { display: 'flex', gap: '4px' },
  refTab: {
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '0.65rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-dim)',
    cursor: 'pointer',
  },
  refTabActivo: {
    background: 'var(--bg-card)',
    color: 'var(--text)',
    borderColor: 'var(--border-strong)',
  },
  refCardCompact: {
    display: 'flex', gap: '4px',
    padding: '4px 0',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  refLabelCompact: {
    fontSize: '0.68rem', fontWeight: 700,
    color: 'var(--text-dim)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  refValorCompact: {
    fontSize: '0.85rem', fontWeight: 600,
    color: 'var(--text-mute)',
  },
  inputs: { display: 'flex', gap: '10px' },
  inputGroup: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  stepper: { display: 'flex', alignItems: 'center', gap: '6px' },
  stepperBtn: {
    width: '44px', height: '44px',
    borderRadius: '12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    fontSize: '1.2rem', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  inputLabel: {
    fontSize: '0.72rem', color: 'var(--text-mute)',
    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700,
  },
  hintTocable: {
    fontSize: '0.78rem', color: 'var(--orange)',
    cursor: 'pointer', fontWeight: 500,
    margin: 0,
  },
  inputBig: {
    padding: '16px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: '1px solid var(--highlight)',
    borderRadius: 'var(--r-lg)',
    color: 'var(--text)',
    fontSize: '1.6rem', fontWeight: 800,
    outline: 'none', textAlign: 'center',
    width: '100%', boxSizing: 'border-box',
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums',
  },
  notaBtn: {
    background: 'transparent',
    border: '1px dashed var(--border-strong)',
    color: 'var(--text-dim)',
    padding: '14px',
    borderRadius: 'var(--r-md)',
    fontSize: '0.9rem',
  },
  notaInput: {
    padding: '12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text)',
    fontSize: '0.95rem',
    outline: 'none', resize: 'none',
    fontFamily: 'inherit',
  },
  footer: {
    padding: '16px',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  completarBtn: {
    width: '100%', padding: '16px',
    background: 'var(--orange-grad)',
    color: '#fff', border: 'none',
    borderRadius: 'var(--r-lg)',
    fontSize: '1.05rem', fontWeight: 700,
    boxShadow: '0 14px 32px rgba(199, 90, 48, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    letterSpacing: '-0.01em',
  },
  volverBtn: {
    width: '100%', padding: '14px',
    marginTop: '8px',
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    borderRadius: 'var(--r-lg)',
    fontSize: '0.92rem', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  },
  muted: { color: 'var(--text-mute)', textAlign: 'center', padding: '32px 16px' },
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
  desktopEjercicioList: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  desktopListTitle: {
    margin: '0 0 10px',
    fontSize: '0.7rem', fontWeight: 700,
    color: 'var(--text-mute)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
  },
  desktopEjItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px',
    borderRadius: 'var(--r-md)',
    background: 'transparent',
    opacity: 0.5,
  },
  desktopEjItemActual: {
    background: 'rgba(240,153,123,0.1)',
    border: '1px solid rgba(240,153,123,0.3)',
    opacity: 1,
  },
  desktopEjItemDone: {
    opacity: 0.35,
  },
  desktopEjNum: {
    width: '22px', height: '22px',
    borderRadius: '50%',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', fontWeight: 700,
    flexShrink: 0, color: 'var(--text-mute)',
  },
  desktopEjNombre: {
    display: 'block',
    fontSize: '0.88rem', fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  desktopEjGrupo: {
    display: 'block',
    fontSize: '0.7rem', color: 'var(--text-dim)',
  },
  desktopEjSeries: {
    fontSize: '0.75rem', color: 'var(--text-dim)', flexShrink: 0,
  },
  refSerieCard: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 14px',
    background: 'var(--orange-glow)',
    border: '1px solid rgba(240, 153, 123, 0.25)',
    borderRadius: 'var(--r-lg)',
  },
  refSerieCardPR: {
    background: 'rgba(133, 183, 235, 0.1)',
    border: '1px solid rgba(133, 183, 235, 0.25)',
  },
  refSerieIcon: { fontSize: '1.1rem', flexShrink: 0 },
  refSerieLabel: {
    display: 'block',
    fontSize: '0.65rem', fontWeight: 700,
    color: 'var(--orange)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: '3px',
  },
  refSerieValor: {
    display: 'block',
    fontSize: '1.15rem', fontWeight: 800,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
}
