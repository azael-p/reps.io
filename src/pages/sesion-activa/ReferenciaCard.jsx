import { motion, AnimatePresence } from 'motion/react'
import { tiempoRelativo } from '../../utils/fechas'

// Bloque destacado con el dato puntual de la serie actual (si esa sesión de
// referencia llegó a tener esa misma serie) — lo primero que importa entre
// series. `serie` es la entrada de `.series` que matchea `serieActual`.
function SerieDestacada({ serie, serieActual, esPR }) {
  if (!serie) return null
  return (
    <div className={`sa-ref-serie-card ${esPR ? 'sa-ref-serie-card--pr' : ''}`}>
      <span className="sa-ref-serie-icon">{esPR ? '🏆' : '🎯'}</span>
      <div style={{ flex: 1 }}>
        <span className={`sa-ref-serie-label ${esPR ? 'sa-ref-serie-label--pr' : ''}`}>
          {esPR ? 'PR personal' : 'Última vez'} — serie {serieActual}
        </span>
        <span className="sa-ref-serie-valor">
          {serie.pesoUsado > 0 ? `${serie.pesoUsado} kg` : 'Sin peso'} × {serie.repsHechas} reps
        </span>
      </div>
    </div>
  )
}

export default function ReferenciaCard({ tabRef, setTabRef, refAnterior, refPR, serieActual }) {
  return (
    <div className="sa-ref-tabs-wrap">
      <div className="sa-ref-tabs">
        {['ultima', 'pr'].map(tab => (
          <button
            key={tab}
            className={`sa-ref-tab ${tabRef === tab ? 'sa-ref-tab--activo' : ''}`}
            onClick={() => setTabRef(tab)}
            aria-pressed={tabRef === tab}
          >
            {tab === 'ultima' ? 'Última' : 'PR personal'}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {tabRef === 'ultima' ? (
          refAnterior === undefined ? (
            <motion.div key="ref-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="sa-ref-card-compact">
                <span className="sa-ref-label-compact">Última vez</span>
                <span className="sa-ref-valor-compact sa-ref-skeleton">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
              </div>
            </motion.div>
          ) : refAnterior ? (
            <motion.div key="ref-data" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <SerieDestacada serie={refAnterior.series.find(s => s.numeroSerie === serieActual)} serieActual={serieActual} />
              <div className="sa-ref-card-compact">
                <span className="sa-ref-label-compact">Última vez {tiempoRelativo(refAnterior.fecha)}:</span>
                <span className="sa-ref-valor-compact">
                  {refAnterior.series.map((serie, i) => (
                    <span key={serie.numeroSerie}>
                      {i > 0 && <span style={{ color: 'var(--border-strong)' }}> · </span>}
                      {serie.pesoUsado > 0 ? `${serie.pesoUsado}kg × ` : ''}{serie.repsHechas}
                    </span>
                  ))}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="ref-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="sa-ref-card-compact">
                <span className="sa-ref-label-compact">Primera vez con este ejercicio 🎉</span>
              </div>
            </motion.div>
          )
        ) : (
          refPR === undefined ? (
            <motion.div key="pr-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="sa-ref-card-compact">
                <span className="sa-ref-label-compact">PR personal</span>
                <span className="sa-ref-valor-compact sa-ref-skeleton">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
              </div>
            </motion.div>
          ) : refPR ? (
            <motion.div key="pr-data" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <SerieDestacada serie={refPR.series.find(s => s.numeroSerie === serieActual)} serieActual={serieActual} esPR />
              <div className="sa-ref-card-compact">
                <span className="sa-ref-label-compact" style={{ color: 'var(--blue)' }}>🏆 Tu marca: {refPR.maxPeso}kg</span>
                <span className="sa-ref-valor-compact">
                  {refPR.series.map((serie, i) => (
                    <span key={serie.numeroSerie}>
                      {i > 0 && <span style={{ color: 'var(--border-strong)' }}> · </span>}
                      {serie.pesoUsado > 0 ? `${serie.pesoUsado}kg × ` : ''}{serie.repsHechas}
                    </span>
                  ))}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="pr-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="sa-ref-card-compact">
                <span className="sa-ref-label-compact">Sin marca todavía</span>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  )
}
