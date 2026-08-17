import { motion } from 'motion/react'
import { Modal } from '../../components/ui'

export default function PesoModal({
  open, onClose, pesoInput, setPesoInput, errorPeso, onGuardar,
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="progreso-modal-titulo">Registrar peso</h2>
      <div className="progreso-peso-modal-row">
        <input
          type="text"
          inputMode="decimal"
          className="progreso-peso-modal-input"
          placeholder="Ej: 78"
          value={pesoInput}
          onChange={e => setPesoInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onGuardar()}
          autoFocus
        />
        <span className="progreso-peso-modal-kg">kg</span>
      </div>
      {errorPeso && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '0 0 12px' }} role="alert">{errorPeso}</p>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <motion.button className="progreso-cancel-btn" onClick={onClose} whileTap={{ scale: 0.97 }}>
          Cancelar
        </motion.button>
        <motion.button
          className="progreso-save-btn"
          style={{ opacity: !pesoInput.trim() ? 0.5 : 1 }}
          onClick={onGuardar}
          disabled={!pesoInput.trim()}
          whileTap={{ scale: 0.97 }}
        >
          Guardar
        </motion.button>
      </div>
    </Modal>
  )
}
