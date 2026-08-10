import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const FONDO = {
  calentamiento: '#2a2218',
  trabajo: '#2a1a1a',
  descanso: '#192130',
  enfriamiento: '#182620',
}

const ACENTO = {
  calentamiento: '#f0c96b',
  trabajo: '#e07060',
  descanso: '#6aa8d0',
  enfriamiento: '#6ab890',
}

const LABEL_FASE = {
  calentamiento: 'CALENTAMIENTO',
  trabajo: 'TRABAJO',
  descanso: 'DESCANSO',
  enfriamiento: 'ENFRIAMIENTO',
}

function formatSeg(s) {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

const LONG_PRESS_MS = 2000

export default function TimerActivo({ fase, segundosRestantes, setActual, config, pausado, onPausar, onReanudar, onSaltar, onTerminar }) {
  const [presionando, setPresionando] = useState(false)
  const [progresoTerminar, setProgresoTerminar] = useState(0)
  const longPressRef = useRef(null)
  const startRef = useRef(null)
  const animFrameRef = useRef(null)

  const acento = ACENTO[fase] ?? '#f0997b'
  const fondo = FONDO[fase] ?? '#1a1a1a'

  const iniciarLongPress = useCallback(() => {
    setPresionando(true)
    startRef.current = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const pct = Math.min(elapsed / LONG_PRESS_MS, 1)
      setProgresoTerminar(pct)
      if (pct >= 1) {
        setPresionando(false)
        setProgresoTerminar(0)
        onTerminar()
        return
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }, [onTerminar])

  const cancelarLongPress = useCallback(() => {
    setPresionando(false)
    setProgresoTerminar(0)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
  }, [])

  return (
    <div style={{ ...s.page, background: fondo }}>
      {/* Fase label */}
      <AnimatePresence mode="sync">
        <motion.div
          key={fase}
          style={{ ...s.faseLabel, color: acento }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
        >
          {LABEL_FASE[fase]}
        </motion.div>
      </AnimatePresence>

      {/* Countdown */}
      <div style={s.centroWrap}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${fase}-${segundosRestantes > 0 ? 'tick' : 'zero'}`}
            style={{ ...s.countdown, color: acento }}
            initial={{ opacity: 0.6, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            {formatSeg(segundosRestantes)}
          </motion.div>
        </AnimatePresence>

        {(fase === 'trabajo' || fase === 'descanso') && (
          <div style={s.setsInfo}>
            Set <span style={{ color: acento, fontWeight: 700 }}>{setActual}</span> de {config.sets}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={s.botones}>
        <motion.button
          style={{ ...s.btnPrincipal, background: acento, color: '#0a0a0c' }}
          onClick={pausado ? onReanudar : onPausar}
          whileTap={{ scale: 0.97 }}
        >
          {pausado ? 'REANUDAR' : 'PAUSAR'}
        </motion.button>

        <div style={s.botonesFila}>
          <motion.button
            style={s.btnSecundario}
            onClick={onSaltar}
            whileTap={{ scale: 0.97 }}
          >
            SALTAR →
          </motion.button>

          <div style={s.terminarWrap}>
            <motion.button
              style={{ ...s.btnSecundario, ...s.btnTerminar }}
              onPointerDown={iniciarLongPress}
              onPointerUp={cancelarLongPress}
              onPointerLeave={cancelarLongPress}
              onPointerCancel={cancelarLongPress}
              whileTap={{ scale: 0.97 }}
            >
              {presionando ? 'Soltar...' : 'TERMINAR'}
              {presionando && (
                <div
                  style={{
                    ...s.progressBar,
                    width: `${progresoTerminar * 100}%`,
                    background: 'rgba(255,107,107,0.6)',
                  }}
                />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    // 64px = BottomNav height; keeps SALTAR/TERMINAR above the nav on mobile
    padding: '0 0 calc(64px + max(12px, env(safe-area-inset-bottom)))',
    paddingTop: 'max(48px, env(safe-area-inset-top))',
    transition: 'background 0.4s ease',
    userSelect: 'none',
  },
  faseLabel: {
    textAlign: 'center',
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '0.18em',
    paddingTop: '8px',
  },
  centroWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  countdown: {
    fontSize: 'clamp(80px, 22vw, 140px)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  },
  setsInfo: {
    fontSize: '1.3rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: '-0.01em',
  },
  botones: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '0 16px',
  },
  btnPrincipal: {
    width: '100%',
    minHeight: '80px',
    borderRadius: 'var(--r-lg)',
    border: 'none',
    fontSize: '1.2rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  botonesFila: {
    display: 'flex',
    gap: '10px',
  },
  btnSecundario: {
    flex: 1,
    minHeight: '80px',
    borderRadius: 'var(--r-lg)',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '0.95rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    fontFamily: 'inherit',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
  },
  btnTerminar: {
    color: 'rgba(255,107,107,0.85)',
  },
  terminarWrap: {
    flex: 1,
    display: 'flex',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '4px',
    borderRadius: '2px',
    transition: 'width 0.05s linear',
  },
}
