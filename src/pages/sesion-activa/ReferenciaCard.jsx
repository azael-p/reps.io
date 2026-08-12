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
    <div style={s.refTabsWrap}>
      <div style={s.refTabs}>
        {['ultima', 'pr'].map(tab => (
          <button
            key={tab}
            style={{ ...s.refTab, ...(tabRef === tab ? s.refTabActivo : {}) }}
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
            <motion.div key="ref-loading" style={s.refCardCompact} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span style={s.refLabelCompact}>Última vez</span>
              <span style={{ ...s.refValorCompact, color: 'transparent', background: 'var(--bg-elev)', borderRadius: '4px' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            </motion.div>
          ) : refAnterior ? (
            <motion.div key="ref-data" style={s.refCardCompact} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <span style={s.refLabelCompact}>Última vez {tiempoRelativo(refAnterior.fecha)}:</span>
              <span style={s.refValorCompact}>
                {refAnterior.series.map((serie, i) => (
                  <span key={serie.numeroSerie}>
                    {i > 0 && <span style={{ color: 'var(--border-strong)' }}> · </span>}
                    {serie.pesoUsado > 0 ? `${serie.pesoUsado}kg × ` : ''}{serie.repsHechas}
                  </span>
                ))}
              </span>
            </motion.div>
          ) : (
            <motion.div key="ref-empty" style={s.refCardCompact} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span style={s.refLabelCompact}>Primera vez con este ejercicio 🎉</span>
            </motion.div>
          )
        ) : (
          refPR === undefined ? (
            <motion.div key="pr-loading" style={s.refCardCompact} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span style={s.refLabelCompact}>PR personal</span>
              <span style={{ ...s.refValorCompact, color: 'transparent', background: 'var(--bg-elev)', borderRadius: '4px' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            </motion.div>
          ) : refPR ? (
            <motion.div key="pr-data" style={s.refCardCompact} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <span style={{ ...s.refLabelCompact, color: 'var(--blue)' }}>🏆 Tu marca: {refPR.maxPeso}kg</span>
              <span style={s.refValorCompact}>
                {refPR.series.map((serie, i) => (
                  <span key={serie.numeroSerie}>
                    {i > 0 && <span style={{ color: 'var(--border-strong)' }}> · </span>}
                    {serie.pesoUsado > 0 ? `${serie.pesoUsado}kg × ` : ''}{serie.repsHechas}
                  </span>
                ))}
              </span>
            </motion.div>
          ) : (
            <motion.div key="pr-empty" style={s.refCardCompact} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span style={s.refLabelCompact}>Sin marca todavía</span>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  )
}

const s = {
  refTabsWrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
  refTabs: { display: 'flex', gap: '4px' },
  refTab: {
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '0.65rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-dim)',
    cursor: 'pointer',
  },
  refTabActivo: {
    background: 'var(--bg-card)',
    color: 'var(--text)',
    borderColor: 'var(--border-strong)',
  },
  refCardCompact: {
    display: 'flex', gap: '4px',
    padding: '4px 0',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  refLabelCompact: {
    fontSize: '0.68rem', fontWeight: 700,
    color: 'var(--text-dim)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  refValorCompact: {
    fontSize: '0.85rem', fontWeight: 600,
    color: 'var(--text-mute)',
  },
}
