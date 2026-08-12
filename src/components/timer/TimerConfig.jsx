import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Trash2, Timer } from 'lucide-react'
import { useUser } from '../../context/UserContext'
import { getPresets, savePreset, deletePreset } from '../../firebase/timerPresets'

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
    <div style={s.page}>
      <div style={s.header}>
        <Timer size={22} color="var(--orange)" />
        <h1 style={s.titulo}>Timer HIIT</h1>
      </div>

      <div style={s.section}>
        <p style={s.sectionLabel}>Configuración</p>
        <div style={s.grid}>
          <Campo label="Calentamiento" {...campo('calentamiento')} />
          <Campo label="Trabajo" {...campo('trabajo')} />
          <Campo label="Descanso" {...campo('descanso')} />
          <Campo label="Enfriamiento" {...campo('enfriamiento')} />
        </div>
        <div style={{ marginTop: '10px' }}>
          <label style={s.fieldLabel}>Sets</label>
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

      {error && <p style={s.error}>{error}</p>}

      <motion.button
        className="btn btn-primary"
        style={s.btnIniciar}
        onClick={handleIniciar}
        whileTap={{ scale: 0.97 }}
      >
        Iniciar
      </motion.button>

      {/* Presets */}
      <div style={s.section}>
        <p style={s.sectionLabel}>Mis presets {presets.length > 0 && `(${presets.length}/5)`}</p>
        <AnimatePresence>
          {presets.map(p => (
            <motion.div
              key={p.id}
              style={s.presetRow}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              layout
            >
              <button style={s.presetBtn} onClick={() => cargarPreset(p)}>
                <span style={s.presetNombre}>{p.nombre}</span>
                <span style={s.presetSub}>{resumenPreset(p)}</span>
              </button>
              <button style={s.deleteBtn} onClick={() => handleEliminar(p.id)} aria-label="Eliminar preset">
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        <div style={s.guardarRow}>
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
    </div>
  )
}

function Campo({ label, value, onChange }) {
  return (
    <div>
      <label style={s.fieldLabel}>{label}</label>
      <input
        className="input num"
        placeholder="0:00"
        value={value}
        onChange={onChange}
      />
    </div>
  )
}

const s = {
  page: {
    minHeight: '100dvh',
    padding: '20px 16px max(24px, env(safe-area-inset-bottom))',
    paddingTop: 'max(20px, env(safe-area-inset-top))',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    maxWidth: '540px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  titulo: {
    fontSize: '1.6rem',
    fontWeight: 800,
    letterSpacing: '-0.025em',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-mute)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '0.76rem',
    fontWeight: 600,
    color: 'var(--text-mute)',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  btnIniciar: {
    width: '100%',
    padding: '18px',
    fontSize: '1.1rem',
    borderRadius: 'var(--r-lg)',
  },
  presetRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  presetBtn: {
    flex: 1,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    padding: '12px 14px',
    textAlign: 'left',
    color: 'var(--text)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  presetNombre: {
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  presetSub: {
    fontSize: '0.78rem',
    color: 'var(--text-mute)',
  },
  deleteBtn: {
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255,107,107,0.3)',
    borderRadius: 'var(--r-md)',
    padding: '12px',
    color: 'var(--danger)',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardarRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginTop: '4px',
  },
  error: {
    color: 'var(--danger)',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
}
