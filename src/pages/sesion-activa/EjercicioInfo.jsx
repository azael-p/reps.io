import { motion, AnimatePresence } from 'motion/react'
import { Badge } from '../../components/ui'
import ReferenciaCard from './ReferenciaCard'

export default function EjercicioInfo({
  ejIdx, serieIdx, ejercicio, serieActual, totalSeries,
  tabRef, setTabRef, refAnterior, refPR,
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${ejIdx}-${serieIdx}`}
        style={s.ejercicioInfo}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.3 }}
      >
        <div style={s.tituloRow}>
          <h1 style={s.ejercicioNombre}>{ejercicio.nombre}</h1>
          <Badge color="orange">{ejercicio.grupoMuscular}</Badge>
        </div>
        <div style={s.serieRow}>
          <p style={s.serieLabel} aria-live="polite">
            Serie <strong style={s.serieStrong}>{serieActual}</strong> de {totalSeries}
          </p>
          <div style={s.serieDots}>
            {Array.from({ length: totalSeries }).map((_, i) => (
              <span
                key={i}
                style={{
                  ...s.serieDot,
                  ...(i < serieIdx ? s.serieDotDone : {}),
                  ...(i === serieIdx ? s.serieDotActive : {}),
                }}
              />
            ))}
          </div>
        </div>
        <ReferenciaCard tabRef={tabRef} setTabRef={setTabRef} refAnterior={refAnterior} refPR={refPR} />
      </motion.div>
    </AnimatePresence>
  )
}

const s = {
  ejercicioInfo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  tituloRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  ejercicioNombre: {
    margin: 0, fontSize: '1.55rem', fontWeight: 800,
    lineHeight: 1.15, letterSpacing: '-0.03em',
  },
  serieRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  serieLabel: { margin: 0, color: 'var(--text-mute)', fontSize: '0.95rem' },
  serieStrong: {
    color: 'var(--orange)', fontWeight: 800, fontSize: '1.1em',
  },
  serieDots: { display: 'flex', gap: '6px', alignItems: 'center' },
  serieDot: {
    width: '8px', height: '8px',
    borderRadius: '50%',
    background: 'var(--border-strong)',
    transition: 'background 0.2s, transform 0.2s',
  },
  serieDotDone: {
    background: 'var(--orange)',
    boxShadow: '0 0 6px rgba(240, 153, 123, 0.5)',
  },
  serieDotActive: {
    background: 'var(--orange)',
    transform: 'scale(1.3)',
    boxShadow: '0 0 10px rgba(240, 153, 123, 0.8)',
  },
}
