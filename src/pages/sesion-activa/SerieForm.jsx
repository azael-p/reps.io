import { motion, AnimatePresence } from 'motion/react'
import { useLongPress } from '../../hooks/useLongPress'
import { parsePeso, sanitizarPeso } from '../../utils/stats'

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

  const restarPesoPress = useLongPress(() => setPesoUsado(p => String(Math.round(Math.max(0, (parsePeso(p) || 0) - 2.5) * 10) / 10)))
  const sumarPesoPress = useLongPress(() => setPesoUsado(p => String(Math.round(((parsePeso(p) || 0) + 2.5) * 10) / 10)))
  const restarRepsPress = useLongPress(() => setRepsHechas(r => String(Math.max(1, (Number(r) || ejercicio.repsEsperadas) - 1))))
  const sumarRepsPress = useLongPress(() => setRepsHechas(r => String((Number(r) || ejercicio.repsEsperadas) + 1)))

  return (
    <>
      <div className="sa-inputs">
        <div className="sa-input-group">
          <label className="sa-input-label">Peso (kg)</label>
          <div className="sa-stepper">
            <motion.button className="sa-stepper-btn" aria-label="Restar 2,5 kg" {...restarPesoPress} whileTap={BTN_TAP_SMALL}>−</motion.button>
            <motion.input className="sa-input-big" type="text" inputMode="decimal" placeholder={ultimoPeso[ejercicio.id] ? String(ultimoPeso[ejercicio.id]) : ''} value={pesoUsado} onChange={e => setPesoUsado(sanitizarPeso(e.target.value))} aria-label="Peso (kg)" whileFocus={INPUT_FOCUS} />
            <motion.button className="sa-stepper-btn" aria-label="Sumar 2,5 kg" {...sumarPesoPress} whileTap={BTN_TAP_SMALL}>+</motion.button>
          </div>
          {ultimoPeso[ejercicio.id] && !pesoUsado && (
            <button type="button" className="sa-hint-tocable" onClick={() => setPesoUsado(String(ultimoPeso[ejercicio.id]))}>↳ Última vez: {ultimoPeso[ejercicio.id]}kg</button>
          )}
        </div>
        <div className="sa-input-group">
          <label className="sa-input-label">Reps</label>
          <div className="sa-stepper">
            <motion.button className="sa-stepper-btn" aria-label="Restar una repetición" {...restarRepsPress} whileTap={BTN_TAP_SMALL}>−</motion.button>
            <motion.input className="sa-input-big" type="number" inputMode="numeric" placeholder={String(ejercicio.repsEsperadas)} value={repsHechas} onChange={e => setRepsHechas(e.target.value)} aria-label="Repeticiones" whileFocus={INPUT_FOCUS} />
            <motion.button className="sa-stepper-btn" aria-label="Sumar una repetición" {...sumarRepsPress} whileTap={BTN_TAP_SMALL}>+</motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mostrarNota ? (
          <motion.textarea key="textarea" className="sa-nota-input" placeholder="Nota para esta serie..." value={nota} onChange={e => setNota(e.target.value)} rows={2} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} autoFocus />
        ) : (
          <motion.button key="addNoteBtn" className="sa-nota-btn" onClick={() => setMostrarNota(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} whileTap={{ scale: 0.97 }}>+ Nota</motion.button>
        )}
      </AnimatePresence>

      {serieRef && (
        <motion.div
          key={`ref-serie-${ejIdx}-${serieIdx}-${tabRef}`}
          className={`sa-ref-serie-card ${tabRef === 'pr' ? 'sa-ref-serie-card--pr' : ''}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <span className="sa-ref-serie-icon">{tabRef === 'pr' ? '🏆' : '🎯'}</span>
          <div style={{ flex: 1 }}>
            <span className={`sa-ref-serie-label ${tabRef === 'pr' ? 'sa-ref-serie-label--pr' : ''}`}>
              {tabRef === 'pr' ? 'PR personal' : 'Última vez'} — serie {serieActual}
            </span>
            <span className="sa-ref-serie-valor">
              {serieRef.pesoUsado > 0 ? `${serieRef.pesoUsado} kg` : 'Sin peso'} × {serieRef.repsHechas} reps
            </span>
          </div>
        </motion.div>
      )}
    </>
  )
}
