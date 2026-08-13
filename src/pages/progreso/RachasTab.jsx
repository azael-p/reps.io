import { motion } from 'motion/react'
import { EmptyState } from '../../components/ui'

export default function RachasTab({ resumenGlobal, streaks }) {
  return (
    <div className="progreso-rachas-wrap">
      {!resumenGlobal ? (
        <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
          <span className="spinner" style={{ color: 'var(--orange)' }} />
        </div>
      ) : streaks.actual === 0 && streaks.maxima === 0 ? (
        <EmptyState mensaje="Entrená para empezar a generar rachas." icon="🔥" />
      ) : (
        <>
          <motion.div
            className="progreso-streak-card"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className="progreso-streak-num-wrap">
              <motion.span
                className="progreso-streak-num"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
              >
                {streaks.actual}
              </motion.span>
              <span className="progreso-streak-label">días seguidos</span>
            </div>
            <div className="progreso-streak-fire">🔥</div>
          </motion.div>

          <motion.div
            className="progreso-streak-meta"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <span className="progreso-streak-meta-num">{streaks.maxima}</span>
            <span className="progreso-streak-meta-label">récord de racha</span>
          </motion.div>
        </>
      )}
    </div>
  )
}
