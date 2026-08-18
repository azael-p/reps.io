import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { getDias, crearDia, editarDia, marcarDiaParaEliminar, desmarcarDiaParaEliminar, eliminarDiaDefinitivo, reordenarDias } from '../firebase/dias'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { Header, Modal, ListSkeleton, EmptyState, ErrorState, PageWrapper } from '../components/ui'
import { useToast } from '../components/Toast'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import { useEliminarConUndo } from '../hooks/useEliminarConUndo'
import DnDList from '../components/DnDList'
import { useDesktop } from '../hooks/useDesktop'
import { GripVertical, Pencil, Trash2, ChevronRight, CalendarDays } from 'lucide-react'

export default function Dias() {
  const isDesktop = useDesktop()
  const { programaId } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const [programa, setPrograma] = useState(null)
  const [dias, setDias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [errorCarga, setErrorCarga] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [snap, data] = await Promise.all([
        getDoc(doc(db, 'programas', programaId)),
        getDias(programaId),
      ])
      if (!snap.exists()) { navigate('/programas'); return }
      setPrograma({ id: snap.id, ...snap.data() })
      setDias(data)
      setErrorCarga(false)
    } catch (e) { console.error(e); setErrorCarga(true) }
    setCargando(false)
  }, [programaId, navigate])

  useEffect(() => { cargar() }, [cargar])

  function abrirCrear() { setNombre(''); setModal('crear') }
  useKeyboardShortcut('n', abrirCrear, [])

  function abrirEditar(d) { setNombre(d.nombre); setModal(d) }

  async function guardar() {
    if (!nombre.trim()) { setErrorMsg('El nombre es obligatorio'); return }
    setErrorMsg('')
    setGuardando(true)
    try {
      if (modal === 'crear') {
        await crearDia(programaId, nombre.trim(), dias.length)
        show({ message: 'Día creado', variant: 'success' })
      } else {
        await editarDia(modal.id, nombre.trim())
        show({ message: 'Día actualizado', variant: 'success' })
      }
      setModal(null)
    } catch (e) { console.error(e); setErrorMsg('Error al guardar. Intentá de nuevo.') }
    setGuardando(false)
    cargar()
  }

  const eliminarConUndo = useEliminarConUndo({
    marcar: marcarDiaParaEliminar,
    desmarcar: desmarcarDiaParaEliminar,
    eliminarDefinitivo: eliminarDiaDefinitivo,
  })

  function eliminar(d) {
    eliminarConUndo(d, {
      mensaje: `"${d.nombre}" eliminado`,
      onOptimista: () => setDias(prev => prev.filter(dia => dia.id !== d.id)),
      onRecargar: cargar,
    })
  }

  return (
    <PageWrapper>
      <Header
        titulo={programa?.nombre ?? '...'}
        subtitulo="Programa"
        accent="var(--green)"
        breadcrumbs={[{ label: 'Programas', onClick: () => navigate('/programas') }]}
        onBack={() => navigate('/programas')}
        onAdd={abrirCrear}
      />

      {cargando ? (
        <ListSkeleton />
      ) : errorCarga ? (
        <ErrorState mensaje="No se pudo cargar el programa." onRetry={cargar} />
      ) : dias.length === 0 ? (
        <EmptyState mensaje="Este programa no tiene días" icon={CalendarDays} sub="Agregá los días de la semana que entrenás" action={{ label: 'Agregar día', onClick: abrirCrear }} />
      ) : isDesktop ? (
        <div className="crud-desktop-grid">
          {dias.map((d, i) => (
            <motion.div
              key={d.id}
              className="crud-card"
              onClick={() => navigate(`/programas/${programaId}/${d.id}`)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.05, type: 'spring', stiffness: 200, damping: 22 }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
            >
              <div className="crud-card-main">
                <div style={{ flex: 1 }}>
                  <span className="crud-card-eyebrow">Día {i + 1}</span>
                  <span className="crud-card-nombre">{d.nombre}</span>
                </div>
                <ChevronRight size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
              </div>
              <div className="crud-acciones" onClick={e => e.stopPropagation()}>
                <motion.button className="crud-accion-btn" onClick={() => abrirEditar(d)} whileTap={{ scale: 0.96 }}>
                  <Pencil size={14} /><span>Renombrar</span>
                </motion.button>
                <motion.button className="crud-accion-btn crud-accion-eliminar" onClick={() => eliminar(d)} whileTap={{ scale: 0.96 }}>
                  <Trash2 size={14} /><span>Eliminar</span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <DnDList
          items={dias}
          onReorder={async (reordenados) => {
            const anterior = dias
            setDias(reordenados)
            try {
              await reordenarDias(reordenados.map(({ id, orden }) => ({ id, orden })))
            } catch (e) {
              console.error(e)
              setDias(anterior)
              show({ message: 'No se pudo guardar el orden. Intentá de nuevo.', variant: 'error' })
            }
          }}
          renderItem={(d, i) => ({ dragHandleProps }) => (
            <motion.div
              className="crud-card"
              onClick={() => navigate(`/programas/${programaId}/${d.id}`)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
              layout
            >
              <div className="crud-card-main">
                <span className="crud-drag-handle" {...dragHandleProps}><GripVertical size={16} /></span>
                <div style={{ flex: 1 }}>
                  <span className="crud-card-eyebrow">Día {i + 1}</span>
                  <span className="crud-card-nombre">{d.nombre}</span>
                </div>
                <ChevronRight size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
              </div>
              <div className="crud-acciones" onClick={e => e.stopPropagation()}>
                <motion.button className="crud-accion-btn" onClick={() => abrirEditar(d)} whileTap={{ scale: 0.96 }}>
                  <Pencil size={14} /><span>Renombrar</span>
                </motion.button>
                <motion.button className="crud-accion-btn crud-accion-eliminar" onClick={() => eliminar(d)} whileTap={{ scale: 0.96 }}>
                  <Trash2 size={14} /><span>Eliminar</span>
                </motion.button>
              </div>
            </motion.div>
          )}
          className="crud-lista"
        />
      )}

      <Modal open={!!modal} onClose={() => setModal(null)}>
        <h2 className="crud-modal-titulo">{modal === 'crear' ? 'Nuevo día' : 'Editar día'}</h2>
        <input
          className="crud-modal-input"
          placeholder='Ej: "Día 1 - Piernas"'
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && guardar()}
          autoFocus
        />
        {errorMsg && <p className="crud-error-msg">{errorMsg}</p>}
        <div className="crud-modal-btns">
          <motion.button className="crud-cancel-btn" onClick={() => setModal(null)} whileTap={{ scale: 0.97 }}>Cancelar</motion.button>
          <motion.button
            className="crud-save-btn"
            style={{ opacity: !nombre.trim() || guardando ? 0.5 : 1 }}
            onClick={guardar}
            disabled={!nombre.trim() || guardando}
            whileTap={{ scale: 0.97 }}
          >
            {guardando ? <span className="spinner" /> : 'Guardar'}
          </motion.button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
