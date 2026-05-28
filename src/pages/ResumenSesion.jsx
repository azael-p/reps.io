import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, useMotionValue, useTransform, animate } from 'motion/react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getRegistrosSesion, editarRegistro } from '../firebase/registros'
import { actualizarNotaSesion, completarSesion, backfillResumen } from '../firebase/sesiones'
import { Modal, PageWrapper } from '../components/ui'
import { useUser } from '../context/UserContext'
import { logEvento } from '../firebase/analytics'
import { useDesktop } from '../hooks/useDesktop'

function buildResumen(regs, diaNombre) {
  const ejerciciosMap = {}
  for (const r of regs) {
    if (!ejerciciosMap[r.ejercicioId]) {
      ejerciciosMap[r.ejercicioId] = {
        ejercicioId: r.ejercicioId,
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
  const [registros, setRegistros] = useState([])
  const [diaNombre, setDiaNombre] = useState('')
  const [nota, setNota] = useState('')
  const [guardandoNota, setGuardandoNota] = useState(false)
  const [notaGuardada, setNotaGuardada] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)
  const [editPeso, setEditPeso] = useState('')
  const [editReps, setEditReps] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    try {
      const [sesionSnap, regs] = await Promise.all([
        getDoc(doc(db, 'sesiones', sesionId)),
        getRegistrosSesion(sesionId),
      ])
      const sesionData = sesionSnap.data()
      setNota(sesionData.nota || '')
      setRegistros(regs)
      const diaSnap = await getDoc(doc(db, 'dias', sesionData.diaId))
      const diaNombreVal = diaSnap.data()?.nombre ?? ''
      setDiaNombre(diaNombreVal)

      if (!sesionData.completada) {
        await backfillResumen(sesionId, buildResumen(regs, diaNombreVal))
        await completarSesion(sesionId)
      } else if (!sesionData.resumen && regs.length > 0) {
        await backfillResumen(sesionId, buildResumen(regs, diaNombreVal))
      }
    } catch (e) { console.error(e); setError('Error al cargar la sesión') }
    setCargando(false)
  }, [sesionId])

  useEffect(() => {
    localStorage.removeItem(`sesion_activa_${usuario?.id}`)
    localStorage.removeItem(`calendario_${usuario?.id}`)
    setCargando(true)
    cargar() // eslint-disable-line
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
    if (!editReps) return
    setGuardando(true)
    try {
      await editarRegistro(editando.id, {
        pesoUsado: Number(editPeso) || 0,
        repsHechas: Number(editReps),
      })
      const regs = await getRegistrosSesion(sesionId)
      await backfillResumen(sesionId, buildResumen(regs, diaNombre))
      setRegistros(regs)
    } catch (e) { console.error(e); setError('Error al guardar') }
    setEditando(null)
    setGuardando(false)
  }

  async function guardarNota() {
    setGuardandoNota(true)
    try { await actualizarNotaSesion(sesionId, nota) } catch (e) { console.error(e); setError('Error al guardar la nota') }
    setGuardandoNota(false)
    setNotaGuardada(true)
    setTimeout(() => setNotaGuardada(false), 1800)
  }

  const porEjercicio = useMemo(() => registros.reduce((acc, r) => {
    if (!acc[r.nombreEjercicio]) acc[r.nombreEjercicio] = []
    acc[r.nombreEjercicio].push(r)
    return acc
  }, {}), [registros])

  const totalVolumen = registros.reduce((acc, r) => acc + r.pesoUsado * r.repsHechas, 0)

  if (error) return (
    <div style={s.page}>
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
    <div style={s.page}>
      <div style={{ padding: '80px 0', display: 'flex', justifyContent: 'center' }}>
        <span className="spinner" style={{ color: 'var(--orange)' }} />
      </div>
    </div>
  )

  return (
    <PageWrapper>
      <motion.div
        style={s.header}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.button
          style={s.back}
          onClick={() => navigate('/home')}
          whileTap={{ scale: 0.9 }}
        >
          ←
        </motion.button>
        <div style={s.headerInfo}>
          <p style={s.headerSub}>✓ Sesión completada</p>
          <h1 style={s.titulo}>{diaNombre}</h1>
        </div>
      </motion.div>

      <motion.div
        style={s.stats}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 22 }}
      >
        <div style={s.stat}>
          <span style={s.statNum}><Counter value={Object.keys(porEjercicio).length} /></span>
          <span style={s.statLabel}>Ejercicios</span>
        </div>
        <div style={s.statDivider} />
        <div style={s.stat}>
          <span style={s.statNum}><Counter value={registros.length} /></span>
          <span style={s.statLabel}>Series</span>
        </div>
        <div style={s.statDivider} />
        <div style={s.stat}>
          <span style={s.statNum}>
            {totalVolumen > 0 ? <Counter value={totalVolumen} suffix="kg" /> : '—'}
          </span>
          <span style={s.statLabel}>Volumen</span>
        </div>
      </motion.div>

      <div style={isDesktop ? s.desktopGrid : undefined}>
        <div style={s.ejercicios}>
          {Object.entries(porEjercicio).map(([nombre, series], i) => (
            <motion.div
              key={nombre}
              style={s.ejercicioCard}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06, type: 'spring', stiffness: 220, damping: 22 }}
            >
              <p style={s.ejercicioNombre}>{nombre}</p>
              <div style={s.seriesWrap}>
                {series.map((r, j) => (
                  <motion.div
                    key={r.id}
                    style={s.serieRow}
                    onClick={() => abrirEditar(r)}
                    whileTap={{ scale: 0.98, backgroundColor: 'rgba(255,255,255,0.04)' }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.06 + j * 0.03 }}
                  >
                    <span style={s.serieNum}>{r.numeroSerie}</span>
                    <span style={s.serieDetalle}>
                      {r.pesoUsado > 0 ? <><strong>{r.pesoUsado}</strong> kg × <strong>{r.repsHechas}</strong> reps</> : <><strong>{r.repsHechas}</strong> reps</>}
                    </span>
                    <span style={s.editarHint}>✎</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div style={isDesktop ? s.desktopSide : undefined}>
          <motion.div
            style={s.notaSeccion}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <p style={s.notaLabel}>Nota de la sesión</p>
            <textarea
              style={s.notaInput}
              placeholder="¿Cómo te sentiste? ¿Algo a tener en cuenta?"
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={3}
            />
            <motion.button
              style={s.notaGuardar}
              onClick={guardarNota}
              disabled={guardandoNota}
              whileTap={{ scale: 0.97 }}
            >
              {guardandoNota ? <span className="spinner" /> : notaGuardada ? '✓ Guardado' : 'Guardar nota'}
            </motion.button>
          </motion.div>

          <motion.div
            style={s.footer}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <motion.button
              style={s.homeBtn}
              onClick={() => navigate('/progreso')}
              whileTap={{ scale: 0.97 }}
            >
              Ver mi progreso →
            </motion.button>
            <motion.button
              style={s.secondaryBtn}
              onClick={() => navigate('/home')}
              whileTap={{ scale: 0.97 }}
            >
              Volver al inicio
            </motion.button>
          </motion.div>
        </div>
      </div>

      <Modal open={!!editando} onClose={() => setEditando(null)}>
        <p style={s.modalEjercicio}>{editando?.nombreEjercicio}</p>
        <h2 style={s.modalTitulo}>Serie {editando?.numeroSerie}</h2>
        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Peso (kg)</label>
            <input
              style={s.inputNum}
              type="number" inputMode="decimal" placeholder="0"
              value={editPeso} onChange={e => setEditPeso(e.target.value)}
              autoFocus
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Reps</label>
            <input
              style={s.inputNum}
              type="number" inputMode="numeric"
              value={editReps} onChange={e => setEditReps(e.target.value)}
            />
          </div>
        </div>
        <div style={s.modalBtns}>
          <motion.button style={s.cancelBtn} onClick={() => setEditando(null)} whileTap={{ scale: 0.97 }}>Cancelar</motion.button>
          <motion.button
            style={{ ...s.saveBtn, opacity: !editReps || guardando ? 0.5 : 1 }}
            onClick={guardarEdicion}
            disabled={!editReps || guardando}
            whileTap={{ scale: 0.97 }}
          >
            {guardando ? <span className="spinner" /> : 'Guardar'}
          </motion.button>
        </div>
      </Modal>
    </PageWrapper>
  )
}

const s = {
  page: { minHeight: '100dvh', color: 'var(--text)' },
  header: {
    display: 'flex', alignItems: 'center',
    padding: '20px 16px 16px',
    paddingTop: 'max(20px, env(safe-area-inset-top))',
    gap: '12px',
    borderBottom: '1px solid var(--border)',
  },
  back: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-mute)', width: '44px', height: '44px',
    borderRadius: '12px', fontSize: '1.2rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerSub: { margin: 0, fontSize: '0.7rem', color: 'var(--orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' },
  titulo: { margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em' },
  stats: {
    display: 'flex', margin: '16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '22px 0',
    boxShadow: 'var(--shadow-md)',
  },
  stat: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
  statNum: { fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' },
  statLabel: { fontSize: '0.68rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 },
  statDivider: { width: '1px', background: 'var(--border)', alignSelf: 'stretch' },
  ejercicios: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 16px' },
  ejercicioCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '16px',
    boxShadow: 'var(--shadow-sm)',
  },
  ejercicioNombre: { margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em' },
  seriesWrap: { display: 'flex', flexDirection: 'column', gap: '2px' },
  serieRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px',
    margin: '0 -8px',
    borderRadius: 'var(--r-sm)',
    cursor: 'pointer',
    gap: '12px',
  },
  serieNum: {
    fontSize: '0.72rem', color: 'var(--text-dim)',
    fontWeight: 700, letterSpacing: '0.06em',
    minWidth: '20px',
  },
  serieDetalle: { flex: 1, fontSize: '0.95rem', color: 'var(--text)' },
  editarHint: { fontSize: '0.95rem', color: 'var(--text-dim)' },
  notaSeccion: { padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', gap: '10px' },
  notaLabel: { margin: 0, fontSize: '0.72rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 },
  notaInput: {
    padding: '14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text)',
    fontSize: '0.95rem',
    outline: 'none', resize: 'none',
    fontFamily: 'inherit',
  },
  notaGuardar: {
    padding: '12px',
    background: 'var(--bg-card)',
    color: 'var(--text-mute)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  footer: { padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: '8px' },
  homeBtn: {
    width: '100%', padding: '18px',
    background: 'var(--orange-grad)',
    color: '#fff', border: 'none',
    borderRadius: 'var(--r-lg)',
    fontSize: '1.05rem', fontWeight: 700,
    boxShadow: '0 12px 32px rgba(199, 90, 48, 0.4)',
    letterSpacing: '-0.01em',
  },
  secondaryBtn: {
    width: '100%', padding: '14px',
    background: 'transparent',
    color: 'var(--text-mute)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    fontSize: '0.92rem', fontWeight: 600,
  },
  modalEjercicio: {
    margin: 0, fontSize: '0.72rem', color: 'var(--text-mute)',
    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700,
  },
  modalTitulo: { margin: 0, fontSize: '1.15rem', fontWeight: 700 },
  row: { display: 'flex', gap: '10px' },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '0.72rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 },
  inputNum: {
    padding: '16px', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
    color: 'var(--text)', fontSize: '1.8rem', fontWeight: 800,
    outline: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box',
    letterSpacing: '-0.03em',
  },
  modalBtns: { display: 'flex', gap: '10px' },
  cancelBtn: { flex: 1, padding: '14px', background: 'var(--bg-input)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: '0.95rem' },
  saveBtn: { flex: 1, padding: '14px', background: 'var(--orange-grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(199, 90, 48, 0.35)' },
  desktopGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: '24px',
    padding: '0 24px',
    alignItems: 'start',
  },
  desktopSide: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'sticky',
    top: '24px',
  },
}
