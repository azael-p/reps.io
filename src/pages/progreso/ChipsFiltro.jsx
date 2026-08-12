import { motion } from 'motion/react'

export default function ChipsFiltro({ values, selected, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', padding: '0 16px 8px', overflowX: 'auto', flexWrap: 'nowrap' }}>
      {values.map(v => (
        <motion.button
          key={v}
          style={{
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            ...(selected === v ? {
              background: 'var(--green-grad)',
              color: '#fff',
              border: 'none',
              boxShadow: 'var(--shadow-green)',
            } : {
              background: 'var(--bg-card)',
              color: 'var(--text-mute)',
              border: '1px solid var(--border)',
              borderTopColor: 'var(--highlight)',
            }),
          }}
          onClick={() => onChange(v)}
          whileTap={{ scale: 0.94 }}
          aria-pressed={selected === v}
        >
          {v === 'todos' ? 'Todos' : v}
        </motion.button>
      ))}
    </div>
  )
}
