import { motion } from 'motion/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { EmptyState } from '../../components/ui'

export default function VolumenTab({ datosVolumen }) {
  return (
    <div>
      {datosVolumen.length === 0 ? (
        <EmptyState mensaje="No hay datos de volumen todavía." icon="📊" />
      ) : (
        <motion.div
          className="card progreso-chart-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="progreso-chart-titulo">Volumen total por sesión</p>
          <p className="progreso-chart-sub">peso × reps × series</p>
          <div style={{ width: '100%', height: 240, marginTop: '12px' }}>
            <ResponsiveContainer>
              <BarChart data={datosVolumen} margin={{ top: 12, right: 18, left: -18, bottom: 0 }} key={`v${datosVolumen.length}`}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5dcaa5" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0c7a5f" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="xKey" tickFormatter={v => String(v).split('#')[0]} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
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
                  formatter={(v) => [`${v.toLocaleString()} kg`, 'Volumen']}
                  cursor={{ fill: 'rgba(93, 202, 165, 0.1)' }}
                />
                <Bar dataKey="volumen" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  )
}
