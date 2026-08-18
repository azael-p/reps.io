import { motion, AnimatePresence } from 'motion/react'
import { StickyNote } from 'lucide-react'
import ReferenciaCard from './ReferenciaCard'

export default function EjercicioInfo({
  ejIdx, serieIdx, ejercicio, serieActual, totalSeries,
  tabRef, setTabRef, refAnterior, refPR,
  mostrarNota, setMostrarNota,
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${ejIdx}-${serieIdx}`}
        className="sa-ejercicio-info"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.3 }}
      >
        <div className="sa-titulo-row">
          <h1 className="sa-ejercicio-nombre">{ejercicio.nombre}</h1>
          <span className="sa-ejercicio-grupo">{ejercicio.grupoMuscular}</span>
          <motion.button
            type="button"
            className={`sa-nota-icon-btn ${mostrarNota ? 'sa-nota-icon-btn--activa' : ''}`}
            onClick={() => setMostrarNota(m => !m)}
            aria-label={mostrarNota ? 'Ocultar nota' : 'Agregar nota a esta serie'}
            aria-pressed={mostrarNota}
            whileTap={{ scale: 0.92 }}
          >
            <StickyNote size={18} strokeWidth={1.8} />
          </motion.button>
        </div>
        <div className="sa-serie-row">
          <p className="sa-serie-label" aria-live="polite">
            Serie <strong className="sa-serie-strong">{serieActual}</strong> de {totalSeries}
          </p>
          <div className="sa-serie-dots">
            {Array.from({ length: totalSeries }).map((_, i) => (
              <span
                key={i}
                className={`sa-serie-dot ${i < serieIdx ? 'sa-serie-dot--done' : ''} ${i === serieIdx ? 'sa-serie-dot--active' : ''}`}
              />
            ))}
          </div>
        </div>
        <ReferenciaCard tabRef={tabRef} setTabRef={setTabRef} refAnterior={refAnterior} refPR={refPR} serieActual={serieActual} />
      </motion.div>
    </AnimatePresence>
  )
}
