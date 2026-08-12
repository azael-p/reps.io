import { motion } from 'motion/react'
import { Modal } from '../../components/ui'

export default function PesoModal({
  open, onClose, pesoInput, setPesoInput, errorPeso, guardandoPeso, onGuardar,
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <h2 style={s.modalTitulo}>Registrar peso</h2>
      <div style={s.pesoModalRow}>
        <input
          type="number"
          style={s.pesoModalInput}
          placeholder="Ej: 78"
          value={pesoInput}
          onChange={e => setPesoInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onGuardar()}
          autoFocus
          min="20"
          max="300"
        />
        <span style={s.pesoModalKg}>kg</span>
      </div>
      {errorPeso && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '0 0 12px' }} role="alert">{errorPeso}</p>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <motion.button style={s.cancelBtn} onClick={onClose} whileTap={{ scale: 0.97 }}>
          Cancelar
        </motion.button>
        <motion.button
          style={{ ...s.saveBtn, opacity: !pesoInput.trim() || guardandoPeso ? 0.5 : 1 }}
          onClick={onGuardar}
          disabled={!pesoInput.trim() || guardandoPeso}
          whileTap={{ scale: 0.97 }}
        >
          {guardandoPeso ? <span className="spinner" /> : 'Guardar'}
        </motion.button>
      </div>
    </Modal>
  )
}

const s = {
  modalTitulo: { margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.01em' },
  pesoModalRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  pesoModalInput: {
    flex: 1, padding: '14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text)', fontSize: '1.1rem',
    outline: 'none',
  },
  pesoModalKg: { fontSize: '1rem', color: 'var(--text-mute)', fontWeight: 600, flexShrink: 0 },
  cancelBtn: { flex: 1, padding: '14px', background: 'var(--bg-input)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: '0.95rem' },
  saveBtn: { flex: 1, padding: '14px', background: 'var(--blue-grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(13, 83, 150, 0.35)' },
}
