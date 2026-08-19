import { motion } from 'motion/react'
import { CornerUpLeft } from 'lucide-react'

const BTN_TAP = { scale: 0.96 }

export default function SerieFooter({
  footerClassName, onCompletar, repsHechas, guardando, celebrar,
  esUltimaSerie, esUltimoEjercicio, serieActual, hayHistorial, onVolver,
}) {
  return (
    <div className={footerClassName}>
      <motion.button
        className="btn btn-primary btn-lg sa-completar-btn"
        onClick={onCompletar}
        disabled={!repsHechas || guardando}
        whileTap={!repsHechas || guardando ? {} : { scale: 0.97 }}
        animate={celebrar ? { scale: [1, 1.04, 1] } : {}}
        transition={{ duration: 0.35 }}
      >
        {guardando ? <span className="spinner" /> : esUltimaSerie && esUltimoEjercicio ? 'Finalizar entrenamiento ✓' : esUltimaSerie ? 'Siguiente ejercicio →' : `Completar serie ${serieActual} →`}
      </motion.button>
      {/* El espacio se reserva siempre (visibility, no montaje condicional):
          que el botón aparezca recién en la serie 2 no debe correr el CTA
          principal, que es justo lo que el usuario está por tocar de nuevo. */}
      <motion.button
        className="sa-volver-btn"
        onClick={onVolver}
        style={{ visibility: hayHistorial ? 'visible' : 'hidden' }}
        animate={{ opacity: hayHistorial ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        whileTap={BTN_TAP}
      >
        <CornerUpLeft size={15} style={{ flexShrink: 0 }} /> Corregir serie anterior
      </motion.button>
    </div>
  )
}
