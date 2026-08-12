import { motion } from 'motion/react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { EmptyState } from '../../components/ui'

export default function GraficoTab({
  ejercicios, grupos, grupoSel, setGrupoSel, ejercicioSel, setEjercicioSel,
  modoGrafico, setModoGrafico, datosGrafico,
}) {
  return (
    <div style={s.graficoWrap}>
      {ejercicios.length === 0 ? (
        <EmptyState mensaje="Todavía no hay datos de ejercicios." icon="📈" />
      ) : (
        <>
          <div style={s.selector}>
            <p style={s.secLabel}>Grupo muscular</p>
            <div style={s.chips}>
              {grupos.map(g => {
                const activo = grupoSel === g
                return (
                  <motion.button
                    key={g}
                    style={{ ...s.chip, ...(activo ? s.chipActivo : {}) }}
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

          <div style={s.selector}>
            <p style={s.secLabel}>Ejercicio</p>
            <div style={s.chips}>
              {ejercicios
                .filter(e => e.grupoMuscular === grupoSel)
                .map(e => {
                  const activo = ejercicioSel === e.nombre
                  return (
                    <motion.button
                      key={e.nombre}
                      style={{ ...s.chip, ...(activo ? s.chipActivo : {}) }}
                      onClick={() => setEjercicioSel(e.nombre)}
                      whileTap={{ scale: 0.94 }}
                    >
                      {e.nombre}
                    </motion.button>
                  )
                })}
            </div>
          </div>

          <div style={s.selector}>
            <div style={s.toggleRow}>
              {['peso', '1rm', 'volumen'].map(m => (
                <motion.button
                  key={m}
                  style={{ ...s.toggleChip, ...(modoGrafico === m ? s.toggleChipActivo : {}) }}
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
              style={s.chartCard}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p style={s.chartTitulo}>
                {{ peso: 'Peso máximo por sesión', '1rm': 'Tu mejor marca personal por sesión', volumen: 'Mejor serie por volumen' }[modoGrafico]}
              </p>
              <p style={s.chartSub}>{modoGrafico === 'volumen' ? 'en kg × reps' : 'en kilogramos'}</p>
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

const s = {
  graficoWrap: { padding: 0 },
  selector: { padding: '16px 16px 0' },
  secLabel: {
    margin: '0 0 12px',
    fontSize: '0.7rem', color: 'var(--text-mute)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    fontWeight: 700,
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  chip: {
    padding: '12px 18px',
    background: 'var(--bg-card)',
    color: 'var(--text-mute)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    fontSize: '0.88rem', fontWeight: 500,
  },
  chipActivo: {
    background: 'var(--blue-grad)',
    color: '#fff',
    borderColor: 'transparent',
    boxShadow: '0 4px 14px rgba(13, 83, 150, 0.35)',
    fontWeight: 600,
  },
  chartCard: {
    margin: '8px 16px 24px',
    padding: '18px 16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    boxShadow: 'var(--shadow-md)',
  },
  chartTitulo: { margin: 0, fontSize: '1rem', color: 'var(--text)', fontWeight: 700, letterSpacing: '-0.01em' },
  chartSub: { margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-mute)' },
  toggleRow: { display: 'flex', gap: '8px' },
  toggleChip: {
    flex: 1, padding: '12px 16px', textAlign: 'center',
    background: 'var(--bg-card)', color: 'var(--text-mute)',
    border: '1px solid var(--border)', borderRadius: '20px',
    fontSize: '0.88rem', fontWeight: 500,
  },
  toggleChipActivo: {
    background: 'var(--blue-grad)', color: '#fff',
    borderColor: 'transparent', fontWeight: 600,
    boxShadow: '0 4px 14px rgba(13, 83, 150, 0.35)',
  },
}
