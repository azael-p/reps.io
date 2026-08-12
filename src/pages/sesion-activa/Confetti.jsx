import { memo } from 'react'
import { motion } from 'motion/react'

const CONFETTI_COLORS = ['#f0997b', '#5dcaa5', '#85b7eb', '#ffd166']
const CONFETTI_STYLE = {
  position: 'absolute',
  bottom: '120px',
  left: '50%',
  transform: 'translateX(-50%)',
  pointerEvents: 'none',
  zIndex: 99,
}
const CONFETTI_PARTICLE = {
  position: 'absolute',
  width: '8px', height: '8px',
  borderRadius: '2px',
  top: 0, left: 0,
}

export default memo(function Confetti() {
  return (
    <motion.div
      style={CONFETTI_STYLE}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.55 }}
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.span
          key={i}
          style={{ ...CONFETTI_PARTICLE, background: CONFETTI_COLORS[i % 4] }}
          initial={{ x: 0, y: 0, scale: 0 }}
          animate={{
            x: Math.cos((i / 10) * Math.PI * 2) * 90,
            y: Math.sin((i / 10) * Math.PI * 2) * 90 - 30,
            scale: [0, 1, 0],
            rotate: 360,
          }}
          transition={{ duration: 0.6 }}
        />
      ))}
    </motion.div>
  )
})
