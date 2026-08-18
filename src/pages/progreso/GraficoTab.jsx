import { motion } from 'motion/react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { EmptyState } from '../../components/ui'

export default function GraficoTab({
  ejercicios, grupos, grupoSel, setGrupoSel, ejercicioSel, setEjercicioSel,
  modoGrafico, setModoGrafico, datosGrafico,
}) {
  return (
    <div className="progreso-grafico-wrap">
      {ejercicios.length === 0 ? (
        <EmptyState mensaje="Todavía no hay datos de ejercicios." icon="📈" />
      ) : (
        <>
          <div className="progreso-selector">
            <p className="progreso-sec-label">Grupo muscular</p>
            <div className="progreso-chips">
              {grupos.map(g => {
                const activo = grupoSel === g
                return (
                  <motion.button
                    key={g}
                    className={`progreso-chip ${activo ? 'progreso-chip--activo' : ''}`}
                    onClick={() => {
                      setGrupoSel(g)
                      const primero = ejercicios.find(e => e.grupoMuscular === g)
                      if (primero) setEjercicioSel(primero.nombre)
                    }}
                    whileTap={{ scale: 0.94 }}
                  >
                    {g}
                  </motion.button>
                )
              })}
            </div>
          </div>

          <div className="progreso-selector">
            <p className="progreso-sec-label">Ejercicio</p>
            <div className="progreso-chips">
              {ejercicios
                .filter(e => e.grupoMuscular === grupoSel)
                .map(e => {
                  const activo = ejercicioSel === e.nombre
                  return (
                    <motion.button
                      key={e.nombre}
                      className={`progreso-chip ${activo ? 'progreso-chip--activo' : ''}`}
                      onClick={() => setEjercicioSel(e.nombre)}
                      whileTap={{ scale: 0.94 }}
                    >
                      {e.nombre}
                    </motion.button>
                  )
                })}
            </div>
          </div>

          <div className="progreso-selector">
            <div className="progreso-toggle-row">
              {['peso', '1rm', 'volumen'].map(m => (
                <motion.button
                  key={m}
                  className={`progreso-toggle-chip ${modoGrafico === m ? 'progreso-toggle-chip--activo' : ''}`}
                  onClick={() => setModoGrafico(m)}
                  whileTap={{ scale: 0.94 }}
                >
                  {{ peso: 'Peso máx.', '1rm': 'PR personal', volumen: 'Vol. serie' }[m]}
                </motion.button>
              ))}
            </div>
          </div>

          {datosGrafico.length === 0 ? (
            <EmptyState mensaje="No hay registros para este ejercicio." icon="📉" />
          ) : (
            <motion.div
              className="progreso-chart-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="progreso-chart-titulo">
                {{ peso: 'Peso máximo por sesión', '1rm': 'Tu mejor marca personal por sesión', volumen: 'Mejor serie por volumen' }[modoGrafico]}
              </p>
              <p className="progreso-chart-sub">{modoGrafico === 'volumen' ? 'en kg × reps' : 'en kilogramos'}</p>
              <div style={{ width: '100%', height: 240, marginTop: '12px' }}>
                <ResponsiveContainer>
                  <LineChart data={datosGrafico} margin={{ top: 12, right: 18, left: -18, bottom: 0 }} key={`g${ejercicioSel}-${modoGrafico}-${datosGrafico.length}`}>
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#85b7eb" stopOpacity={1} />
                        <stop offset="100%" stopColor="#1879c9" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    {/* Sin minTickGap las fechas se pisan entre sí apenas hay
                        una decena de sesiones; en 390px de ancho quedaban
                        ilegibles. Recharts descarta los ticks intermedios que
                        no entran y conserva el primero y el último. */}
                    <XAxis dataKey="xKey" tickFormatter={v => String(v).split('#')[0]} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
                    <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 12,
                        color: '#fff',
                        fontSize: '0.85rem',
                        padding: '8px 12px',
                        boxShadow: 'var(--shadow-md)',
                      }}
                      labelFormatter={v => String(v).split('#')[0]}
                      formatter={(v) => {
                        const label = { peso: 'Peso', '1rm': '1RM', volumen: 'Vol. serie' }[modoGrafico]
                        const unit = modoGrafico === 'volumen' ? 'kg·rep' : 'kg'
                        return [`${v.toLocaleString()} ${unit}`, label]
                      }}
                      cursor={{ stroke: 'rgba(133, 183, 235, 0.3)', strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone" dataKey={modoGrafico === 'peso' ? 'peso' : modoGrafico === '1rm' ? '1rm' : 'volumen'}
                      stroke="url(#lineGrad)" strokeWidth={3}
                      dot={{ fill: '#85b7eb', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 7, fill: '#fff', stroke: '#85b7eb', strokeWidth: 2 }}
                      isAnimationActive={true}
                      animationDuration={900}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
