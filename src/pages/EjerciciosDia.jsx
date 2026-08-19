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
import SwipeToDelete from '../components/SwipeToDelete'
import PullToRefresh from '../components/PullToRefresh'
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
    } catch (e) {
      console.error(e)
      show({ message: 'No se pudo agregar el ejercicio. Intentá de nuevo.', variant: 'error' })
    }
    cargar()
  }

  function abrirEditar(e) {
    setEditando(e)
    setEditSeries(String(e.seriesEsperadas))
    setEditReps(String(e.repsEsperadas))
  }

  async function guardarEdicion() {
    const seriesNum = Number(editSeries)
    const repsNum = Number(editReps)
    if (!editReps || !editSeries || Number.isNaN(seriesNum) || Number.isNaN(repsNum) || seriesNum < 1 || repsNum < 1) { setErrorMsg('Series y reps deben ser mayores a 0'); return }
    setErrorMsg('')
    try {
      await editarEjercicioDia(editando.id, { nombre: editando.nombre, seriesEsperadas: seriesNum, repsEsperadas: repsNum })
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
      <PullToRefresh onRefresh={cargar}>
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
            const anterior = ejercicios
            setEjercicios(reordenados)
            try {
              await reordenarEjercicios(reordenados.map(({ id, orden }) => ({ id, orden })))
            } catch (e) {
              console.error(e)
              setEjercicios(anterior)
              show({ message: 'No se pudo guardar el orden. Intentá de nuevo.', variant: 'error' })
            }
          }}
          renderItem={(e, i) => ({ dragHandleProps }) => (
            <SwipeToDelete onDelete={() => eliminar(e)}>
              <motion.div
                className="card ejercicios-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                layout
              >
                <div className="ejercicios-card-top">
                  <span className="crud-drag-handle" data-dnd-handle {...dragHandleProps}><GripVertical size={16} /></span>
                  <span className="ejercicios-card-num">{String(i + 1).padStart(2, '0')}</span>
                  <Badge color="green">{e.grupoMuscular}</Badge>
                </div>
                <span className="ejercicios-card-nombre">{e.nombre}</span>
                <div className="ejercicios-series-wrap">
                  <div className="ejercicios-serie-badge">
                    <span className="ejercicios-serie-num num">{e.seriesEsperadas}</span>
                    <span className="ejercicios-serie-txt">series</span>
                  </div>
                  <span className="ejercicios-serie-x">×</span>
                  <div className="ejercicios-serie-badge">
                    <span className="ejercicios-serie-num num">{e.repsEsperadas}</span>
                    <span className="ejercicios-serie-txt">reps</span>
                  </div>
                </div>
                <div className="crud-acciones" data-skip-swipe>
                  <motion.button className="crud-accion-btn" onClick={() => abrirEditar(e)} whileTap={{ scale: 0.96 }}>
                    <Pencil size={14} /><span>Editar</span>
                  </motion.button>
                  <motion.button className="crud-accion-btn crud-accion-eliminar" onClick={() => eliminar(e)} whileTap={{ scale: 0.96 }}>
                    <Trash2 size={14} /><span>Eliminar</span>
                  </motion.button>
                </div>
              </motion.div>
            </SwipeToDelete>
          )}
          className="crud-lista"
        />
      )}

      <Modal open={!!editando} onClose={() => setEditando(null)}>
        <h2 className="crud-modal-titulo">{editando?.nombre}</h2>
        <div className="ejercicios-modal-row">
          <div className="ejercicios-modal-field">
            <label className="ejercicios-modal-label">Series</label>
            <input className="ejercicios-modal-input-num" type="number" inputMode="numeric" min="1" value={editSeries} onChange={e => setEditSeries(e.target.value)} onKeyDown={e => e.key === 'Enter' && guardarEdicion()} />
          </div>
          <div className="ejercicios-modal-field">
            <label className="ejercicios-modal-label">Reps</label>
            <input className="ejercicios-modal-input-num" type="number" inputMode="numeric" min="1" value={editReps} onChange={e => setEditReps(e.target.value)} onKeyDown={e => e.key === 'Enter' && guardarEdicion()} />
          </div>
        </div>
        {errorMsg && <p className="crud-error-msg">{errorMsg}</p>}
        <div className="crud-modal-btns">
          <motion.button className="crud-cancel-btn" onClick={() => setEditando(null)} whileTap={{ scale: 0.97 }}>Cancelar</motion.button>
          <motion.button className="btn btn-primary-green btn-lg crud-save-btn" onClick={guardarEdicion} whileTap={{ scale: 0.97 }}>Guardar</motion.button>
        </div>
      </Modal>
      </PullToRefresh>
    </PageWrapper>
    </>
  )
}
