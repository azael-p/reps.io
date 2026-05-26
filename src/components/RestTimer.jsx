import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const DURACION_DEFAULT = 180
const CIRCUNFERENCIA = 2 * Math.PI * 54

export default function RestTimer({ onTerminar, onSaltar }) {
  const endTimeRef = useRef(Date.now() + DURACION_DEFAULT * 1000)
  const [, setTick] = useState(0)
  const [skip, setSkip] = useState(false)
  const vibratedRef = useRef(false)
  const wakeLockRef = useRef(null)

  const segundos = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
  const finalizado = segundos === 0

  useEffect(() => {
    if (finalizado) return
    const id = setInterval(() => setTick(t => t + 1), 250)
    return () => clearInterval(id)
  }, [finalizado])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* ignore */ })
    }
  }, [])

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        setTick(t => t + 1)
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return
    if (wakeLockRef.current) return
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      wakeLockRef.current = sentinel
      sentinel.addEventListener('release', () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null
      })
    } catch { /* ignore */ }
  }

  useEffect(() => {
    requestWakeLock()
    return () => {
      const sentinel = wakeLockRef.current
      wakeLockRef.current = null
      if (sentinel) sentinel.release().catch(() => { /* ignore */ })
    }
  }, [])

  useEffect(() => {
    if (!finalizado || vibratedRef.current) return
    vibratedRef.current = true
    try { navigator.vibrate?.([100, 100, 100, 100, 100]) } catch { /* ignore */ }
    if (
      'Notification' in window &&
      Notification.permission === 'granted' &&
      document.visibilityState === 'hidden'
    ) {
      try {
        new Notification('¡Descanso terminado!', {
          body: 'Toca para volver a reps.io',
          tag: 'rest-done',
          vibrate: [200, 100, 200],
        })
      } catch { /* ignore */ }
    }
  }, [finalizado])

  function handleSaltar() {
    setSkip(true)
    setTimeout(onSaltar, 200)
  }

  const progress = (DURACION_DEFAULT - segundos) / DURACION_DEFAULT
  const offset = CIRCUNFERENCIA * (1 - progress)

  const mins = Math.floor(segundos / 60)
  const secs = segundos % 60
  const display = `${mins}:${secs.toString().padStart(2, '0')}`

  return (
    <AnimatePresence>
      <motion.div
        style={s.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => { if (finalizado) onTerminar() }}
      >
        <motion.div
          style={s.card}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          onClick={e => e.stopPropagation()}
        >
          <span style={s.eyebrow}>DESCANSO</span>

          <div style={s.ringWrap}>
            {finalizado && (
              <motion.div
                style={s.glow}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0.4, 0.15, 0.4], scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            <svg style={s.ring} viewBox="0 0 120 120">
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="6"
              />
              <motion.circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke={finalizado ? 'var(--green)' : 'var(--orange)'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRCUNFERENCIA}
                strokeDashoffset={finalizado ? 0 : offset}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dashoffset 0.35s linear, stroke 0.3s ease' }}
              />
            </svg>

            <div style={s.center}>
              <AnimatePresence mode="wait">
                {finalizado ? (
                  <motion.span
                    key="check"
                    style={s.checkIcon}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 18 }}
                  >
                    ✓
                  </motion.span>
                ) : (
                  <motion.span
                    key={display}
                    style={s.tiempo}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    {display}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {finalizado ? (
              <motion.p
                key="done"
                style={s.doneLabel}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                ¡Listo para la siguiente!
              </motion.p>
            ) : (
              <motion.p
                key="rest"
                style={s.restLabel}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                Descansá y preparate
              </motion.p>
            )}
          </AnimatePresence>

          {!skip && (
            <motion.button
              style={finalizado ? s.nextBtn : s.saltarBtn}
              onClick={finalizado ? onTerminar : handleSaltar}
              whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {finalizado ? 'Siguiente ejercicio →' : 'Saltar descanso'}
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'var(--bg-overlay)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 90,
  },
  card: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '16px',
    padding: '28px 40px 28px',
    background: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-xl)',
    boxShadow: 'var(--shadow-lg)',
    position: 'relative',
    minWidth: '260px',
  },
  eyebrow: {
    fontSize: '0.65rem', fontWeight: 700,
    color: 'var(--text-mute)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  ringWrap: {
    position: 'relative',
    width: '172px', height: '172px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    inset: '-8px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, var(--green) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  ring: { width: '172px', height: '172px', display: 'block' },
  center: {
    position: 'absolute',
    inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  },
  tiempo: {
    fontSize: '2.8rem', fontWeight: 800,
    letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums',
    color: 'var(--text)',
  },
  checkIcon: {
    fontSize: '2.6rem', fontWeight: 800,
    color: 'var(--green)',
    lineHeight: 1,
  },
  doneLabel: {
    margin: 0,
    fontSize: '1rem', fontWeight: 700,
    color: 'var(--green)',
    letterSpacing: '-0.01em',
  },
  restLabel: {
    margin: 0,
    fontSize: '0.85rem', fontWeight: 500,
    color: 'var(--text-mute)',
  },
  nextBtn: {
    marginTop: '4px',
    padding: '15px 28px',
    background: 'var(--green-grad)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--r-md)',
    fontSize: '1rem', fontWeight: 700,
    minWidth: '190px',
    letterSpacing: '-0.01em',
  },
  saltarBtn: {
    marginTop: '4px',
    padding: '14px 28px',
    background: 'var(--bg-card)',
    color: 'var(--text-mute)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    fontSize: '0.95rem', fontWeight: 600,
    minWidth: '190px',
  },
}
