import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { getDias, crearDia, editarDia, marcarDiaParaEliminar, desmarcarDiaParaEliminar, eliminarDiaDefinitivo, reordenarDias } from '../firebase/dias'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { Header, Modal, ListSkeleton, EmptyState, ErrorState, PageWrapper } from '../components/ui'
import { useToast } from '../components/Toast'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
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

  async function eliminar(d) {
    try {
      await marcarDiaParaEliminar(d.id)
    } catch (e) {
      console.error(e)
      show({ message: 'No se pudo eliminar. Intentá de nuevo.', variant: 'error' })
      return
    }
    setDias(prev => prev.filter(dia => dia.id !== d.id))
    show({
      message: `"${d.nombre}" eliminado`,
      action: {
        label: 'Deshacer',
        onClick: async () => {
          try {
            await desmarcarDiaParaEliminar(d.id)
          } catch (e) {
            console.error(e)
            show({ message: 'No se pudo restaurar. Intentá de nuevo.', variant: 'error' })
          }
          cargar()
        },
      },
      duration: 5000,
      onTimeout: () => eliminarDiaDefinitivo(d.id),
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
        <div style={s.desktopGrid}>
          {dias.map((d, i) => (
            <motion.div
              key={d.id}
              style={s.card}
              onClick={() => navigate(`/programas/${programaId}/${d.id}`)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 200, damping: 22 }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
            >
              <div style={s.cardMain}>
                <div style={{ flex: 1 }}>
                  <span style={s.cardOrden}>Día {i + 1}</span>
                  <span style={s.cardNombre}>{d.nombre}</span>
                </div>
                <ChevronRight size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
              </div>
              <div style={s.acciones} onClick={e => e.stopPropagation()}>
                <motion.button style={s.accionBtn} onClick={() => abrirEditar(d)} whileTap={{ scale: 0.96 }}>
                  <Pencil size={14} /><span>Renombrar</span>
                </motion.button>
                <motion.button style={{ ...s.accionBtn, ...s.accionEliminar }} onClick={() => eliminar(d)} whileTap={{ scale: 0.96 }}>
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
            setDias(reordenados)
            await reordenarDias(reordenados.map(({ id, orden }) => ({ id, orden })))
          }}
          renderItem={(d, i) => ({ dragHandleProps }) => (
            <motion.div
              style={s.card}
              onClick={() => navigate(`/programas/${programaId}/${d.id}`)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
              layout
            >
              <div style={s.cardMain}>
                <span style={s.dragHandle} {...dragHandleProps}><GripVertical size={16} /></span>
                <div style={{ flex: 1 }}>
                  <span style={s.cardOrden}>Día {i + 1}</span>
                  <span style={s.cardNombre}>{d.nombre}</span>
                </div>
                <ChevronRight size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
              </div>
              <div style={s.acciones} onClick={e => e.stopPropagation()}>
                <motion.button style={s.accionBtn} onClick={() => abrirEditar(d)} whileTap={{ scale: 0.96 }}>
                  <Pencil size={14} /><span>Renombrar</span>
                </motion.button>
                <motion.button style={{ ...s.accionBtn, ...s.accionEliminar }} onClick={() => eliminar(d)} whileTap={{ scale: 0.96 }}>
                  <Trash2 size={14} /><span>Eliminar</span>
                </motion.button>
              </div>
            </motion.div>
          )}
          style={s.lista}
        />
      )}

      <Modal open={!!modal} onClose={() => setModal(null)}>
        <h2 style={s.modalTitulo}>{modal === 'crear' ? 'Nuevo día' : 'Editar día'}</h2>
        <input
          style={s.input}
          placeholder='Ej: "Día 1 - Piernas"'
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && guardar()}
          autoFocus
        />
        {errorMsg && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>{errorMsg}</p>}
        <div style={s.modalBtns}>
          <motion.button style={s.cancelBtn} onClick={() => setModal(null)} whileTap={{ scale: 0.97 }}>Cancelar</motion.button>
          <motion.button
            style={{ ...s.saveBtn, opacity: !nombre.trim() || guardando ? 0.5 : 1 }}
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
    display: 'flex', flexDirection: 'column', gap: '12px',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'pointer',
  },
  cardMain: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  cardOrden: { display: 'block', fontSize: '0.68rem', color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' },
  cardNombre: { fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  acciones: { display: 'flex', gap: '8px' },
  accionBtn: { flex: 1, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '0.88rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  accionEliminar: { color: 'var(--danger)', background: 'var(--danger-bg)', borderColor: 'rgba(255,107,107,0.18)' },
  desktopGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '14px',
    padding: '20px',
  },
  modalTitulo: { margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.01em' },
  input: { padding: '14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '1rem', outline: 'none' },
  modalBtns: { display: 'flex', gap: '10px' },
  cancelBtn: { flex: 1, padding: '14px', background: 'var(--bg-input)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: '0.95rem' },
  saveBtn: { flex: 1, padding: '14px', background: 'var(--green-grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(12, 122, 95, 0.35)' },
}
