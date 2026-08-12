import { useState } from 'react'
import { motion } from 'motion/react'
import { agregarPeso } from '../firebase/peso'

const STEPS = [
  { icon: '📋', label: 'Creá tu primer programa', desc: 'Definí tus rutinas con días y ejercicios' },
  { icon: '🔥', label: 'Registrá tus series', desc: 'Peso, reps y notas durante el entrenamiento' },
  { icon: '📈', label: 'Seguí tu progreso', desc: 'Gráficos de volumen, 1RM y rachas' },
]

export default function Onboarding({ onCompletar, usuarioId }) {
  const [peso, setPeso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorPeso, setErrorPeso] = useState('')

  async function handleEmpezar() {
    const kg = Number(peso)
    if (peso.trim() && (!kg || kg < 20 || kg > 300)) {
      setErrorPeso('Ingresá un peso entre 20 y 300 kg, o dejalo vacío')
      return
    }
    setErrorPeso('')
    setGuardando(true)
    try {
      if (peso.trim()) {
        await agregarPeso(usuarioId, kg)
      }
    } catch (e) { console.error(e) }
    setGuardando(false)
    onCompletar()
  }

  return (
    <motion.div
      style={s.card}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
    >
      <div style={s.header}>
        <span style={s.welcome}>👋</span>
        <h2 style={s.titulo}>Bienvenido a Reps.io</h2>
        <p style={s.sub}>En tres pasos simples</p>
      </div>

      <div style={s.steps}>
        {STEPS.map((step, i) => (
          <motion.div
            key={step.label}
            style={s.step}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
          >
            <div style={s.stepNum}>{i + 1}</div>
            <div style={s.stepContent}>
              <span style={s.stepIcon}>{step.icon}</span>
              <div>
                <span style={s.stepLabel}>{step.label}</span>
                <span style={s.stepDesc}>{step.desc}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        style={s.pesoWrap}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <label style={s.pesoLabel}>
          ⚖️ ¿Cuánto pesás? <span style={s.pesoOpcional}>(opcional)</span>
        </label>
        <div style={s.pesoRow}>
          <input
            type="number"
            style={s.pesoInput}
            placeholder="Ej: 78"
            value={peso}
            onChange={e => setPeso(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmpezar()}
            min="20"
            max="300"
          />
          <span style={s.pesoKg}>kg</span>
        </div>
        {errorPeso && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '8px 0 0' }} role="alert">{errorPeso}</p>}
      </motion.div>

      <motion.button
        style={{ ...s.btn, opacity: guardando ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={handleEmpezar}
        disabled={guardando}
        whileTap={{ scale: 0.97 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {guardando ? <span className="spinner" /> : '¡Empezar!'}
      </motion.button>
    </motion.div>
  )
}

const s = {
  card: {
    margin: '0 0 8px',
    padding: '24px 20px 20px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-xl)',
    boxShadow: 'var(--shadow-md)',
    display: 'flex', flexDirection: 'column', gap: '18px',
  },
  header: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  welcome: { fontSize: '2rem', marginBottom: '4px' },
  titulo: { fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em' },
  sub: { fontSize: '0.85rem', color: 'var(--text-mute)' },
  steps: { display: 'flex', flexDirection: 'column', gap: '10px' },
  step: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  stepNum: {
    width: '22px', height: '22px',
    borderRadius: '50%',
    background: 'var(--orange-glow)',
    border: '1px solid rgba(240, 153, 123, 0.3)',
    color: 'var(--orange)',
    fontSize: '0.72rem', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: '2px',
  },
  stepContent: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  stepIcon: { fontSize: '1.1rem', flexShrink: 0 },
  stepLabel: { display: 'block', fontSize: '0.92rem', fontWeight: 600 },
  stepDesc: { display: 'block', fontSize: '0.78rem', color: 'var(--text-mute)', marginTop: '2px' },
  pesoWrap: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    padding: '16px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
  },
  pesoLabel: { fontSize: '0.92rem', fontWeight: 600, color: 'var(--text)' },
  pesoOpcional: { fontSize: '0.78rem', color: 'var(--text-mute)', fontWeight: 400 },
  pesoRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  pesoInput: {
    flex: 1, padding: '12px 14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text)', fontSize: '1.05rem',
    outline: 'none',
  },
  pesoKg: { fontSize: '0.95rem', color: 'var(--text-mute)', fontWeight: 600, flexShrink: 0 },
  btn: {
    width: '100%', padding: '16px',
    background: 'var(--orange-grad)', color: '#fff',
    border: 'none', borderRadius: 'var(--r-lg)',
    fontSize: '1rem', fontWeight: 700,
    boxShadow: '0 10px 28px rgba(199, 90, 48, 0.35)',
    letterSpacing: '-0.01em',
  },
}
