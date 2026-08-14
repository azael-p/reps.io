import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Trash2, Timer } from 'lucide-react'
import { useUser } from '../../context/UserContext'
import { getPresets, savePreset, deletePreset } from '../../firebase/timerPresets'
import Credit from '../Credit'

function segsToMinSeg(segs) {
  const m = Math.floor(segs / 60)
  const s = segs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function minSegToSegs(str) {
  const [m = '0', s = '0'] = str.split(':')
  const total = parseInt(m, 10) * 60 + parseInt(s, 10)
  return isNaN(total) ? 0 : Math.max(0, total)
}

const DEFAULTS = {
  calentamiento: '5:00',
  trabajo: '0:40',
  descanso: '0:20',
  sets: 8,
  enfriamiento: '5:00',
}

function resumenPreset(p) {
  return `${p.sets} sets · ${p.trabajo}s trabajo · ${p.descanso}s descanso`
}

export default function TimerConfig({ onIniciar }) {
  const { usuario } = useUser()
  const [form, setForm] = useState(DEFAULTS)
  const [presets, setPresets] = useState([])
  const [nombrePreset, setNombrePreset] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!usuario) return
    getPresets(usuario.id).then(setPresets).catch(() => {})
  }, [usuario])

  const campo = (key) => ({
    value: form[key],
    onChange: (e) => setForm(f => ({ ...f, [key]: e.target.value })),
  })

  function buildConfig() {
    return {
      calentamiento: minSegToSegs(form.calentamiento),
      trabajo: minSegToSegs(form.trabajo),
      descanso: minSegToSegs(form.descanso),
      sets: Math.max(1, parseInt(form.sets, 10) || 1),
      enfriamiento: minSegToSegs(form.enfriamiento),
    }
  }

  function handleIniciar() {
    const config = buildConfig()
    if (config.trabajo <= 0) { setError('El tiempo de trabajo debe ser mayor que 0'); return }
    setError('')
    onIniciar(config)
  }

  async function handleGuardar() {
    if (!nombrePreset.trim()) { setError('Escribe un nombre para el preset'); return }
    setGuardando(true)
    setError('')
    try {
      await savePreset(usuario.id, {
        nombre: nombrePreset.trim(),
        calentamiento: minSegToSegs(form.calentamiento),
        trabajo: minSegToSegs(form.trabajo),
        descanso: minSegToSegs(form.descanso),
        sets: Math.max(1, parseInt(form.sets, 10) || 1),
        enfriamiento: minSegToSegs(form.enfriamiento),
      })
      const updated = await getPresets(usuario.id)
      setPresets(updated)
      setNombrePreset('')
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(id) {
    try {
      await deletePreset(usuario.id, id)
      setPresets(prev => prev.filter(p => p.id !== id))
    } catch {
      setError('Error al eliminar preset')
    }
  }

  function cargarPreset(p) {
    setForm({
      calentamiento: segsToMinSeg(p.calentamiento),
      trabajo: segsToMinSeg(p.trabajo),
      descanso: segsToMinSeg(p.descanso),
      sets: p.sets,
      enfriamiento: segsToMinSeg(p.enfriamiento),
    })
  }

  return (
    <div className="timer-config-page">
      <div className="timer-config-header">
        <Timer size={22} color="var(--orange)" />
        <h1 className="timer-config-titulo">Timer HIIT</h1>
      </div>

      <div className="timer-config-section">
        <p className="timer-config-section-label">Configuración</p>
        <div className="timer-config-grid">
          <Campo label="Calentamiento" {...campo('calentamiento')} />
          <Campo label="Trabajo" {...campo('trabajo')} />
          <Campo label="Descanso" {...campo('descanso')} />
          <Campo label="Enfriamiento" {...campo('enfriamiento')} />
        </div>
        <div style={{ marginTop: '10px' }}>
          <label className="timer-config-field-label">Sets</label>
          <input
            type="number"
            min={1}
            max={99}
            className="input num"
            style={{ textAlign: 'center' }}
            value={form.sets}
            onChange={(e) => setForm(f => ({ ...f, sets: e.target.value }))}
          />
        </div>
      </div>

      {error && <p className="timer-config-error">{error}</p>}

      <motion.button
        className="btn btn-primary timer-config-btn-iniciar"
        onClick={handleIniciar}
        whileTap={{ scale: 0.97 }}
      >
        Iniciar
      </motion.button>

      {/* Presets */}
      <div className="timer-config-section">
        <p className="timer-config-section-label">Mis presets {presets.length > 0 && `(${presets.length}/5)`}</p>
        <AnimatePresence>
          {presets.map(p => (
            <motion.div
              key={p.id}
              className="timer-config-preset-row"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              layout
            >
              <button className="timer-config-preset-btn" onClick={() => cargarPreset(p)}>
                <span className="timer-config-preset-nombre">{p.nombre}</span>
                <span className="timer-config-preset-sub">{resumenPreset(p)}</span>
              </button>
              <button className="timer-config-delete-btn" onClick={() => handleEliminar(p.id)} aria-label="Eliminar preset">
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="timer-config-guardar-row">
          <input
            className="input"
            placeholder="Nombre del preset"
            value={nombrePreset}
            onChange={e => setNombrePreset(e.target.value)}
            style={{ flex: 1 }}
          />
          <motion.button
            className="btn btn-secondary"
            onClick={handleGuardar}
            disabled={guardando || presets.length >= 5}
            whileTap={{ scale: 0.97 }}
            style={{ flexShrink: 0 }}
          >
            {guardando ? '...' : 'Guardar'}
          </motion.button>
        </div>
      </div>

      <Credit />
    </div>
  )
}

function Campo({ label, value, onChange }) {
  return (
    <div>
      <label className="timer-config-field-label">{label}</label>
      <input
        className="input num"
        placeholder="0:00"
        value={value}
        onChange={onChange}
      />
    </div>
  )
}
