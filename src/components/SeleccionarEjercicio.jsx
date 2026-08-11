import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import Fuse from 'fuse.js'
import { getCatalogo } from '../firebase/catalogo'
import { Search, X, ChevronLeft, Plus } from 'lucide-react'
import { Badge } from './ui'
import { useDesktop } from '../hooks/useDesktop'

const GRUPOS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazo', 'Cuello', 'Core', 'Pantorrillas', 'Cardio']

const MAX_SUGERENCIAS = 8

// Búsqueda insensible a acentos: "jalon" encuentra "Jalón", "biceps" encuentra "Bíceps".
const normalizar = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Fuse trata la query entera como un solo patrón, así que "press banca" puntúa peor
// contra "Press de banca plano" (por el "de" del medio) que contra "Press francés".
// Con varias palabras buscamos cada una por separado y nos quedamos con los ejercicios
// que matchean todas, ordenados por la suma de sus scores (menor = mejor).
function buscarPorTokens(fuse, tokens) {
  let acum = null
  for (const token of tokens) {
    const encontrados = new Map(fuse.search(token).map(r => [r.item.id, { item: r.item, score: r.score }]))
    if (acum === null) { acum = encontrados; continue }
    for (const [id, previo] of acum) {
      const match = encontrados.get(id)
      if (!match) acum.delete(id)
      else acum.set(id, { item: previo.item, score: previo.score + match.score })
    }
  }
  return [...acum.values()].sort((a, b) => a.score - b.score).map(r => r.item)
}

export default function SeleccionarEjercicio({ onSeleccionar, onCerrar }) {
  const isDesktop = useDesktop()
  const [catalogo, setCatalogo] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [grupoActivo, setGrupoActivo] = useState(null)
  const [ejercicioElegido, setEjercicioElegido] = useState(null)
  const [series, setSeries] = useState('3')
  const [reps, setReps] = useState('10')
  const [customMode, setCustomMode] = useState(false)
  const [customNombre, setCustomNombre] = useState('')
  const [customGrupo, setCustomGrupo] = useState('Pecho')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    getCatalogo().then(c => { setCatalogo(c); setCargando(false) }).catch(() => setCargando(false))
  }, [])

  const onCerrarRef = useRef(onCerrar)
  useEffect(() => { onCerrarRef.current = onCerrar }, [onCerrar])

  const handlerRef = useRef(() => onCerrarRef.current?.())

  useEffect(() => {
    const timer = setTimeout(() => window.history.pushState({ pickerLevel: 0 }, ''), 0)
    const dispatch = () => handlerRef.current?.()
    window.addEventListener('popstate', dispatch)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('popstate', dispatch)
      if (window.history.state?.pickerLevel != null) window.history.back()
    }
  }, [])

  useEffect(() => {
    if (ejercicioElegido || customMode) {
      window.history.pushState({ pickerLevel: 1 }, '')
      handlerRef.current = () => { setEjercicioElegido(null); setCustomMode(false) }
    } else {
      handlerRef.current = () => onCerrarRef.current?.()
    }
  }, [ejercicioElegido, customMode]) // eslint-disable-line

  const fuse = useMemo(() => new Fuse(
    catalogo.map(e => ({ ...e, nombreNorm: normalizar(e.nombre), grupoNorm: normalizar(e.grupoMuscular) })),
    {
      keys: [{ name: 'nombreNorm', weight: 2 }, { name: 'grupoNorm', weight: 1 }],
      threshold: 0.4,
      minMatchCharLength: 2,
      ignoreLocation: true,
      includeScore: true,
    },
  ), [catalogo])

  // Buscando → sugerencias fuzzy sobre todo el catálogo. Sin búsqueda → listado por grupo.
  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return grupoActivo ? catalogo.filter(e => e.grupoMuscular === grupoActivo) : catalogo

    // Fuse descarta los matches más cortos que minMatchCharLength, así que con menos
    // de 2 letras caemos a un contains simple para que la lista no quede vacía.
    const tokens = q.split(/\s+/).filter(t => t.length >= 2)
    if (tokens.length === 0) {
      return catalogo.filter(e => normalizar(e.nombre).includes(q)).slice(0, MAX_SUGERENCIAS)
    }
    if (tokens.length === 1) {
      return fuse.search(tokens[0], { limit: MAX_SUGERENCIAS }).map(r => r.item)
    }
    const porTokens = buscarPorTokens(fuse, tokens)
    // Si ninguna coincide con todas las palabras, mejor algo aproximado que nada.
    const resultado = porTokens.length > 0 ? porTokens : fuse.search(q).map(r => r.item)
    return resultado.slice(0, MAX_SUGERENCIAS)
  }, [busqueda, grupoActivo, catalogo, fuse])

  function confirmar() {
    if (customMode) {
      if (!customNombre.trim()) return
      // Sin catalogoId: el ejercicio no existe en el catálogo.
      onSeleccionar({ nombre: customNombre.trim(), grupoMuscular: customGrupo, esCustom: true, catalogoId: null, seriesEsperadas: Number(series), repsEsperadas: Number(reps) })
    } else {
      onSeleccionar({ nombre: ejercicioElegido.nombre, grupoMuscular: ejercicioElegido.grupoMuscular, esCustom: false, catalogoId: ejercicioElegido.id, seriesEsperadas: Number(series), repsEsperadas: Number(reps) })
    }
  }

  if (ejercicioElegido || customMode) {
    return createPortal(
      <motion.div
        style={s.page}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
      >
        <div style={s.header}>
          <motion.button
            style={s.back}
            onClick={() => window.history.back()}
            whileTap={{ scale: 0.9, x: -2 }}
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </motion.button>
          <div style={s.headerInfo}>
            <p style={s.headerSub}>Configurar</p>
            <h2 style={s.titulo}>{customMode ? 'Ejercicio personalizado' : ejercicioElegido.nombre}</h2>
          </div>
        </div>

        <div style={s.bodyConfig}>
          {customMode && (
            <>
              <div style={s.field}>
                <label style={s.label}>Nombre del ejercicio</label>
                <input
                  style={s.input}
                  value={customNombre}
                  onChange={e => setCustomNombre(e.target.value)}
                  placeholder="Ej: Curl araña"
                  autoFocus
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Grupo muscular</label>
                <div style={s.chips}>
                  {GRUPOS.map(g => (
                    <motion.button
                      key={g}
                      style={{ ...s.chip, ...(customGrupo === g ? s.chipActivo : {}) }}
                      onClick={() => setCustomGrupo(g)}
                      whileTap={{ scale: 0.94 }}
                    >
                      {g}
                    </motion.button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Series</label>
              <input style={s.inputNum} type="number" inputMode="numeric" min="1" max="20" value={series} onChange={e => setSeries(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Reps</label>
              <input style={s.inputNum} type="number" inputMode="numeric" min="1" max="100" value={reps} onChange={e => setReps(e.target.value)} />
            </div>
          </div>

          <motion.button
            style={s.confirmarBtn}
            onClick={confirmar}
            whileTap={{ scale: 0.97 }}
          >
            Agregar ejercicio
          </motion.button>
        </div>
      </motion.div>,
      document.body
    )
  }

  return createPortal(
    <motion.div
      style={s.page}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div style={s.header}>
        <motion.button style={s.back} onClick={() => window.history.back()} whileTap={{ scale: 0.9 }}>
          <ChevronLeft size={20} strokeWidth={2} />
        </motion.button>
        <div style={s.headerInfo}>
          <p style={s.headerSub}>Catálogo</p>
          <h2 style={s.titulo}>Elegir ejercicio</h2>
        </div>
      </div>

      <div style={s.searchWrap}>
        <div style={s.searchInner}>
          <span style={s.searchIcon}><Search size={16} /></span>
          <input
            style={s.search}
            placeholder="Buscar..."
            inputMode="search"
            autoFocus={isDesktop}
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setGrupoActivo(null) }}
          />
          {busqueda && (
            <motion.button
              aria-label="Limpiar búsqueda"
              style={s.clearBtn}
              onClick={() => setBusqueda('')}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X size={14} />
            </motion.button>
          )}
        </div>
      </div>

      <div style={s.grupos}>
        <motion.button
          style={{ ...s.grupoBtn, ...(grupoActivo === null && !busqueda ? s.grupoBtnActivo : {}) }}
          onClick={() => { setGrupoActivo(null); setBusqueda('') }}
          whileTap={{ scale: 0.94 }}
        >
          Todos
        </motion.button>
        {GRUPOS.map(g => (
          <motion.button
            key={g}
            style={{ ...s.grupoBtn, ...(grupoActivo === g ? s.grupoBtnActivo : {}) }}
            onClick={() => { setGrupoActivo(g); setBusqueda('') }}
            whileTap={{ scale: 0.94 }}
          >
            {g}
          </motion.button>
        ))}
      </div>

      <div style={s.lista}>
        {cargando ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={s.skel} />
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {filtrados.length === 0 ? (
              <motion.p
                style={s.muted}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Sin resultados
              </motion.p>
            ) : (
              filtrados.map((e, i) => (
                <motion.button
                  key={e.id}
                  layout
                  style={s.ejercicioItem}
                  onClick={() => setEjercicioElegido(e)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.015 }}
                  whileTap={{ scale: 0.98, backgroundColor: 'var(--bg-card-hover)' }}
                >
                  <span style={s.ejercicioNombre}>{e.nombre}</span>
                  <Badge color="green">{e.grupoMuscular}</Badge>
                </motion.button>
              ))
            )}
          </AnimatePresence>
        )}
      </div>

      <motion.button
        style={s.customBtn}
        onClick={() => setCustomMode(true)}
        whileTap={{ scale: 0.97 }}
      >
        <Plus size={16} style={{ flexShrink: 0 }} /> Ejercicio personalizado
      </motion.button>
    </motion.div>,
    document.body
  )
}

const s = {
  page: {
    position: 'fixed', inset: 0,
    background: 'var(--bg)',
    color: 'var(--text)',
    display: 'flex', flexDirection: 'column',
    zIndex: 200,
    overflowY: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center',
    padding: '20px 16px 16px',
    paddingTop: 'max(20px, env(safe-area-inset-top))',
    gap: '12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  back: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    width: '44px', height: '44px',
    borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headerInfo: { flex: 1 },
  headerSub: { margin: 0, fontSize: '0.7rem', color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' },
  titulo: { margin: '2px 0 0', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.02em' },
  searchWrap: { padding: '14px 16px 8px', flexShrink: 0 },
  searchInner: {
    position: 'relative',
    display: 'flex', alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    fontSize: '0.9rem',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  search: {
    width: '100%', padding: '13px 36px 13px 38px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text)', fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  clearBtn: {
    position: 'absolute', right: '8px',
    width: '36px', height: '36px',
    borderRadius: '50%',
    background: 'var(--bg-input)',
    border: 'none',
    color: 'var(--text-mute)',
    fontSize: '0.85rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  grupos: {
    display: 'flex', gap: '8px',
    padding: '4px 16px 14px',
    overflowX: 'auto',
    flexShrink: 0,
    scrollbarWidth: 'none',
  },
  grupoBtn: {
    padding: '12px 18px',
    background: 'var(--bg-card)',
    color: 'var(--text-mute)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    fontSize: '0.88rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  grupoBtnActivo: {
    background: 'var(--green-grad)',
    color: '#fff',
    borderColor: 'transparent',
    boxShadow: '0 4px 14px rgba(12, 122, 95, 0.35)',
    fontWeight: 600,
  },
  lista: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px' },
  ejercicioItem: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: '1px solid var(--highlight)',
    color: 'var(--text)',
    padding: '14px 16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    textAlign: 'left',
    borderRadius: 'var(--r-md)',
    boxShadow: 'var(--shadow-sm)',
    gap: '12px',
  },
  ejercicioNombre: { fontSize: '0.98rem', fontWeight: 500 },
  ejercicioGrupo: {
    fontSize: '0.72rem',
    color: 'var(--green)',
    background: 'var(--green-glow)',
    padding: '4px 10px', borderRadius: '12px',
    border: '1px solid rgba(93, 202, 165, 0.25)',
    fontWeight: 600,
  },
  customBtn: {
    margin: '14px 16px',
    marginBottom: 'max(14px, env(safe-area-inset-bottom))',
    padding: '14px',
    background: 'transparent',
    color: 'var(--green)',
    border: '1px dashed rgba(93, 202, 165, 0.4)',
    borderRadius: 'var(--r-md)',
    fontSize: '0.95rem',
    fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  },
  muted: { color: 'var(--text-dim)', textAlign: 'center', padding: '32px 16px' },
  skel: { height: '54px', borderRadius: 'var(--r-md)' },
  bodyConfig: { padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '10px' },
  label: { fontSize: '0.72rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 },
  input: { padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '1rem', outline: 'none' },
  inputNum: { padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '1.6rem', fontWeight: 800, outline: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box', letterSpacing: '-0.03em' },
  row: { display: 'flex', gap: '10px' },
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
    background: 'var(--green-grad)', color: '#fff',
    borderColor: 'transparent',
    boxShadow: '0 4px 14px rgba(12, 122, 95, 0.35)',
    fontWeight: 600,
  },
  confirmarBtn: {
    marginTop: '8px',
    padding: '17px',
    background: 'var(--green-grad)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--r-lg)',
    fontSize: '1rem', fontWeight: 700,
    boxShadow: '0 12px 30px rgba(12, 122, 95, 0.4)',
    letterSpacing: '-0.01em',
  },
}
