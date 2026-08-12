import { motion, AnimatePresence } from 'motion/react'

const INPUT_FOCUS = { borderColor: 'var(--orange)', boxShadow: '0 0 0 4px var(--orange-glow)' }
const BTN_TAP_SMALL = { scale: 0.92 }

export default function SerieForm({
  ejercicio, pesoUsado, setPesoUsado, repsHechas, setRepsHechas, ultimoPeso,
  mostrarNota, setMostrarNota, nota, setNota,
  ejIdx, serieIdx, tabRef, refPR, refAnterior, serieActual,
}) {
  const serieRef = tabRef === 'pr'
    ? refPR?.series?.find(s => s.numeroSerie === serieActual)
    : refAnterior?.series?.find(s => s.numeroSerie === serieActual)

  return (
    <>
      <div style={s.inputs}>
        <div style={s.inputGroup}>
          <label style={s.inputLabel}>Peso (kg)</label>
          <div style={s.stepper}>
            <motion.button style={s.stepperBtn} aria-label="Restar 2,5 kg" onClick={() => setPesoUsado(p => String(Math.round(Math.max(0, (Number(p) || 0) - 2.5) * 10) / 10))} whileTap={BTN_TAP_SMALL}>−</motion.button>
            <motion.input style={s.inputBig} type="number" inputMode="decimal" placeholder={ultimoPeso[ejercicio.id] ? String(ultimoPeso[ejercicio.id]) : ''} value={pesoUsado} onChange={e => setPesoUsado(e.target.value)} aria-label="Peso (kg)" whileFocus={INPUT_FOCUS} />
            <motion.button style={s.stepperBtn} aria-label="Sumar 2,5 kg" onClick={() => setPesoUsado(p => String(Math.round(((Number(p) || 0) + 2.5) * 10) / 10))} whileTap={BTN_TAP_SMALL}>+</motion.button>
          </div>
          {ultimoPeso[ejercicio.id] && !pesoUsado && (
            <p style={s.hintTocable} onClick={() => setPesoUsado(String(ultimoPeso[ejercicio.id]))}>↳ Última vez: {ultimoPeso[ejercicio.id]}kg</p>
          )}
        </div>
        <div style={s.inputGroup}>
          <label style={s.inputLabel}>Reps</label>
          <div style={s.stepper}>
            <motion.button style={s.stepperBtn} aria-label="Restar una repetición" onClick={() => setRepsHechas(r => String(Math.max(1, (Number(r) || ejercicio.repsEsperadas) - 1)))} whileTap={BTN_TAP_SMALL}>−</motion.button>
            <motion.input style={s.inputBig} type="number" inputMode="numeric" placeholder={String(ejercicio.repsEsperadas)} value={repsHechas} onChange={e => setRepsHechas(e.target.value)} aria-label="Repeticiones" whileFocus={INPUT_FOCUS} />
            <motion.button style={s.stepperBtn} aria-label="Sumar una repetición" onClick={() => setRepsHechas(r => String((Number(r) || ejercicio.repsEsperadas) + 1))} whileTap={BTN_TAP_SMALL}>+</motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mostrarNota ? (
          <motion.textarea key="textarea" style={s.notaInput} placeholder="Nota para esta serie..." value={nota} onChange={e => setNota(e.target.value)} rows={2} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} autoFocus />
        ) : (
          <motion.button key="addNoteBtn" style={s.notaBtn} onClick={() => setMostrarNota(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} whileTap={{ scale: 0.97 }}>+ Nota</motion.button>
        )}
      </AnimatePresence>

      {serieRef && (
        <motion.div
          key={`ref-serie-${ejIdx}-${serieIdx}-${tabRef}`}
          style={{ ...s.refSerieCard, ...(tabRef === 'pr' ? s.refSerieCardPR : {}) }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <span style={s.refSerieIcon}>{tabRef === 'pr' ? '🏆' : '🎯'}</span>
          <div style={{ flex: 1 }}>
            <span style={{ ...s.refSerieLabel, ...(tabRef === 'pr' ? { color: 'var(--blue)' } : {}) }}>
              {tabRef === 'pr' ? 'PR personal' : 'Última vez'} — serie {serieActual}
            </span>
            <span style={s.refSerieValor}>
              {serieRef.pesoUsado > 0 ? `${serieRef.pesoUsado} kg` : 'Sin peso'} × {serieRef.repsHechas} reps
            </span>
          </div>
        </motion.div>
      )}
    </>
  )
}

const s = {
  inputs: { display: 'flex', gap: '10px' },
  inputGroup: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  stepper: { display: 'flex', alignItems: 'center', gap: '6px' },
  stepperBtn: {
    width: '44px', height: '44px',
    borderRadius: '12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    fontSize: '1.2rem', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  inputLabel: {
    fontSize: '0.72rem', color: 'var(--text-mute)',
    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700,
  },
  hintTocable: {
    fontSize: '0.78rem', color: 'var(--orange)',
    cursor: 'pointer', fontWeight: 500,
    margin: 0,
  },
  inputBig: {
    padding: '16px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: '1px solid var(--highlight)',
    borderRadius: 'var(--r-lg)',
    color: 'var(--text)',
    fontSize: '1.6rem', fontWeight: 800,
    outline: 'none', textAlign: 'center',
    width: '100%', boxSizing: 'border-box',
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums',
  },
  notaBtn: {
    background: 'transparent',
    border: '1px dashed var(--border-strong)',
    color: 'var(--text-dim)',
    padding: '14px',
    borderRadius: 'var(--r-md)',
    fontSize: '0.9rem',
  },
  notaInput: {
    padding: '12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text)',
    fontSize: '0.95rem',
    outline: 'none', resize: 'none',
    fontFamily: 'inherit',
  },
  refSerieCard: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 14px',
    background: 'var(--orange-glow)',
    border: '1px solid rgba(240, 153, 123, 0.25)',
    borderRadius: 'var(--r-lg)',
  },
  refSerieCardPR: {
    background: 'rgba(133, 183, 235, 0.1)',
    border: '1px solid rgba(133, 183, 235, 0.25)',
  },
  refSerieIcon: { fontSize: '1.1rem', flexShrink: 0 },
  refSerieLabel: {
    display: 'block',
    fontSize: '0.65rem', fontWeight: 700,
    color: 'var(--orange)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: '3px',
  },
  refSerieValor: {
    display: 'block',
    fontSize: '1.15rem', fontWeight: 800,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
}
