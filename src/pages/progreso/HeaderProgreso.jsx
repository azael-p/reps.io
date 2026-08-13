import { motion } from 'motion/react'

export default function HeaderProgreso({ isDesktop, navigate }) {
  return (
    <motion.div
      className={`progreso-header ${isDesktop ? 'progreso-header--desktop' : ''}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {!isDesktop && (
        <motion.button
          className="progreso-back"
          onClick={() => navigate('/home')}
          whileTap={{ scale: 0.9, x: -2 }}
          aria-label="Volver al inicio"
        >
          ←
        </motion.button>
      )}
      <div className="progreso-header-info">
        <p className="progreso-header-sub">Estadísticas</p>
        <h1 className="progreso-titulo">Mi progreso</h1>
      </div>
    </motion.div>
  )
}
