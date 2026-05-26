import { useRegisterSW } from 'virtual:pwa-register/react'
import { motion, AnimatePresence } from 'motion/react'

export default function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          style={s.banner}
          initial={{ y: -72, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -72, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <span style={s.text}>Nueva versión disponible</span>
          <motion.button
            style={s.btn}
            onClick={() => updateServiceWorker(true)}
            whileTap={{ scale: 0.94 }}
          >
            Actualizar
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const s = {
  banner: {
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    background: 'var(--orange-grad)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: 'calc(env(safe-area-inset-top) + 10px) 16px 10px',
    zIndex: 200,
    boxShadow: '0 4px 20px rgba(199, 90, 48, 0.4)',
  },
  text: {
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  btn: {
    background: 'rgba(255,255,255,0.25)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '20px',
    padding: '7px 16px',
    fontSize: '0.85rem',
    fontWeight: 700,
    flexShrink: 0,
  },
}
