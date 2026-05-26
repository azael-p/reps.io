import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useUser } from '../context/UserContext'
import { getProgramas, crearPrograma, editarPrograma, eliminarPrograma, reordenarProgramas } from '../firebase/programas'
import { Header, Modal, ListSkeleton, EmptyState, PageWrapper, ConfirmDialog } from '../components/ui'
import DnDList from '../components/DnDList'
import SwipeToDelete from '../components/SwipeToDelete'
import { useDesktop } from '../hooks/useDesktop'

export default function Programas() {
  const isDesktop = useDesktop()
  const { usuario } = useUser()
  const navigate = useNavigate()
  const [programas, setProgramas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [confirmData, setConfirmData] = useState(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const cargar = useCallback(async () => {
    try {
      setProgramas(await getProgramas(usuario.id))
    } catch (e) { console.error(e) }
    setCargando(false)
  }, [usuario])

  useEffect(() => { setCargando(true); cargar() }, [cargar]) // eslint-disable-line

  function abrirCrear() { setNombre(''); setModal('crear') }
  function abrirEditar(p) { setNombre(p.nombre); setModal(p) }

  async function guardar() {
    if (!nombre.trim()) { setErrorMsg('El nombre es obligatorio'); return }
    setErrorMsg('')
    setGuardando(true)
    try {
      if (modal === 'crear') await crearPrograma(usuario.id, nombre.trim())
      else await editarPrograma(modal.id, nombre.trim())
      setModal(null)
    } catch (e) { console.error(e); setErrorMsg('Error al guardar. Intentá de nuevo.') }
    setGuardando(false)
    cargar()
  }

  function eliminar(p) {
    setConfirmData({
      titulo: `¿Eliminar "${p.nombre}"?`,
      descripcion: 'Se eliminarán también todos sus días y ejercicios. Esta acción no se puede deshacer.',
      icon: '🗑️',
      onConfirm: async () => {
        await eliminarPrograma(p.id)
        cargar()
      },
    })
  }

  return (
    <PageWrapper>
      <Header
        titulo="Mis programas"
        subtitulo="Tus rutinas"
        accent="var(--green)"
        onBack={() => navigate('/home')}
        onAdd={abrirCrear}
      />

      {cargando ? (
        <ListSkeleton />
      ) : programas.length === 0 ? (
        <EmptyState mensaje="No tenés programas todavía" icon="📋" sub="Creá tu primera rutina para empezar a entrenar" action={{ label: 'Crear programa', onClick: abrirCrear }} />
      ) : isDesktop ? (
          <div style={s.desktopGrid}>
            {programas.map((p, i) => (
              <motion.div
                key={p.id}
                style={s.card}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 200, damping: 22 }}
                whileHover={{ y: -2, transition: { duration: 0.15 } }}
                onClick={() => navigate(`/programas/${p.id}`)}
              >
                <div style={s.cardMain}>
                  <div style={{ flex: 1 }}>
                    <span style={s.cardLabel}>Programa</span>
                    <span style={s.cardNombre}>{p.nombre}</span>
                  </div>
                  <span style={s.cardHint}>Ver días →</span>
                </div>
                <div style={s.acciones} onClick={e => e.stopPropagation()}>
                  <motion.button style={s.accionBtn} onClick={() => abrirEditar(p)} whileTap={{ scale: 0.96 }}>Renombrar</motion.button>
                  <motion.button style={{ ...s.accionBtn, ...s.accionEliminar }} onClick={() => eliminar(p)} whileTap={{ scale: 0.96 }}>Eliminar</motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <DnDList
            items={programas}
            onReorder={async (reordenados) => {
              setProgramas(reordenados)
              await reordenarProgramas(reordenados.map(({ id, orden }) => ({ id, orden })))
            }}
            renderItem={(p) => ({ dragHandleProps }) => (
              <SwipeToDelete onDelete={() => eliminar(p)} onClick={() => navigate(`/programas/${p.id}`)}>
                <motion.div
                  style={s.card}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                  layout
                >
                  <div style={s.cardMain}>
                    <span style={s.dragHandle} data-dnd-handle {...dragHandleProps}>⠿</span>
                    <div style={{ flex: 1 }}>
                      <span style={s.cardLabel}>Programa</span>
                      <span style={s.cardNombre}>{p.nombre}</span>
                    </div>
                    <span style={s.cardHint}>Ver días →</span>
                  </div>
                  <div style={s.acciones} data-skip-swipe onClick={e => e.stopPropagation()}>
                    <motion.button style={s.accionBtn} onClick={() => abrirEditar(p)} whileTap={{ scale: 0.96 }}>Renombrar</motion.button>
                    <motion.button style={{ ...s.accionBtn, ...s.accionEliminar }} onClick={() => eliminar(p)} whileTap={{ scale: 0.96 }}>Eliminar</motion.button>
                  </div>
                </motion.div>
              </SwipeToDelete>
            )}
            style={s.lista}
          />
      )}

      <Modal open={!!modal} onClose={() => setModal(null)}>
        <h2 style={s.modalTitulo}>{modal === 'crear' ? 'Nuevo programa' : 'Editar programa'}</h2>
        <input
          style={s.input}
          placeholder="Nombre del programa"
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
  cardLabel: { display: 'block', fontSize: '0.68rem', color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' },
  cardNombre: { fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardHint: { fontSize: '0.82rem', color: 'var(--green)', flexShrink: 0 },
  acciones: { display: 'flex', gap: '8px' },
  accionBtn: { flex: 1, padding: '14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '0.9rem', fontWeight: 500 },
  accionEliminar: { color: 'var(--danger)', background: 'var(--danger-bg)', borderColor: 'rgba(255,107,107,0.18)' },
  desktopGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '14px',
    padding: '20px',
  },
  modalTitulo: { margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.01em' },
  input: { padding: '14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '1rem', outline: 'none' },
  modalBtns: { display: 'flex', gap: '10px' },
  cancelBtn: { flex: 1, padding: '14px', background: 'var(--bg-input)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: '0.95rem' },
  saveBtn: { flex: 1, padding: '14px', background: 'var(--green-grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(12, 122, 95, 0.35)' },
}
