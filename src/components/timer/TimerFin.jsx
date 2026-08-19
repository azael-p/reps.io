import { motion } from 'motion/react'
import { CheckCircle } from 'lucide-react'

function formatTiempo(segundos) {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TimerFin({ setsCompletados, tiempoTotal, onVolver }) {
  return (
    <motion.div
      className="timer-fin-page"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="timer-fin-centro">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        >
          <CheckCircle size={72} color="var(--green)" strokeWidth={1.5} />
        </motion.div>
        <motion.h1
          className="timer-fin-titulo"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          ¡Listo!
        </motion.h1>

        <motion.div
          className="card timer-fin-stats"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="timer-fin-stat">
            <span className="timer-fin-stat-val num">{formatTiempo(tiempoTotal)}</span>
            <span className="timer-fin-stat-label">Tiempo total</span>
          </div>
          <div className="timer-fin-divider" />
          <div className="timer-fin-stat">
            <span className="timer-fin-stat-val num">{setsCompletados}</span>
            <span className="timer-fin-stat-label">Sets completados</span>
          </div>
        </motion.div>
      </div>

      <motion.button
        className="btn btn-primary-green timer-fin-btn"
        onClick={onVolver}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        whileTap={{ scale: 0.97 }}
      >
        Volver a configuración
      </motion.button>
    </motion.div>
  )
}
