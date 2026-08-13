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
    <div className="timer-activo-page" style={{ '--fondo': fondo, '--acento': acento }}>
      {/* Fase label */}
      <AnimatePresence mode="sync">
        <motion.div
          key={fase}
          className="timer-activo-fase-label"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
        >
          {LABEL_FASE[fase]}
        </motion.div>
      </AnimatePresence>

      {/* Countdown */}
      <div className="timer-activo-centro-wrap">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${fase}-${segundosRestantes > 0 ? 'tick' : 'zero'}`}
            className="timer-activo-countdown"
            initial={{ opacity: 0.6, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            {formatSeg(segundosRestantes)}
          </motion.div>
        </AnimatePresence>

        {(fase === 'trabajo' || fase === 'descanso') && (
          <div className="timer-activo-sets-info">
            Set <span className="timer-activo-sets-info-num">{setActual}</span> de {config.sets}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="timer-activo-botones">
        <motion.button
          className="timer-activo-btn-principal"
          onClick={pausado ? onReanudar : onPausar}
          whileTap={{ scale: 0.97 }}
        >
          {pausado ? 'REANUDAR' : 'PAUSAR'}
        </motion.button>

        <div className="timer-activo-botones-fila">
          <motion.button
            className="timer-activo-btn-secundario"
            onClick={onSaltar}
            whileTap={{ scale: 0.97 }}
          >
            SALTAR →
          </motion.button>

          <div className="timer-activo-terminar-wrap">
            <motion.button
              className="timer-activo-btn-secundario timer-activo-btn-terminar"
              onPointerDown={iniciarLongPress}
              onPointerUp={cancelarLongPress}
              onPointerLeave={cancelarLongPress}
              onPointerCancel={cancelarLongPress}
              onContextMenu={(e) => e.preventDefault()}
              whileTap={{ scale: 0.97 }}
            >
              {presionando ? 'Soltar...' : 'TERMINAR'}
              {presionando && (
                <div
                  className="timer-activo-progress-bar"
                  style={{ width: `${progresoTerminar * 100}%` }}
                />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
