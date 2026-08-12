import { motion, AnimatePresence } from 'motion/react'
import { EmptyState, ErrorState } from '../../components/ui'
import { toDate } from '../../utils/fechas'
import ChipsFiltro from './ChipsFiltro'
import { formatFecha } from './format'

export default function HistorialTab({
  errorCarga, cargar, sesiones, navigate,
  frec, maxFrec,
  uniqueProgramas, filtroPrograma, setFiltroPrograma,
  uniqueMeses, filtroMes, setFiltroMes,
  sesionesFiltradas, onEliminar,
  hayMas, cargandoMas, cargarMas,
}) {
  return (
    <div>
      {errorCarga ? (
        <ErrorState mensaje="No se pudo cargar tu historial." onRetry={cargar} />
      ) : sesiones.length === 0 ? (
        <EmptyState mensaje="Cero sesiones. ¿La primera?" icon="📊" sub="Empezá a entrenar para ver tu progreso acá" action={{ label: 'Empezar entrenamiento', onClick: () => navigate('/entrenar') }} />
      ) : (
        <>
          <div style={s.frecuenciaCard}>
            <p style={s.secLabel}>Frecuencia semanal</p>
            <div style={s.barras}>
              {frec.map(({ semana, dias }, i) => (
                <div key={semana} style={s.barraItem}>
                  <div style={s.barraWrap}>
                    <span style={s.barraNum}>{dias}</span>
                    <motion.div
                      style={s.barra}
                      initial={{ height: 0 }}
                      animate={{ height: `${(dias / maxFrec) * 100}%` }}
                      transition={{ delay: 0.05 * i, duration: 0.55, ease: 'easeOut' }}
                    />
                  </div>
                  <span style={s.barraLabel}>{semana}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ ...s.secLabel, padding: '8px 16px' }}>Sesiones</p>
          {uniqueProgramas.length > 2 && <ChipsFiltro values={uniqueProgramas} selected={filtroPrograma} onChange={setFiltroPrograma} />}
          {uniqueMeses.length > 2 && <ChipsFiltro values={uniqueMeses} selected={filtroMes} onChange={setFiltroMes} />}
          <div style={s.lista}>
            <AnimatePresence>
              {sesionesFiltradas.map((sesion, i) => (
                <motion.div
                  key={sesion.id}
                  style={s.sesionCard}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 220, damping: 22 }}
                >
                  <div style={s.sesionInfo} onClick={() => navigate(`/sesion/${sesion.id}/resumen`)}>
                    <div style={s.fechaBadge}>
                      <span style={s.fechaDia}>{toDate(sesion.fecha)?.getDate()}</span>
                      <span style={s.fechaMes}>{toDate(sesion.fecha)?.toLocaleDateString('es-UY', { month: 'short' })}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={s.sesionNombre}>{sesion.diaNombre}</span>
                      <span style={s.sesionFecha}>{formatFecha(sesion.fecha)}</span>
                    </div>
                  </div>
                  <div style={s.sesionAcciones}>
                    <motion.button
                      style={s.accionBtn}
                      onClick={() => navigate(`/sesion/${sesion.id}/resumen`)}
                      whileTap={{ scale: 0.96 }}
                    >
                      Ver
                    </motion.button>
                    <motion.button
                      style={{ ...s.accionBtn, ...s.accionEliminar }}
                      onClick={() => onEliminar(sesion)}
                      whileTap={{ scale: 0.96 }}
                    >
                      Eliminar
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {hayMas && (
              <motion.button
                style={{ ...s.verMasBtn, opacity: cargandoMas ? 0.6 : 1 }}
                onClick={cargarMas}
                disabled={cargandoMas}
                whileTap={{ scale: 0.97 }}
              >
                {cargandoMas ? <span className="spinner" /> : 'Ver más'}
              </motion.button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const s = {
  frecuenciaCard: {
    margin: '16px',
    padding: '18px 16px 14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    boxShadow: 'var(--shadow-sm)',
  },
  secLabel: {
    margin: '0 0 12px',
    fontSize: '0.7rem', color: 'var(--text-mute)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    fontWeight: 700,
  },
  barras: { display: 'flex', gap: '8px', alignItems: 'flex-end', height: '120px', paddingTop: '20px' },
  barraItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, height: '100%' },
  barraWrap: { width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' },
  barra: {
    width: '100%',
    background: 'var(--blue-grad)',
    borderRadius: '6px 6px 0 0',
    minHeight: '4px',
    boxShadow: '0 0 12px rgba(133, 183, 235, 0.15)',
  },
  barraNum: { fontSize: '0.68rem', color: 'var(--blue)', fontWeight: 700, marginBottom: '3px' },
  barraLabel: { fontSize: '0.62rem', color: 'var(--text-dim)' },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px 8px' },
  sesionCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '14px',
    display: 'flex', flexDirection: 'column', gap: '12px',
    boxShadow: 'var(--shadow-sm)',
  },
  sesionInfo: { display: 'flex', gap: '14px', alignItems: 'center', cursor: 'pointer' },
  fechaBadge: {
    width: '50px', height: '50px',
    borderRadius: '14px',
    background: 'var(--blue-glow)',
    border: '1px solid rgba(133, 183, 235, 0.2)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  fechaDia: { fontSize: '1.3rem', fontWeight: 800, color: 'var(--blue)', lineHeight: 1, letterSpacing: '-0.02em' },
  fechaMes: { fontSize: '0.62rem', color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 },
  sesionNombre: { display: 'block', fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em' },
  sesionFecha: { fontSize: '0.82rem', color: 'var(--text-mute)' },
  sesionAcciones: { display: 'flex', gap: '8px' },
  accionBtn: { flex: 1, padding: '14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '0.9rem', fontWeight: 500 },
  accionEliminar: { color: 'var(--danger)', background: 'var(--danger-bg)', borderColor: 'rgba(255,107,107,0.18)' },
  verMasBtn: { width: '100%', padding: '14px', background: 'var(--bg-card)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: '0.9rem', fontWeight: 500 },
}
