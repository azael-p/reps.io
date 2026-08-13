import { motion, AnimatePresence } from 'motion/react'
import { CornerUpLeft } from 'lucide-react'

const BTN_TAP = { scale: 0.96 }

export default function SerieFooter({
  footerClassName, onCompletar, repsHechas, guardando, celebrar,
  esUltimaSerie, esUltimoEjercicio, serieActual, hayHistorial, onVolver,
}) {
  return (
    <div className={footerClassName}>
      <motion.button
        className="sa-completar-btn"
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
          <motion.button className="sa-volver-btn" onClick={onVolver} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }} whileTap={BTN_TAP}>
            <CornerUpLeft size={15} style={{ flexShrink: 0 }} /> Corregir serie anterior
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
