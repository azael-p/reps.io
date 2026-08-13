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
      className="onboarding-card"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
    >
      <div className="onboarding-header">
        <span className="onboarding-welcome">👋</span>
        <h2 className="onboarding-titulo">Bienvenido a Reps.io</h2>
        <p className="onboarding-sub">En tres pasos simples</p>
      </div>

      <div className="onboarding-steps">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.label}
            className="onboarding-step"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
          >
            <div className="onboarding-step-num">{i + 1}</div>
            <div className="onboarding-step-content">
              <span className="onboarding-step-icon">{step.icon}</span>
              <div>
                <span className="onboarding-step-label">{step.label}</span>
                <span className="onboarding-step-desc">{step.desc}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="onboarding-peso-wrap"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <label className="onboarding-peso-label">
          ⚖️ ¿Cuánto pesás? <span className="onboarding-peso-opcional">(opcional)</span>
        </label>
        <div className="onboarding-peso-row">
          <input
            type="number"
            className="onboarding-peso-input"
            placeholder="Ej: 78"
            value={peso}
            onChange={e => setPeso(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmpezar()}
            min="20"
            max="300"
          />
          <span className="onboarding-peso-kg">kg</span>
        </div>
        {errorPeso && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '8px 0 0' }} role="alert">{errorPeso}</p>}
      </motion.div>

      <motion.button
        className="onboarding-btn"
        style={{ opacity: guardando ? 0.7 : 1 }}
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
