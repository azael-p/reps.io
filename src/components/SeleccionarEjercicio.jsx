import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import Fuse from 'fuse.js'
import { getCatalogo } from '../firebase/catalogo'
import { Search, X, ChevronLeft } from 'lucide-react'
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
  const [errorConfig, setErrorConfig] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    getCatalogo().then(c => { setCatalogo(c); setCargando(false) }).catch(() => setCargando(false))
  }, [])

  const onCerrarRef = useRef(onCerrar)
  useEffect(() => { onCerrarRef.current = onCerrar }, [onCerrar])

  const handlerRef = useRef(() => onCerrarRef.current?.())
  const levelRef = useRef(0) // 0 = catálogo, 1 = "Configurar"

  useEffect(() => {
    const timer = setTimeout(() => window.history.pushState({ pickerLevel: 0 }, ''), 0)
    const dispatch = () => handlerRef.current?.()
    window.addEventListener('popstate', dispatch)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('popstate', dispatch)
      // Retrocede de una sola vez tantos niveles como quedaron sin cerrar
      // con "atrás" (0 si solo se abrió el catálogo, 1 si se llegó a
      // "Configurar" y se salió por otro lado, ej. confirmar()). Un único
      // history.go(-N) evita depender de que varios history.back()
      // sucesivos se procesen como pasos separados — inconsistente entre
      // navegadores cuando se llaman en el mismo tick síncrono.
      if (window.history.state?.pickerLevel != null) window.history.go(-(levelRef.current + 1))
    }
  }, [])

  useEffect(() => {
    levelRef.current = ejercicioElegido ? 1 : 0
    if (!ejercicioElegido) {
      handlerRef.current = () => onCerrarRef.current?.()
      return
    }
    window.history.pushState({ pickerLevel: 1 }, '')
    handlerRef.current = () => setEjercicioElegido(null)
  }, [ejercicioElegido])

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

  // Series/reps se resetean acá, no en el useEffect de arriba: son un
  // setState directo (no dependen de nada async), así que el handler de
  // selección es el lugar correcto — evita además re-disparar el efecto que
  // maneja el pushState del historial por un cambio que no le compete.
  function elegirEjercicio(e) {
    setSeries('3')
    setReps('10')
    setErrorConfig('')
    setEjercicioElegido(e)
  }

  function confirmar() {
    const seriesNum = Number(series)
    const repsNum = Number(reps)
    if (!series || !reps || Number.isNaN(seriesNum) || Number.isNaN(repsNum) || seriesNum < 1 || repsNum < 1) {
      setErrorConfig('Series y reps deben ser mayores a 0')
      return
    }
    onSeleccionar({ nombre: ejercicioElegido.nombre, grupoMuscular: ejercicioElegido.grupoMuscular, esCustom: false, catalogoId: ejercicioElegido.id, seriesEsperadas: seriesNum, repsEsperadas: repsNum })
  }

  if (ejercicioElegido) {
    return createPortal(
      <motion.div
        className="picker-page"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
      >
        <div className="picker-header">
          <motion.button
            className="picker-back"
            onClick={() => window.history.back()}
            whileTap={{ scale: 0.9, x: -2 }}
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </motion.button>
          <div className="picker-header-info">
            <p className="picker-header-sub">Configurar</p>
            <h2 className="picker-titulo">{ejercicioElegido.nombre}</h2>
          </div>
        </div>

        <div className="picker-body-config">
          <div className="picker-row">
            <div className="picker-field">
              <label className="picker-label">Series</label>
              <input className="picker-input-num" type="number" inputMode="numeric" min="1" max="20" value={series} onChange={e => { setSeries(e.target.value); setErrorConfig('') }} />
            </div>
            <div className="picker-field">
              <label className="picker-label">Reps</label>
              <input className="picker-input-num" type="number" inputMode="numeric" min="1" max="100" value={reps} onChange={e => { setReps(e.target.value); setErrorConfig('') }} />
            </div>
          </div>

          {errorConfig && <p className="picker-error-msg">{errorConfig}</p>}

          <motion.button
            className="btn btn-primary-green btn-lg picker-confirmar-btn"
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
      className="picker-page"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="picker-header">
        <motion.button className="picker-back" onClick={() => window.history.back()} whileTap={{ scale: 0.9 }}>
          <ChevronLeft size={20} strokeWidth={2} />
        </motion.button>
        <div className="picker-header-info">
          <p className="picker-header-sub">Catálogo</p>
          <h2 className="picker-titulo">Elegir ejercicio</h2>
        </div>
      </div>

      <div className="picker-search-wrap">
        <div className="picker-search-inner">
          <span className="picker-search-icon"><Search size={16} /></span>
          <input
            className="picker-search"
            placeholder="Buscar..."
            inputMode="search"
            autoFocus={isDesktop}
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setGrupoActivo(null) }}
          />
          {busqueda && (
            <motion.button
              aria-label="Limpiar búsqueda"
              className="picker-clear-btn"
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

      <div className="picker-grupos">
        <motion.button
          className={`picker-grupo-btn ${grupoActivo === null && !busqueda ? 'picker-grupo-btn--activo' : ''}`}
          onClick={() => { setGrupoActivo(null); setBusqueda('') }}
          whileTap={{ scale: 0.94 }}
        >
          Todos
        </motion.button>
        {GRUPOS.map(g => (
          <motion.button
            key={g}
            className={`picker-grupo-btn ${grupoActivo === g ? 'picker-grupo-btn--activo' : ''}`}
            onClick={() => { setGrupoActivo(g); setBusqueda('') }}
            whileTap={{ scale: 0.94 }}
          >
            {g}
          </motion.button>
        ))}
      </div>

      <div className="picker-lista">
        {cargando ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton picker-skel" />
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {filtrados.length === 0 ? (
              <motion.p
                className="picker-muted"
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
                  className="card picker-ejercicio-item"
                  onClick={() => elegirEjercicio(e)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.015 }}
                  whileTap={{ scale: 0.98, backgroundColor: 'var(--bg-card-hover)' }}
                >
                  <span className="picker-ejercicio-nombre">{e.nombre}</span>
                  <Badge color="green">{e.grupoMuscular}</Badge>
                </motion.button>
              ))
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>,
    document.body
  )
}
