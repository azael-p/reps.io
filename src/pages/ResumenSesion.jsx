import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, useMotionValue, useTransform, animate } from 'motion/react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getRegistrosSesion, editarRegistro } from '../firebase/registros'
import { actualizarNotaSesion, backfillResumen } from '../firebase/sesiones'
import { completarSesionConAgregados } from '../firebase/completarSesion'
import { aplicarSesionAResumenGlobal } from '../firebase/statsGlobal'
import { aplicarSesionAStats, rebuildStatsEjercicios } from '../firebase/statsEjercicios'
import { Modal, PageWrapper } from '../components/ui'
import { useUser } from '../context/UserContext'
import { useToast } from '../components/Toast'
import { logEvento } from '../firebase/analytics'
import { useDesktop } from '../hooks/useDesktop'
import { useLongPress } from '../hooks/useLongPress'

function buildResumen(regs, diaNombre, programaNombre = '') {
  const ejerciciosMap = {}
  for (const r of regs) {
    if (!ejerciciosMap[r.ejercicioId]) {
      ejerciciosMap[r.ejercicioId] = {
        ejercicioId: r.ejercicioId,
        catalogoId: r.catalogoId ?? null,
        nombre: r.nombreEjercicio,
        grupoMuscular: r.grupoMuscular,
        series: [],
      }
    }
    ejerciciosMap[r.ejercicioId].series.push({
      numeroSerie: r.numeroSerie,
      pesoUsado: r.pesoUsado,
      repsHechas: r.repsHechas,
    })
  }
  for (const ej of Object.values(ejerciciosMap)) {
    ej.series.sort((a, b) => a.numeroSerie - b.numeroSerie)
  }
  return {
    volumenTotal: regs.reduce((acc, r) => acc + (r.pesoUsado || 0) * (r.repsHechas || 0), 0),
    diaNombre,
    // Denormalizado por el mismo motivo que diaNombre: si después se borra el
    // programa, el historial conserva su nombre en vez de mostrar '–'.
    programaNombre,
    ejercicios: Object.values(ejerciciosMap),
  }
}

function Counter({ value, suffix = '', duration = 1.1 }) {
  const motionValue = useMotionValue(0)
  const rounded = useTransform(motionValue, (v) => Math.round(v).toLocaleString())

  useEffect(() => {
    const controls = animate(motionValue, value, { duration, ease: 'easeOut' })
    return controls.stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
      <motion.span>{rounded}</motion.span>
      {suffix && <span style={{ fontSize: '0.65em', marginLeft: '4px', color: 'var(--text-mute)', fontWeight: 600 }}>{suffix}</span>}
    </span>
  )
}

export default function ResumenSesion() {
  const isDesktop = useDesktop()
  const { sesionId } = useParams()
  const navigate = useNavigate()
  const { usuario } = useUser()
  const { show } = useToast()
  const [registros, setRegistros] = useState([])
  const [diaNombre, setDiaNombre] = useState('')
  const [programaNombre, setProgramaNombre] = useState('')
  const [nota, setNota] = useState('')
  const [guardandoNota, setGuardandoNota] = useState(false)
  const [notaGuardada, setNotaGuardada] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)
  const [editPeso, setEditPeso] = useState('')
  const [editReps, setEditReps] = useState('')
  const [error, setError] = useState('')
  const [fechaSesion, setFechaSesion] = useState(null)
  const notaTimeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(notaTimeoutRef.current), [])

  const cargar = useCallback(async () => {
    try {
      const [sesionSnap, regs] = await Promise.all([
        getDoc(doc(db, 'sesiones', sesionId)),
        getRegistrosSesion(sesionId),
      ])
      if (!sesionSnap.exists()) throw new Error(`Sesión ${sesionId} inexistente`)
      const sesionData = sesionSnap.data()
      setNota(sesionData.nota || '')
      setFechaSesion(sesionData.fecha ?? null)
      setRegistros(regs)
      const diaSnap = await getDoc(doc(db, 'dias', sesionData.diaId))
      const diaData = diaSnap.data()
      const diaNombreVal = diaData?.nombre ?? ''
      setDiaNombre(diaNombreVal)

      // Si la sesión ya lo tiene denormalizado, no se lee el programa: en el
      // camino frecuente (abrir una sesión ya resumida) esto es 0 lecturas
      // extra. Solo las sesiones nuevas o legacy pagan el getDoc.
      const programaNombreVal = sesionData.resumen?.programaNombre
        ?? (diaData?.programaId
          ? (await getDoc(doc(db, 'programas', diaData.programaId))).data()?.nombre ?? ''
          : '')
      setProgramaNombre(programaNombreVal)

      if (!sesionData.completada) {
        const resumen = buildResumen(regs, diaNombreVal, programaNombreVal)
        // No se espera el ACK del servidor: con persistentLocalCache la
        // escritura ya se aplicó al cache local al llamar esta función, y
        // sin red la promesa de commit() puede no resolver nunca — esperarla
        // acá dejaría el spinner girando para siempre.
        completarSesionConAgregados(sesionId, { usuarioId: usuario?.id, fecha: sesionData.fecha, resumen })
          .catch(e => {
            console.error(e)
            show({ message: 'No se pudo confirmar la sesión con el servidor. Se sincronizará cuando haya conexión.', variant: 'warning', duration: 5000 })
          })
      } else if (!sesionData.resumen && regs.length > 0) {
        // Reparar también los agregados: sin esto la sesión se ve en el
        // historial pero queda fuera del volumen, el calendario y los PR, y
        // ningún fallback la recupera (solo reconstruyen si falta el doc
        // entero). Mismo criterio no-bloqueante que la rama de arriba.
        const resumen = buildResumen(regs, diaNombreVal, programaNombreVal)
        const reparar = Promise.all([
          backfillResumen(sesionId, resumen),
          usuario?.id ? aplicarSesionAResumenGlobal(usuario.id, { sesionId, fecha: sesionData.fecha, resumen }) : null,
          usuario?.id ? aplicarSesionAStats(usuario.id, { sesionId, fecha: sesionData.fecha, resumen }) : null,
        ])
        reparar.catch(e => {
          console.error(e)
          show({ message: 'No se pudo reparar el resumen de esta sesión. Se reintentará más adelante.', variant: 'warning', duration: 5000 })
        })
      }
    } catch (e) { console.error(e); setError('Error al cargar la sesión') }
    setCargando(false)
  }, [sesionId, usuario, show])

  useEffect(() => {
    if (usuario?.id) {
      localStorage.removeItem(`sesion_activa_${usuario.id}`)
      localStorage.removeItem(`calendario_${usuario.id}`)
    }
    cargar()
  }, [sesionId, cargar, usuario?.id])

  // Loguear sesion_finalizada una vez que tengamos los datos cargados
  useEffect(() => {
    if (cargando || registros.length === 0) return
    const ejerciciosUnicos = new Set(registros.map(r => r.nombreEjercicio)).size
    const volumen = registros.reduce((acc, r) => acc + r.pesoUsado * r.repsHechas, 0)
    logEvento('sesion_finalizada', {
      total_series: registros.length,
      total_ejercicios: ejerciciosUnicos,
      volumen_total: volumen,
    })
  }, [cargando, registros])

  function abrirEditar(r) {
    setEditando(r)
    setEditPeso(r.pesoUsado > 0 ? String(r.pesoUsado) : '')
    setEditReps(String(r.repsHechas))
  }

  async function guardarEdicion() {
    if (!editReps || !editando) return
    const idEditado = editando.id
    const ejercicioEditado = {
      nombre: editando.nombreEjercicio,
      grupoMuscular: editando.grupoMuscular,
      catalogoId: editando.catalogoId ?? null,
    }
    setEditando(null)

    // Fire-and-forget: no se espera el ACK de ninguna de estas escrituras
    // (mismo motivo que en cargar()). Cada una reporta su propio fallo por
    // toast en vez de encadenarse detrás de un único await bloqueante.
    editarRegistro(idEditado, {
      pesoUsado: Number(editPeso) || 0,
      repsHechas: Number(editReps),
    }).catch(e => {
      console.error(e)
      show({ message: 'No se pudo guardar la edición. Se reintentará cuando haya conexión.', variant: 'warning' })
    })

    try {
      // Lectura: resuelve del cache local casi al instante, incluso sin red,
      // y ya refleja el editarRegistro recién encolado (el cache se
      // actualiza al llamar la escritura, no al resolver su promesa).
      const regs = await getRegistrosSesion(sesionId)
      setRegistros(regs)
      const resumen = buildResumen(regs, diaNombre, programaNombre)
      backfillResumen(sesionId, resumen).catch(e => console.error(e))
      if (usuario?.id && fechaSesion) {
        aplicarSesionAResumenGlobal(usuario.id, { sesionId, fecha: fechaSesion, resumen }).catch(e => console.error(e))
        // La edición puede BAJAR un PR: rebuild del ejercicio afectado.
        rebuildStatsEjercicios(usuario.id, [ejercicioEditado]).catch(e => console.error(e))
      }
    } catch (e) { console.error(e); setError('Error al guardar') }
  }

  async function guardarNota() {
    setGuardandoNota(true)
    try { await actualizarNotaSesion(sesionId, nota) } catch (e) { console.error(e); setError('Error al guardar la nota') }
    setGuardandoNota(false)
    setNotaGuardada(true)
    clearTimeout(notaTimeoutRef.current)
    notaTimeoutRef.current = setTimeout(() => setNotaGuardada(false), 1800)
  }

  const porEjercicio = useMemo(() => registros.reduce((acc, r) => {
    if (!acc[r.nombreEjercicio]) acc[r.nombreEjercicio] = []
    acc[r.nombreEjercicio].push(r)
    return acc
  }, {}), [registros])

  const totalVolumen = registros.reduce((acc, r) => acc + r.pesoUsado * r.repsHechas, 0)

  const restarEditPesoPress = useLongPress(() => setEditPeso(p => String(Math.round(Math.max(0, (Number(p) || 0) - 2.5) * 10) / 10)))
  const sumarEditPesoPress = useLongPress(() => setEditPeso(p => String(Math.round(((Number(p) || 0) + 2.5) * 10) / 10)))
  const restarEditRepsPress = useLongPress(() => setEditReps(r => String(Math.max(1, (Number(r) || 1) - 1))))
  const sumarEditRepsPress = useLongPress(() => setEditReps(r => String((Number(r) || 1) + 1)))

  if (error) return (
    <div className="resumen-page">
      <div style={{ padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <p style={{ color: 'var(--danger)', fontSize: '1rem', textAlign: 'center' }}>{error}</p>
        <motion.button
          style={{ padding: '14px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.95rem' }}
          onClick={() => navigate('/home')}
          whileTap={{ scale: 0.97 }}
        >
          Volver al inicio
        </motion.button>
      </div>
    </div>
  )

  if (cargando) return (
    <div className="resumen-page">
      <div style={{ padding: '80px 0', display: 'flex', justifyContent: 'center' }}>
        <span className="spinner" style={{ color: 'var(--orange)' }} />
      </div>
    </div>
  )

  return (
    <PageWrapper>
      <motion.div
        className="resumen-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.button
          className="resumen-back"
          onClick={() => navigate('/home')}
          whileTap={{ scale: 0.9 }}
          aria-label="Volver al inicio"
        >
          ←
        </motion.button>
        <div className="resumen-header-info">
          <p className="resumen-header-sub">✓ Sesión completada</p>
          <h1 className="resumen-titulo">{diaNombre}</h1>
        </div>
      </motion.div>

      <motion.div
        className="resumen-stats"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 22 }}
      >
        <div className="resumen-stat">
          <span className="resumen-stat-num"><Counter value={Object.keys(porEjercicio).length} /></span>
          <span className="resumen-stat-label">Ejercicios</span>
        </div>
        <div className="resumen-stat-divider" />
        <div className="resumen-stat">
          <span className="resumen-stat-num"><Counter value={registros.length} /></span>
          <span className="resumen-stat-label">Series</span>
        </div>
        <div className="resumen-stat-divider" />
        <div className="resumen-stat">
          <span className="resumen-stat-num">
            {totalVolumen > 0 ? <Counter value={totalVolumen} suffix="kg" /> : '—'}
          </span>
          <span className="resumen-stat-label">Volumen</span>
        </div>
      </motion.div>

      <div className={isDesktop ? 'resumen-desktop-grid' : undefined}>
        <div className="resumen-ejercicios">
          {Object.entries(porEjercicio).map(([nombre, series], i) => (
            <motion.div
              key={nombre}
              className="resumen-ejercicio-card"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06, type: 'spring', stiffness: 220, damping: 22 }}
            >
              <p className="resumen-ejercicio-nombre">{nombre}</p>
              <div className="resumen-series-wrap">
                {series.map((r, j) => (
                  <motion.div
                    key={r.id}
                    className="resumen-serie-row"
                    onClick={() => abrirEditar(r)}
                    whileTap={{ scale: 0.98, backgroundColor: 'rgba(255,255,255,0.04)' }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.06 + j * 0.03 }}
                  >
                    <span className="resumen-serie-num">{r.numeroSerie}</span>
                    <span className="resumen-serie-detalle">
                      {r.pesoUsado > 0 ? <><strong>{r.pesoUsado}</strong> kg × <strong>{r.repsHechas}</strong> reps</> : <><strong>{r.repsHechas}</strong> reps</>}
                    </span>
                    <span className="resumen-editar-hint">✎</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className={isDesktop ? 'resumen-desktop-side' : undefined}>
          <motion.div
            className="resumen-nota-seccion"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <p className="resumen-nota-label">Nota de la sesión</p>
            <textarea
              className="resumen-nota-input"
              placeholder="¿Cómo te sentiste? ¿Algo a tener en cuenta?"
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={3}
            />
            <motion.button
              className="resumen-nota-guardar"
              onClick={guardarNota}
              disabled={guardandoNota}
              whileTap={{ scale: 0.97 }}
            >
              {guardandoNota ? <span className="spinner" /> : notaGuardada ? '✓ Guardado' : 'Guardar nota'}
            </motion.button>
          </motion.div>

          <motion.div
            className="resumen-footer"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <motion.button
              className="resumen-home-btn"
              onClick={() => navigate('/progreso')}
              whileTap={{ scale: 0.97 }}
            >
              Ver mi progreso →
            </motion.button>
            <motion.button
              className="resumen-secondary-btn"
              onClick={() => navigate('/home')}
              whileTap={{ scale: 0.97 }}
            >
              Volver al inicio
            </motion.button>
          </motion.div>
        </div>
      </div>

      <Modal open={!!editando} onClose={() => setEditando(null)}>
        <p className="resumen-modal-ejercicio">{editando?.nombreEjercicio}</p>
        <h2 className="resumen-modal-titulo">Serie {editando?.numeroSerie}</h2>
        <div className="resumen-row">
          <div className="resumen-field">
            <label className="resumen-label">Peso (kg)</label>
            <div className="resumen-stepper">
              <motion.button className="resumen-stepper-btn" aria-label="Restar 2,5 kg" {...restarEditPesoPress} whileTap={{ scale: 0.92 }}>−</motion.button>
              <input
                className="resumen-input-num"
                type="number" inputMode="decimal" placeholder="0"
                value={editPeso} onChange={e => setEditPeso(e.target.value)}
                autoFocus
              />
              <motion.button className="resumen-stepper-btn" aria-label="Sumar 2,5 kg" {...sumarEditPesoPress} whileTap={{ scale: 0.92 }}>+</motion.button>
            </div>
          </div>
          <div className="resumen-field">
            <label className="resumen-label">Reps</label>
            <div className="resumen-stepper">
              <motion.button className="resumen-stepper-btn" aria-label="Restar una repetición" {...restarEditRepsPress} whileTap={{ scale: 0.92 }}>−</motion.button>
              <input
                className="resumen-input-num"
                type="number" inputMode="numeric"
                value={editReps} onChange={e => setEditReps(e.target.value)}
              />
              <motion.button className="resumen-stepper-btn" aria-label="Sumar una repetición" {...sumarEditRepsPress} whileTap={{ scale: 0.92 }}>+</motion.button>
            </div>
          </div>
        </div>
        <div className="resumen-modal-btns">
          <motion.button className="resumen-cancel-btn" onClick={() => setEditando(null)} whileTap={{ scale: 0.97 }}>Cancelar</motion.button>
          <motion.button
            className="resumen-save-btn"
            style={{ opacity: !editReps ? 0.5 : 1 }}
            onClick={guardarEdicion}
            disabled={!editReps}
            whileTap={{ scale: 0.97 }}
          >
            Guardar
          </motion.button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
