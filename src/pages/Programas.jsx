import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useUser } from '../context/UserContext'
import { getProgramas, crearPrograma, editarPrograma, marcarParaEliminar, desmarcarParaEliminar, eliminarProgramaDefinitivo, reordenarProgramas } from '../firebase/programas'
import { Header, Modal, ListSkeleton, EmptyState, ErrorState, PageWrapper } from '../components/ui'
import { useToast } from '../components/Toast'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import { useEliminarConUndo } from '../hooks/useEliminarConUndo'
import DnDList from '../components/DnDList'
import SwipeToDelete from '../components/SwipeToDelete'
import PullToRefresh from '../components/PullToRefresh'
import { useDesktop } from '../hooks/useDesktop'
import { GripVertical, Pencil, Trash2, ChevronRight, Layers } from 'lucide-react'

export default function Programas() {
  const isDesktop = useDesktop()
  const { usuario } = useUser()
  const navigate = useNavigate()
  const { show } = useToast()
  const [programas, setProgramas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [errorCarga, setErrorCarga] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setProgramas(await getProgramas(usuario.id))
      setErrorCarga(false)
    } catch (e) { console.error(e); setErrorCarga(true) }
    setCargando(false)
  }, [usuario])

  useEffect(() => { cargar() }, [cargar])

  useKeyboardShortcut('n', abrirCrear, [])

  function abrirCrear() { setNombre(''); setModal('crear') }
  function abrirEditar(p) { setNombre(p.nombre); setModal(p) }

  async function guardar() {
    if (!nombre.trim()) { setErrorMsg('El nombre es obligatorio'); return }
    setErrorMsg('')
    setGuardando(true)
    try {
      if (modal === 'crear') {
        await crearPrograma(usuario.id, nombre.trim())
        show({ message: 'Programa creado', variant: 'success' })
      } else {
        await editarPrograma(modal.id, nombre.trim())
        show({ message: 'Programa actualizado', variant: 'success' })
      }
      setModal(null)
    } catch (e) { console.error(e); setErrorMsg('Error al guardar. Intentá de nuevo.') }
    setGuardando(false)
    cargar()
  }

  const eliminarConUndo = useEliminarConUndo({
    marcar: marcarParaEliminar,
    desmarcar: desmarcarParaEliminar,
    eliminarDefinitivo: eliminarProgramaDefinitivo,
  })

  function eliminar(p) {
    eliminarConUndo(p, {
      mensaje: `"${p.nombre}" eliminado`,
      onOptimista: () => setProgramas(prev => prev.filter(prog => prog.id !== p.id)),
      onRecargar: cargar,
    })
  }

  return (
    <PageWrapper>
      <PullToRefresh onRefresh={cargar}>
      <Header
        titulo="Mis programas"
        subtitulo="Tus rutinas"
        accent="var(--green)"
        onBack={() => navigate('/home')}
        onAdd={abrirCrear}
      />

      {cargando ? (
        <ListSkeleton />
      ) : errorCarga ? (
        <ErrorState mensaje="No se pudieron cargar tus programas." onRetry={cargar} />
      ) : programas.length === 0 ? (
        <EmptyState mensaje="No tenés programas todavía" icon={Layers} sub="Creá tu primera rutina para empezar a entrenar" action={{ label: 'Crear programa', onClick: abrirCrear }} />
      ) : isDesktop ? (
          <div className="crud-desktop-grid crud-desktop-grid--wide">
            {programas.map((p, i) => (
              <motion.div
                key={p.id}
                className="card crud-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.05, type: 'spring', stiffness: 200, damping: 22 }}
                whileHover={{ y: -2, transition: { duration: 0.15 } }}
                onClick={() => navigate(`/programas/${p.id}`)}
              >
                <div className="crud-card-main">
                  <div style={{ flex: 1 }}>
                    <span className="crud-card-eyebrow">Programa</span>
                    <span className="crud-card-nombre">{p.nombre}</span>
                  </div>
                  <ChevronRight size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                </div>
                <div className="crud-acciones" onClick={e => e.stopPropagation()}>
                  <motion.button className="crud-accion-btn" onClick={() => abrirEditar(p)} whileTap={{ scale: 0.96 }} title="Renombrar">
                    <Pencil size={14} /><span>Renombrar</span>
                  </motion.button>
                  <motion.button className="crud-accion-btn crud-accion-eliminar" onClick={() => eliminar(p)} whileTap={{ scale: 0.96 }} title="Eliminar">
                    <Trash2 size={14} /><span>Eliminar</span>
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <DnDList
            items={programas}
            onReorder={async (reordenados) => {
              const anterior = programas
              setProgramas(reordenados)
              try {
                await reordenarProgramas(reordenados.map(({ id, orden }) => ({ id, orden })))
              } catch (e) {
                console.error(e)
                setProgramas(anterior)
                show({ message: 'No se pudo guardar el orden. Intentá de nuevo.', variant: 'error' })
              }
            }}
            renderItem={(p) => ({ dragHandleProps }) => (
              <SwipeToDelete onDelete={() => eliminar(p)} onClick={() => navigate(`/programas/${p.id}`)}>
                <motion.div
                  className="card crud-card"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                  layout
                >
                  <div className="crud-card-main">
                    <span className="crud-drag-handle" data-dnd-handle {...dragHandleProps}><GripVertical size={16} /></span>
                    <div style={{ flex: 1 }}>
                      <span className="crud-card-eyebrow">Programa</span>
                      <span className="crud-card-nombre">{p.nombre}</span>
                    </div>
                    <ChevronRight size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                  </div>
                  <div className="crud-acciones" data-skip-swipe onClick={e => e.stopPropagation()}>
                    <motion.button className="crud-accion-btn" onClick={() => abrirEditar(p)} whileTap={{ scale: 0.96 }}>
                      <Pencil size={14} /><span>Renombrar</span>
                    </motion.button>
                    <motion.button className="crud-accion-btn crud-accion-eliminar" onClick={() => eliminar(p)} whileTap={{ scale: 0.96 }}>
                      <Trash2 size={14} /><span>Eliminar</span>
                    </motion.button>
                  </div>
                </motion.div>
              </SwipeToDelete>
            )}
            className="crud-lista"
          />
      )}

      <Modal open={!!modal} onClose={() => setModal(null)}>
        <h2 className="crud-modal-titulo">{modal === 'crear' ? 'Nuevo programa' : 'Editar programa'}</h2>
        <input
          className="crud-modal-input"
          placeholder="Nombre del programa"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && guardar()}
          autoFocus
        />
        {errorMsg && <p className="crud-error-msg">{errorMsg}</p>}
        <div className="crud-modal-btns">
          <motion.button className="crud-cancel-btn" onClick={() => setModal(null)} whileTap={{ scale: 0.97 }}>Cancelar</motion.button>
          <motion.button
            className="btn btn-primary-green btn-lg crud-save-btn"
            style={{ opacity: !nombre.trim() || guardando ? 0.5 : 1 }}
            onClick={guardar}
            disabled={!nombre.trim() || guardando}
            whileTap={{ scale: 0.97 }}
          >
            {guardando ? <span className="spinner" /> : 'Guardar'}
          </motion.button>
        </div>
      </Modal>
      </PullToRefresh>
    </PageWrapper>
  )
}
