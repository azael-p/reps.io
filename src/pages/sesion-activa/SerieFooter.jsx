import { motion, AnimatePresence } from 'motion/react'
import { CornerUpLeft } from 'lucide-react'

const BTN_TAP = { scale: 0.96 }

export default function SerieFooter({
  footerStyle, onCompletar, repsHechas, guardando, celebrar,
  esUltimaSerie, esUltimoEjercicio, serieActual, hayHistorial, onVolver,
}) {
  return (
    <div style={footerStyle}>
      <motion.button
        style={s.completarBtn}
        onClick={onCompletar}
        disabled={!repsHechas || guardando}
        whileTap={!repsHechas || guardando ? {} : { scale: 0.97 }}
        animate={celebrar ? { scale: [1, 1.04, 1] } : {}}
        transition={{ duration: 0.35 }}
      >
        {guardando ? <span className="spinner" /> : esUltimaSerie && esUltimoEjercicio ? 'Finalizar entrenamiento ✓' : esUltimaSerie ? 'Siguiente ejercicio →' : `Completar serie ${serieActual} →`}
      </motion.button>
      <AnimatePresence>
        {hayHistorial && (
          <motion.button style={s.volverBtn} onClick={onVolver} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }} whileTap={BTN_TAP}>
            <CornerUpLeft size={15} style={{ flexShrink: 0 }} /> Corregir serie anterior
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

const s = {
  completarBtn: {
    width: '100%', padding: '16px',
    background: 'var(--orange-grad)',
    color: '#fff', border: 'none',
    borderRadius: 'var(--r-lg)',
    fontSize: '1.05rem', fontWeight: 700,
    boxShadow: '0 14px 32px rgba(199, 90, 48, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    letterSpacing: '-0.01em',
  },
  volverBtn: {
    width: '100%', padding: '14px',
    marginTop: '8px',
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    borderRadius: 'var(--r-lg)',
    fontSize: '0.92rem', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  },
}
