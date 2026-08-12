import { motion } from 'motion/react'
import { EmptyState } from '../../components/ui'

export default function RachasTab({ resumenGlobal, streaks }) {
  return (
    <div style={s.rachasWrap}>
      {!resumenGlobal ? (
        <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
          <span className="spinner" style={{ color: 'var(--orange)' }} />
        </div>
      ) : streaks.actual === 0 && streaks.maxima === 0 ? (
        <EmptyState mensaje="Entrená para empezar a generar rachas." icon="🔥" />
      ) : (
        <>
          <motion.div
            style={s.streakCard}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div style={s.streakNumWrap}>
              <motion.span
                style={s.streakNum}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
              >
                {streaks.actual}
              </motion.span>
              <span style={s.streakLabel}>días seguidos</span>
            </div>
            <div style={s.streakFire}>🔥</div>
          </motion.div>

          <motion.div
            style={s.streakMeta}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <span style={s.streakMetaNum}>{streaks.maxima}</span>
            <span style={s.streakMetaLabel}>récord de racha</span>
          </motion.div>
        </>
      )}
    </div>
  )
}

const s = {
  rachasWrap: { padding: '16px' },
  streakCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px',
    padding: '32px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: '1px solid var(--highlight)',
    borderRadius: 'var(--r-xl)',
    boxShadow: 'var(--shadow-md)',
  },
  streakNumWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  streakNum: {
    fontSize: '3.2rem', fontWeight: 800,
    letterSpacing: '-0.04em',
    background: 'linear-gradient(135deg, #f0997b, #ffd166)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  streakLabel: { fontSize: '0.78rem', color: 'var(--text-mute)', fontWeight: 600 },
  streakFire: { fontSize: '2.5rem' },
  streakMeta: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    padding: '20px',
    marginTop: '10px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: '1px solid var(--highlight)',
    borderRadius: 'var(--r-lg)',
    boxShadow: 'var(--shadow-sm)',
  },
  streakMetaNum: { fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' },
  streakMetaLabel: { fontSize: '0.7rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 },
}
