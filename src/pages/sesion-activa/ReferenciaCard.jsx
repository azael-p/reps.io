import { motion, AnimatePresence } from 'motion/react'

function tiempoRelativo(timestamp) {
  if (!timestamp) return ''
  const ms = timestamp?.toMillis?.() ?? new Date(timestamp).getTime()
  const diff = Date.now() - ms
  const dias = Math.floor(diff / 86400000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  if (dias < 30) return `hace ${Math.floor(dias / 7)} sem`
  return `hace ${Math.floor(dias / 30)} mes`
}

export default function ReferenciaCard({ tabRef, setTabRef, refAnterior, refPR }) {
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
            <motion.div key="ref-loading" className="sa-ref-card-compact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="sa-ref-label-compact">Última vez</span>
              <span className="sa-ref-valor-compact sa-ref-skeleton">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            </motion.div>
          ) : refAnterior ? (
            <motion.div key="ref-data" className="sa-ref-card-compact" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <span className="sa-ref-label-compact">Última vez {tiempoRelativo(refAnterior.fecha)}:</span>
              <span className="sa-ref-valor-compact">
                {refAnterior.series.map((serie, i) => (
                  <span key={serie.numeroSerie}>
                    {i > 0 && <span style={{ color: 'var(--border-strong)' }}> · </span>}
                    {serie.pesoUsado > 0 ? `${serie.pesoUsado}kg × ` : ''}{serie.repsHechas}
                  </span>
                ))}
              </span>
            </motion.div>
          ) : (
            <motion.div key="ref-empty" className="sa-ref-card-compact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="sa-ref-label-compact">Primera vez con este ejercicio 🎉</span>
            </motion.div>
          )
        ) : (
          refPR === undefined ? (
            <motion.div key="pr-loading" className="sa-ref-card-compact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="sa-ref-label-compact">PR personal</span>
              <span className="sa-ref-valor-compact sa-ref-skeleton">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            </motion.div>
          ) : refPR ? (
            <motion.div key="pr-data" className="sa-ref-card-compact" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <span className="sa-ref-label-compact" style={{ color: 'var(--blue)' }}>🏆 Tu marca: {refPR.maxPeso}kg</span>
              <span className="sa-ref-valor-compact">
                {refPR.series.map((serie, i) => (
                  <span key={serie.numeroSerie}>
                    {i > 0 && <span style={{ color: 'var(--border-strong)' }}> · </span>}
                    {serie.pesoUsado > 0 ? `${serie.pesoUsado}kg × ` : ''}{serie.repsHechas}
                  </span>
                ))}
              </span>
            </motion.div>
          ) : (
            <motion.div key="pr-empty" className="sa-ref-card-compact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="sa-ref-label-compact">Sin marca todavía</span>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  )
}
