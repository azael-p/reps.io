import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { getEjerciciosDia, agregarEjercicioDia, editarEjercicioDia, marcarEjercicioParaEliminar, desmarcarEjercicioParaEliminar, eliminarEjercicioDefinitivo, reordenarEjercicios } from '../firebase/ejerciciosDia'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import SeleccionarEjercicio from '../components/SeleccionarEjercicio'
import { Header, Modal, ListSkeleton, EmptyState, ErrorState, PageWrapper, Badge } from '../components/ui'
import { useToast } from '../components/Toast'
import { useEliminarConUndo } from '../hooks/useEliminarConUndo'
import DnDList from '../components/DnDList'
import { GripVertical, Pencil, Trash2, Dumbbell } from 'lucide-react'

export default function EjerciciosDia() {
  const { programaId, diaId } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const [dia, setDia] = useState(null)
  const [programaNombre, setProgramaNombre] = useState('')
  const [ejercicios, setEjercicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [picker, setPicker] = useState(false)
  const [editando, setEditando] = useState(null)
  const [editSeries, setEditSeries] = useState('')
  const [editReps, setEditReps] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [errorCarga, setErrorCarga] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [diaSnap, data, progSnap] = await Promise.all([
        getDoc(doc(db, 'dias', diaId)),
        getEjerciciosDia(diaId),
        getDoc(doc(db, 'programas', programaId)),
      ])
      if (!diaSnap.exists()) { navigate(`/programas/${programaId}`); return }
      setDia({ id: diaSnap.id, ...diaSnap.data() })
      setProgramaNombre(progSnap.data()?.nombre ?? '')
      setEjercicios(data)
      setErrorCarga(false)
    } catch (e) { console.error(e); setErrorCarga(true) }
    setCargando(false)
  }, [diaId, programaId, navigate])

  useEffect(() => { cargar() }, [cargar])

  async function onSeleccionar({ nombre, grupoMuscular, esCustom, catalogoId, seriesEsperadas, repsEsperadas }) {
    setPicker(false)
    try {
      await agregarEjercicioDia({ diaId, nombre, grupoMuscular, esCustom, catalogoId, seriesEsperadas, repsEsperadas, orden: ejercicios.length })
      show({ message: 'Ejercicio agregado', variant: 'success' })
    } catch (e) { console.error(e) }
    cargar()
  }

  function abrirEditar(e) {
    setEditando(e)
    setEditSeries(String(e.seriesEsperadas))
    setEditReps(String(e.repsEsperadas))
  }

  async function guardarEdicion() {
    if (!editReps || !editSeries || Number(editReps) < 1 || Number(editSeries) < 1) { setErrorMsg('Series y reps deben ser mayores a 0'); return }
    setErrorMsg('')
    try {
      await editarEjercicioDia(editando.id, { nombre: editando.nombre, seriesEsperadas: Number(editSeries), repsEsperadas: Number(editReps) })
      show({ message: 'Ejercicio actualizado', variant: 'success' })
      setEditando(null)
    } catch (e) { console.error(e); setErrorMsg('Error al guardar. Intentá de nuevo.') }
    cargar()
  }

  const eliminarConUndo = useEliminarConUndo({
    marcar: marcarEjercicioParaEliminar,
    desmarcar: desmarcarEjercicioParaEliminar,
    eliminarDefinitivo: eliminarEjercicioDefinitivo,
  })

  function eliminar(ej) {
    eliminarConUndo(ej, {
      mensaje: `"${ej.nombre}" eliminado`,
      onOptimista: () => setEjercicios(prev => prev.filter(e => e.id !== ej.id)),
      onRecargar: cargar,
    })
  }

  return (
    <>
      <AnimatePresence>
        {picker && (
          <SeleccionarEjercicio onSeleccionar={onSeleccionar} onCerrar={() => setPicker(false)} />
        )}
      </AnimatePresence>
      <PageWrapper>
      <Header
        titulo={dia?.nombre ?? '...'}
        subtitulo="Ejercicios"
        accent="var(--green)"
        breadcrumbs={[
          { label: 'Programas', onClick: () => navigate('/programas') },
          { label: programaNombre || '...', onClick: () => navigate(`/programas/${programaId}`) },
        ]}
        onBack={() => navigate(`/programas/${programaId}`)}
        onAdd={() => setPicker(true)}
      />

      {cargando ? (
        <ListSkeleton height={120} />
      ) : errorCarga ? (
        <ErrorState mensaje="No se pudo cargar el día." onRetry={cargar} />
      ) : ejercicios.length === 0 ? (
        <EmptyState mensaje="Este día no tiene ejercicios" icon={Dumbbell} sub="Agregá los ejercicios que vas a hacer" action={{ label: 'Agregar ejercicio', onClick: () => setPicker(true) }} />
      ) : (
        <DnDList
          items={ejercicios}
          onReorder={async (reordenados) => {
            setEjercicios(reordenados)
            await reordenarEjercicios(reordenados.map(({ id, orden }) => ({ id, orden })))
          }}
          renderItem={(e, i) => ({ dragHandleProps }) => (
            <motion.div
              style={s.card}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
              layout
            >
              <div style={s.cardTop}>
                <span style={s.dragHandle} {...dragHandleProps}><GripVertical size={16} /></span>
                <span style={s.cardNum}>{String(i + 1).padStart(2, '0')}</span>
                <Badge color="green">{e.grupoMuscular}</Badge>
              </div>
              <span style={s.cardNombre}>{e.nombre}</span>
              <div style={s.cardSeriesWrap}>
                <div style={s.serieBadge}>
                  <span style={s.serieNum} className="num">{e.seriesEsperadas}</span>
                  <span style={s.serieTxt}>series</span>
                </div>
                <span style={s.serieX}>×</span>
                <div style={s.serieBadge}>
                  <span style={s.serieNum} className="num">{e.repsEsperadas}</span>
                  <span style={s.serieTxt}>reps</span>
                </div>
              </div>
              <div style={s.acciones}>
                <motion.button style={s.accionBtn} onClick={() => abrirEditar(e)} whileTap={{ scale: 0.96 }}>
                  <Pencil size={14} /><span>Editar</span>
                </motion.button>
                <motion.button style={{ ...s.accionBtn, ...s.accionEliminar }} onClick={() => eliminar(e)} whileTap={{ scale: 0.96 }}>
                  <Trash2 size={14} /><span>Eliminar</span>
                </motion.button>
              </div>
            </motion.div>
          )}
          style={s.lista}
        />
      )}

      <Modal open={!!editando} onClose={() => setEditando(null)}>
        <h2 style={s.modalTitulo}>{editando?.nombre}</h2>
        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Series</label>
            <input style={s.inputNum} type="number" inputMode="numeric" min="1" value={editSeries} onChange={e => setEditSeries(e.target.value)} onKeyDown={e => e.key === 'Enter' && guardarEdicion()} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Reps</label>
            <input style={s.inputNum} type="number" inputMode="numeric" min="1" value={editReps} onChange={e => setEditReps(e.target.value)} onKeyDown={e => e.key === 'Enter' && guardarEdicion()} />
          </div>
        </div>
        {errorMsg && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>{errorMsg}</p>}
        <div style={s.modalBtns}>
          <motion.button style={s.cancelBtn} onClick={() => setEditando(null)} whileTap={{ scale: 0.97 }}>Cancelar</motion.button>
          <motion.button style={s.saveBtn} onClick={guardarEdicion} whileTap={{ scale: 0.97 }}>Guardar</motion.button>
        </div>
      </Modal>
    </PageWrapper>
    </>
  )
}

const s = {
  dragHandle: {
    color: 'var(--text-dim)',
    cursor: 'grab', padding: '4px', flexShrink: 0,
    touchAction: 'none', display: 'flex', alignItems: 'center',
  },
  lista: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 14px 0' },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: '1px solid var(--highlight)',
    borderRadius: 'var(--r-lg)',
    padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '10px',
    boxShadow: 'var(--shadow-sm)',
  },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardNum: { fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.08em' },
  cardNombre: { fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardSeriesWrap: { display: 'flex', alignItems: 'center', gap: '10px' },
  serieBadge: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '6px 14px',
    background: 'var(--bg-input)',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    borderTop: '1px solid var(--highlight)',
  },
  serieNum: { fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' },
  serieTxt: { fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 },
  serieX: { color: 'var(--text-dim)', fontSize: '0.9rem' },
  acciones: { display: 'flex', gap: '8px' },
  accionBtn: { flex: 1, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '0.88rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  accionEliminar: { color: 'var(--danger)', background: 'var(--danger-bg)', borderColor: 'rgba(255,107,107,0.18)' },
  modalTitulo: { margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.01em' },
  row: { display: 'flex', gap: '10px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  label: { fontSize: '0.78rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 },
  inputNum: { padding: '14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderTop: '1px solid var(--highlight)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '1.6rem', fontWeight: 700, outline: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums' },
  modalBtns: { display: 'flex', gap: '10px' },
  cancelBtn: { flex: 1, padding: '14px', background: 'var(--bg-input)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: '0.95rem' },
  saveBtn: { flex: 1, padding: '14px', background: 'var(--green-grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.95rem', fontWeight: 700, boxShadow: '0 6px 18px rgba(12, 122, 95, 0.35)' },
}
