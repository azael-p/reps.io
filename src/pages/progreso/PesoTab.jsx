import { useMemo } from 'react'
import { motion } from 'motion/react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { EmptyState } from '../../components/ui'

export default function PesoTab({ cargandoPeso, historialPeso, onRegistrarPeso }) {
  const pesoChartData = useMemo(
    () => historialPeso.map((e, i) => ({
      xKey: `${e.fecha.getDate()}/${e.fecha.getMonth() + 1}#${i}`,
      fecha: `${e.fecha.getDate()}/${e.fecha.getMonth() + 1}`,
      peso: e.peso,
    })),
    [historialPeso]
  )

  return (
    <div className="progreso-grafico-wrap">
      {cargandoPeso ? (
        <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
          <span className="spinner" style={{ color: 'var(--blue)' }} />
        </div>
      ) : historialPeso.length === 0 ? (
        <EmptyState
          mensaje="Sin registros de peso"
          icon="⚖️"
          sub="Registrá tu peso para ver tu evolución"
          action={{ label: 'Registrar peso', onClick: onRegistrarPeso }}
        />
      ) : (
        <>
          <motion.div
            className="card progreso-chart-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="progreso-chart-titulo">Evolución de peso corporal</p>
            <p className="progreso-chart-sub">en kilogramos</p>
            <div style={{ width: '100%', height: 240, marginTop: '12px' }}>
              <ResponsiveContainer>
                <LineChart data={pesoChartData} margin={{ top: 12, right: 18, left: -18, bottom: 0 }} key={`p${pesoChartData.length}`}>
                  <defs>
                    <linearGradient id="pesoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#85b7eb" stopOpacity={1} />
                      <stop offset="100%" stopColor="#1879c9" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="xKey" tickFormatter={v => String(v).split('#')[0]} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
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
                    formatter={(v) => [`${v} kg`, 'Peso']}
                    cursor={{ stroke: 'rgba(133, 183, 235, 0.3)', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="url(#pesoGrad)"
                    strokeWidth={3}
                    dot={{ fill: '#85b7eb', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 7, fill: '#fff', stroke: '#85b7eb', strokeWidth: 2 }}
                    isAnimationActive
                    animationDuration={900}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          <div style={{ padding: '0 16px 24px' }}>
            <motion.button
              className="card progreso-registrar-peso-btn"
              onClick={onRegistrarPeso}
              whileTap={{ scale: 0.97 }}
            >
              + Registrar peso hoy
            </motion.button>
          </div>
        </>
      )}
    </div>
  )
}
