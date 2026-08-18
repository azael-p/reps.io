import { motion, AnimatePresence } from 'motion/react'
import { EmptyState, ErrorState } from '../../components/ui'
import { toDate } from '../../utils/fechas'
import ChipsFiltro from './ChipsFiltro'
import { formatFecha } from './format'

// Sin tope, la sesión 20 entraba recién a los 800 ms. Mismo patrón que el
// picker de ejercicios (SeleccionarEjercicio.jsx).
const TOPE_ESCALONADO = 8

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
          <div className="progreso-frecuencia-card">
            <p className="progreso-sec-label">Frecuencia semanal</p>
            <div className="progreso-barras">
              {frec.map(({ semana, dias }, i) => (
                <div key={semana} className="progreso-barra-item">
                  <div className="progreso-barra-wrap">
                    <span className="progreso-barra-num">{dias}</span>
                    <motion.div
                      className="progreso-barra"
                      initial={{ height: 0 }}
                      animate={{ height: `${(dias / maxFrec) * 100}%` }}
                      transition={{ delay: 0.05 * i, duration: 0.55, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="progreso-barra-label">{semana}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="progreso-sec-label" style={{ padding: '8px 16px' }}>Sesiones</p>
          {uniqueProgramas.length > 2 && <ChipsFiltro values={uniqueProgramas} selected={filtroPrograma} onChange={setFiltroPrograma} />}
          {uniqueMeses.length > 2 && <ChipsFiltro values={uniqueMeses} selected={filtroMes} onChange={setFiltroMes} />}
          <div className="progreso-lista">
            <AnimatePresence>
              {sesionesFiltradas.map((sesion, i) => (
                <motion.div
                  key={sesion.id}
                  className="progreso-sesion-card"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
                  transition={{ delay: Math.min(i, TOPE_ESCALONADO) * 0.04, type: 'spring', stiffness: 220, damping: 22 }}
                >
                  <button type="button" className="progreso-sesion-info" onClick={() => navigate(`/sesion/${sesion.id}/resumen`)}>
                    <div className="progreso-fecha-badge">
                      <span className="progreso-fecha-dia">{toDate(sesion.fecha)?.getDate()}</span>
                      <span className="progreso-fecha-mes">{toDate(sesion.fecha)?.toLocaleDateString('es-UY', { month: 'short' })}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span className="progreso-sesion-nombre">{sesion.diaNombre}</span>
                      <span className="progreso-sesion-fecha">{formatFecha(sesion.fecha)}</span>
                    </div>
                  </button>
                  <div className="progreso-sesion-acciones">
                    <motion.button
                      className="progreso-accion-btn"
                      onClick={() => navigate(`/sesion/${sesion.id}/resumen`)}
                      whileTap={{ scale: 0.96 }}
                    >
                      Ver
                    </motion.button>
                    <motion.button
                      className="progreso-accion-btn progreso-accion-eliminar"
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
                className="progreso-ver-mas-btn"
                style={{ opacity: cargandoMas ? 0.6 : 1 }}
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
