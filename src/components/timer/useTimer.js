import { useRef, useState, useCallback, useEffect } from 'react'

function calcularSiguienteFase(fase, setActual, config) {
  if (fase === 'calentamiento') return { fase: 'trabajo', setActual }
  if (fase === 'trabajo') {
    if (setActual >= config.sets) return { fase: 'enfriamiento', setActual }
    return { fase: 'descanso', setActual }
  }
  if (fase === 'descanso') return { fase: 'trabajo', setActual: setActual + 1 }
  if (fase === 'enfriamiento') return { fase: 'fin', setActual }
  return null
}

function duracionFase(fase, config) {
  if (fase === 'calentamiento') return config.calentamiento
  if (fase === 'trabajo') return config.trabajo
  if (fase === 'descanso') return config.descanso
  if (fase === 'enfriamiento') return config.enfriamiento
  return 0
}

const ESTADO_INICIAL = {
  fase: null,
  segundosRestantes: 0,
  setActual: 1,
  pausado: false,
  config: null,
  iniciado: false,
}

export function useTimer() {
  const [estado, setEstado] = useState(ESTADO_INICIAL)

  // Refs for mutable values read inside interval callbacks
  const estadoRef = useRef(ESTADO_INICIAL)
  const intervalRef = useRef(null)
  const timestampInicioFaseRef = useRef(null)
  const segundosPausadosRef = useRef(0)
  const pausaInicioRef = useRef(null)
  const tiempoTotalInicioRef = useRef(null)

  // Updates ref synchronously BEFORE triggering React re-render.
  // This is critical: interval callbacks read estadoRef.current, and
  // React's setState updater runs asynchronously, so updating only inside
  // the updater would leave the ref stale for subsequent ticks.
  const setEstadoSync = useCallback((updater) => {
    const prev = estadoRef.current
    const next = typeof updater === 'function' ? updater(prev) : updater
    estadoRef.current = next
    setEstado(next)
  }, [])

  const detenerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // iniciarFase is defined as a ref so interval callbacks always call the latest version
  const iniciarFaseRef = useRef(null)
  iniciarFaseRef.current = (fase, setActual, config) => {
    const duracion = duracionFase(fase, config)
    timestampInicioFaseRef.current = Date.now()
    segundosPausadosRef.current = 0
    pausaInicioRef.current = null

    setEstadoSync(prev => ({
      ...prev,
      fase,
      setActual,
      segundosRestantes: duracion,
      pausado: false,
      config,
    }))

    detenerInterval()
    if (fase === 'fin') return

    intervalRef.current = setInterval(() => {
      const cur = estadoRef.current
      if (!cur.iniciado || cur.pausado) return

      const elapsed = (Date.now() - timestampInicioFaseRef.current - segundosPausadosRef.current) / 1000
      const restantes = Math.max(0, Math.ceil(duracionFase(cur.fase, cur.config) - elapsed))

      if (restantes <= 0) {
        const siguiente = calcularSiguienteFase(cur.fase, cur.setActual, cur.config)
        if (siguiente) {
          iniciarFaseRef.current(siguiente.fase, siguiente.setActual, cur.config)
        }
        return
      }

      setEstadoSync(prev => ({ ...prev, segundosRestantes: restantes }))
    }, 250)
  }

  const iniciar = useCallback((config) => {
    tiempoTotalInicioRef.current = Date.now()
    const next = { ...ESTADO_INICIAL, iniciado: true, config }
    estadoRef.current = next
    setEstado(next)
    iniciarFaseRef.current('calentamiento', 1, config)
  }, [setEstadoSync]) // eslint-disable-line

  const pausar = useCallback(() => {
    if (estadoRef.current.pausado) return
    pausaInicioRef.current = Date.now()
    setEstadoSync(prev => ({ ...prev, pausado: true }))
  }, [setEstadoSync])

  const reanudar = useCallback(() => {
    if (!estadoRef.current.pausado) return
    if (pausaInicioRef.current) {
      segundosPausadosRef.current += Date.now() - pausaInicioRef.current
      pausaInicioRef.current = null
    }
    setEstadoSync(prev => ({ ...prev, pausado: false }))
  }, [setEstadoSync])

  const saltarIntervalo = useCallback(() => {
    const cur = estadoRef.current
    if (!cur.iniciado || cur.fase === 'fin') return
    const siguiente = calcularSiguienteFase(cur.fase, cur.setActual, cur.config)
    if (siguiente) iniciarFaseRef.current(siguiente.fase, siguiente.setActual, cur.config)
  }, []) // eslint-disable-line

  const terminar = useCallback(() => {
    detenerInterval()
    const next = { ...ESTADO_INICIAL }
    estadoRef.current = next
    setEstado(next)
    tiempoTotalInicioRef.current = null
  }, [detenerInterval])

  useEffect(() => () => detenerInterval(), [detenerInterval])

  const tiempoTotalSegundos = tiempoTotalInicioRef.current
    ? Math.round((Date.now() - tiempoTotalInicioRef.current) / 1000)
    : 0

  return { ...estado, tiempoTotalSegundos, iniciar, pausar, reanudar, saltarIntervalo, terminar }
}
