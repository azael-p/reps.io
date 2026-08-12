import { motion } from 'motion/react'

export default function HeaderProgreso({ isDesktop, navigate }) {
  return (
    <motion.div
      style={isDesktop ? s.headerDesktop : s.header}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {!isDesktop && (
        <motion.button
          style={s.back}
          onClick={() => navigate('/home')}
          whileTap={{ scale: 0.9, x: -2 }}
          aria-label="Volver al inicio"
        >
          ←
        </motion.button>
      )}
      <div style={s.headerInfo}>
        <p style={s.headerSub}>Estadísticas</p>
        <h1 style={s.titulo}>Mi progreso</h1>
      </div>
    </motion.div>
  )
}

const s = {
  header: {
    display: 'flex', alignItems: 'center',
    padding: '20px 16px 16px',
    paddingTop: 'max(20px, env(safe-area-inset-top))',
    gap: '12px',
    borderBottom: '1px solid var(--border)',
  },
  back: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    width: '44px', height: '44px',
    borderRadius: '12px', fontSize: '1.2rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerSub: { margin: 0, fontSize: '0.7rem', color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' },
  titulo: { margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em' },
  headerDesktop: {
    display: 'flex', alignItems: 'center',
    padding: '32px 40px 24px',
    gap: '12px',
    borderBottom: '1px solid var(--border)',
  },
}
