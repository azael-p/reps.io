import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimer } from './useTimer'

const CONFIG = { calentamiento: 10, trabajo: 5, descanso: 3, sets: 3, enfriamiento: 8 }
const CONFIG_1_SET = { calentamiento: 5, trabajo: 5, descanso: 3, sets: 1, enfriamiento: 5 }

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useTimer', () => {
  it('estado inicial correcto antes de iniciar', () => {
    const { result } = renderHook(() => useTimer())
    expect(result.current.iniciado).toBe(false)
    expect(result.current.fase).toBeNull()
  })

  it('fase inicial es calentamiento al llamar iniciar()', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    expect(result.current.fase).toBe('calentamiento')
    expect(result.current.iniciado).toBe(true)
  })

  it('setActual empieza en 1', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    expect(result.current.setActual).toBe(1)
  })

  it('después del calentamiento pasa a trabajo', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    act(() => { vi.advanceTimersByTime(CONFIG.calentamiento * 1000 + 500) })
    expect(result.current.fase).toBe('trabajo')
  })

  it('después de trabajo (set intermedio) pasa a descanso', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    act(() => { vi.advanceTimersByTime((CONFIG.calentamiento + CONFIG.trabajo) * 1000 + 500) })
    expect(result.current.fase).toBe('descanso')
    expect(result.current.setActual).toBe(1)
  })

  it('después del último trabajo pasa directo a enfriamiento', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    // calentamiento + (trabajo + descanso) * (sets-1) + trabajo = último set
    const tiempoHastaUltimoTrabajo = CONFIG.calentamiento + (CONFIG.trabajo + CONFIG.descanso) * (CONFIG.sets - 1)
    act(() => { vi.advanceTimersByTime((tiempoHastaUltimoTrabajo + CONFIG.trabajo) * 1000 + 500) })
    expect(result.current.fase).toBe('enfriamiento')
  })

  it('después del enfriamiento la fase es fin', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    const total = CONFIG.calentamiento
      + (CONFIG.trabajo + CONFIG.descanso) * (CONFIG.sets - 1)
      + CONFIG.trabajo
      + CONFIG.enfriamiento
    act(() => { vi.advanceTimersByTime(total * 1000 + 500) })
    expect(result.current.fase).toBe('fin')
  })

  it('setActual incrementa correctamente entre sets', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    // After calentamiento + trabajo + descanso => set 2
    act(() => { vi.advanceTimersByTime((CONFIG.calentamiento + CONFIG.trabajo + CONFIG.descanso) * 1000 + 500) })
    expect(result.current.setActual).toBe(2)
    expect(result.current.fase).toBe('trabajo')
  })

  it('pausar() detiene la cuenta', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    act(() => { vi.advanceTimersByTime(2000) })
    const segsBefore = result.current.segundosRestantes
    act(() => { result.current.pausar() })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.segundosRestantes).toBe(segsBefore)
    expect(result.current.pausado).toBe(true)
  })

  it('reanudar() retoma la cuenta desde donde se pausó', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    act(() => { result.current.pausar() })
    const segsPausado = result.current.segundosRestantes
    act(() => { result.current.reanudar() })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.segundosRestantes).toBeLessThan(segsPausado)
    expect(result.current.pausado).toBe(false)
  })

  it('saltarIntervalo() en fase intermedia avanza a la siguiente fase', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    expect(result.current.fase).toBe('calentamiento')
    act(() => { result.current.saltarIntervalo() })
    expect(result.current.fase).toBe('trabajo')
  })

  it('saltarIntervalo() en trabajo del último set va a enfriamiento (no a descanso)', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    // Advance to last set trabajo
    const tiempoHastaUltimoTrabajo = CONFIG.calentamiento + (CONFIG.trabajo + CONFIG.descanso) * (CONFIG.sets - 1)
    act(() => { vi.advanceTimersByTime(tiempoHastaUltimoTrabajo * 1000 + 100) })
    expect(result.current.fase).toBe('trabajo')
    expect(result.current.setActual).toBe(CONFIG.sets)
    act(() => { result.current.saltarIntervalo() })
    expect(result.current.fase).toBe('enfriamiento')
  })

  it('terminar() resetea el estado', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    act(() => { result.current.terminar() })
    expect(result.current.iniciado).toBe(false)
    expect(result.current.fase).toBeNull()
  })

  it('con sets = 1, el flujo es calentamiento → trabajo → enfriamiento → fin (sin descanso)', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG_1_SET) })
    expect(result.current.fase).toBe('calentamiento')
    act(() => { result.current.saltarIntervalo() })
    expect(result.current.fase).toBe('trabajo')
    expect(result.current.setActual).toBe(1)
    act(() => { result.current.saltarIntervalo() })
    expect(result.current.fase).toBe('enfriamiento')
    act(() => { result.current.saltarIntervalo() })
    expect(result.current.fase).toBe('fin')
  })

  it('con sets = 3, descanso solo entre sets, no al final', () => {
    const { result } = renderHook(() => useTimer())
    act(() => { result.current.iniciar(CONFIG) })
    act(() => { result.current.saltarIntervalo() }) // cal → trabajo(1)
    act(() => { result.current.saltarIntervalo() }) // trabajo(1) → descanso(1)
    expect(result.current.fase).toBe('descanso')
    act(() => { result.current.saltarIntervalo() }) // descanso(1) → trabajo(2)
    expect(result.current.fase).toBe('trabajo')
    expect(result.current.setActual).toBe(2)
    act(() => { result.current.saltarIntervalo() }) // trabajo(2) → descanso(2)
    expect(result.current.fase).toBe('descanso')
    act(() => { result.current.saltarIntervalo() }) // descanso(2) → trabajo(3)
    expect(result.current.fase).toBe('trabajo')
    expect(result.current.setActual).toBe(3)
    act(() => { result.current.saltarIntervalo() }) // trabajo(3) → enfriamiento (NO descanso)
    expect(result.current.fase).toBe('enfriamiento')
  })

  describe('recuperación tras congelamiento del interval (pantalla bloqueada)', () => {
    it('un solo tick con reloj adelantado salta varias fases completas y aterriza en la correcta', () => {
      const { result } = renderHook(() => useTimer())
      act(() => { result.current.iniciar(CONFIG) })
      // "Dormimos" el reloj del sistema 21.25s sin avanzar el fake-timer clock,
      // simulando que el navegador congeló la ejecución con la pantalla bloqueada.
      act(() => { vi.setSystemTime(Date.now() + 21250) })
      // Dispara solo el próximo tick agendado, no los 85 ticks intermedios.
      act(() => { vi.advanceTimersByTime(250) })
      // elapsed real = 21.5s → cae en trabajo del set 2 [18,23), a 3.5s de iniciado
      expect(result.current.fase).toBe('trabajo')
      expect(result.current.setActual).toBe(2)
      expect(result.current.segundosRestantes).toBe(2) // ceil(5 - 3.5)
    })

    it('el reloj adelantado exactamente hasta el final aterriza en fin', () => {
      const { result } = renderHook(() => useTimer())
      act(() => { result.current.iniciar(CONFIG) })
      const total = CONFIG.calentamiento
        + (CONFIG.trabajo + CONFIG.descanso) * (CONFIG.sets - 1)
        + CONFIG.trabajo
        + CONFIG.enfriamiento
      act(() => { vi.setSystemTime(Date.now() + total * 1000) })
      act(() => { vi.advanceTimersByTime(250) })
      expect(result.current.fase).toBe('fin')
    })

    it('el reloj adelantado mucho más allá del timer completo también aterriza en fin, sin colgar', () => {
      const { result } = renderHook(() => useTimer())
      act(() => { result.current.iniciar(CONFIG) })
      act(() => { vi.setSystemTime(Date.now() + 5 * 60 * 1000) }) // 5 minutos
      act(() => { vi.advanceTimersByTime(250) })
      expect(result.current.fase).toBe('fin')
    })

    it('tiempoTotalSegundos en fin refleja el tiempo real dormido, no la suma nominal de fases', () => {
      const { result } = renderHook(() => useTimer())
      act(() => { result.current.iniciar(CONFIG) })
      act(() => { vi.setSystemTime(Date.now() + 5 * 60 * 1000) })
      act(() => { vi.advanceTimersByTime(250) })
      expect(result.current.fase).toBe('fin')
      expect(result.current.tiempoTotalSegundos).toBe(300)
    })

    it('config con todas las fases en 0 segundos no cuelga el timer', () => {
      const CONFIG_CERO = { calentamiento: 0, trabajo: 0, descanso: 0, sets: 5, enfriamiento: 0 }
      const { result } = renderHook(() => useTimer())
      act(() => { result.current.iniciar(CONFIG_CERO) })
      act(() => { vi.advanceTimersByTime(250) })
      expect(result.current.fase).toBe('fin')
    })

    it('saltarIntervalo() sigue avanzando una sola fase, sin verse afectado por el fix', () => {
      const { result } = renderHook(() => useTimer())
      act(() => { result.current.iniciar(CONFIG) })
      act(() => { result.current.saltarIntervalo() })
      expect(result.current.fase).toBe('trabajo')
      expect(result.current.setActual).toBe(1)
    })
  })
})
