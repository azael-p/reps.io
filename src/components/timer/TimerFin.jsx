import { motion } from 'motion/react'
import { CheckCircle } from 'lucide-react'

function formatTiempo(segundos) {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TimerFin({ config, setsCompletados, tiempoTotal, onVolver }) {
  return (
    <motion.div
      style={s.page}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div style={s.centro}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        >
          <CheckCircle size={72} color="var(--green)" strokeWidth={1.5} />
        </motion.div>
        <motion.h1
          style={s.titulo}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          ¡Listo!
        </motion.h1>

        <motion.div
          style={s.stats}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div style={s.stat}>
            <span style={s.statVal} className="num">{formatTiempo(tiempoTotal)}</span>
            <span style={s.statLabel}>Tiempo total</span>
          </div>
          <div style={s.divider} />
          <div style={s.stat}>
            <span style={s.statVal} className="num">{setsCompletados}</span>
            <span style={s.statLabel}>Sets completados</span>
          </div>
        </motion.div>
      </div>

      <motion.button
        className="btn btn-primary-green"
        style={s.btn}
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

const s = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '40px 20px max(32px, env(safe-area-inset-bottom))',
    paddingTop: 'max(40px, env(safe-area-inset-top))',
    maxWidth: '540px',
    boxSizing: 'border-box',
  },
  centro: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
  },
  titulo: {
    fontSize: '3rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: '32px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-xl)',
    padding: '24px 20px',
    width: '100%',
    boxSizing: 'border-box',
    justifyContent: 'center',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statVal: {
    fontSize: '2.2rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
  },
  statLabel: {
    fontSize: '0.78rem',
    color: 'var(--text-mute)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  divider: {
    width: '1px',
    height: '48px',
    background: 'var(--border)',
  },
  btn: {
    width: '100%',
    padding: '18px',
    fontSize: '1.05rem',
    borderRadius: 'var(--r-lg)',
  },
}
