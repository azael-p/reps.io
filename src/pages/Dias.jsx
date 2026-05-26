import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { getDias, crearDia, editarDia, eliminarDia, reordenarDias } from '../firebase/dias'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { Header, Modal, ListSkeleton, EmptyState, PageWrapper, ConfirmDialog } from '../components/ui'
import DnDList from '../components/DnDList'
import { useDesktop } from '../hooks/useDesktop'

export default function Dias() {
  const isDesktop = useDesktop()
  const { programaId } = useParams()
  const navigate = useNavigate()
  const [programa, setPrograma] = useState(null)
  const [dias, setDias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [confirmData, setConfirmData] = useState(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const cargar = useCallback(async () => {
    try {
      const [snap, data] = await Promise.all([
        getDoc(doc(db, 'programas', programaId)),
        getDias(programaId),
      ])
      if (!snap.exists()) { navigate('/programas'); return }
      setPrograma({ id: snap.id, ...snap.data() })
      setDias(data)
    } catch (e) { console.error(e) }
    setCargando(false)
  }, [programaId, navigate])

  useEffect(() => { setCargando(true); cargar() }, [cargar]) // eslint-disable-line

  function abrirCrear() { setNombre(''); setModal('crear') }
  function abrirEditar(d) { setNombre(d.nombre); setModal(d) }

  async function guardar() {
    if (!nombre.trim()) { setErrorMsg('El nombre es obligatorio'); return }
    setErrorMsg('')
    setGuardando(true)
    try {
      if (modal === 'crear') await crearDia(programaId, nombre.trim(), dias.length)
      else await editarDia(modal.id, nombre.trim())
      setModal(null)
    } catch (e) { console.error(e); setErrorMsg('Error al guardar. Intentá de nuevo.') }
    setGuardando(false)
    cargar()
  }

  function eliminar(d) {
    setConfirmData({
      titulo: `¿Eliminar "${d.nombre}"?`,
      descripcion: 'Se eliminarán también todos sus ejercicios. Esta acción no se puede deshacer.',
      icon: '🗑️',
      onConfirm: async () => {
        await eliminarDia(d.id)
        cargar()
      },
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
      ) : dias.length === 0 ? (
        <EmptyState mensaje="Este programa no tiene días" icon="📅" sub="Agregá los días de la semana que entrenás" action={{ label: 'Agregar día', onClick: abrirCrear }} />
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
                <span style={s.cardHint}>Ver ejercicios →</span>
              </div>
              <div style={s.acciones} onClick={e => e.stopPropagation()}>
                <motion.button style={s.accionBtn} onClick={() => abrirEditar(d)} whileTap={{ scale: 0.96 }}>Renombrar</motion.button>
                <motion.button style={{ ...s.accionBtn, ...s.accionEliminar }} onClick={() => eliminar(d)} whileTap={{ scale: 0.96 }}>Eliminar</motion.button>
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
                <span style={s.dragHandle} {...dragHandleProps}>⠿</span>
                <div style={{ flex: 1 }}>
                  <span style={s.cardOrden}>Día {i + 1}</span>
                  <span style={s.cardNombre}>{d.nombre}</span>
                </div>
                <span style={s.cardHint}>Ver ejercicios →</span>
              </div>
              <div style={s.acciones} onClick={e => e.stopPropagation()}>
                <motion.button style={s.accionBtn} onClick={() => abrirEditar(d)} whileTap={{ scale: 0.96 }}>Renombrar</motion.button>
                <motion.button style={{ ...s.accionBtn, ...s.accionEliminar }} onClick={() => eliminar(d)} whileTap={{ scale: 0.96 }}>Eliminar</motion.button>
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

      <ConfirmDialog open={!!confirmData} data={confirmData} onClose={() => setConfirmData(null)} />
    </PageWrapper>
  )
}

const s = {
  dragHandle: {
    fontSize: '1.1rem', color: 'var(--text-dim)',
    cursor: 'grab', padding: '4px', flexShrink: 0,
    touchAction: 'none',
  },
  lista: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 14px 0' },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '12px',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'pointer',
  },
  cardMain: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  cardOrden: { display: 'block', fontSize: '0.68rem', color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' },
  cardNombre: { fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardHint: { fontSize: '0.82rem', color: 'var(--green)', flexShrink: 0 },
  acciones: { display: 'flex', gap: '8px' },
  accionBtn: { flex: 1, padding: '14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '0.9rem', fontWeight: 500 },
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
