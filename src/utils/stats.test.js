import { describe, it, expect } from 'vitest'
import { parsePeso, sanitizarPeso, lunesDeSemana, volumenSemanal, sesionesEsteMes, prMasReciente } from './stats'

// Los campos de peso usan type="text" + inputMode="decimal" en vez de
// type="number": con type="number" el navegador descartaba "82," y el estado
// quedaba vacío, así que la serie se guardaba con 0 kg sin ningún aviso.
// sanitizarPeso() es el filtro que reemplaza a esa validación nativa.
describe('sanitizarPeso', () => {
  it('deja pasar dígitos', () => {
    expect(sanitizarPeso('82')).toBe('82')
  })

  it('conserva la coma decimal, que es lo que sale del teclado es-AR', () => {
    expect(sanitizarPeso('82,5')).toBe('82,5')
  })

  it('conserva el punto decimal', () => {
    expect(sanitizarPeso('82.5')).toBe('82.5')
  })

  it('permite la coma sola mientras se está tipeando', () => {
    expect(sanitizarPeso('82,')).toBe('82,')
  })

  it('descarta letras y símbolos', () => {
    expect(sanitizarPeso('82kg')).toBe('82')
    expect(sanitizarPeso('-82')).toBe('82')
    expect(sanitizarPeso('8e2')).toBe('82')
  })

  it('colapsa separadores de más en vez de aceptar dos comas', () => {
    expect(sanitizarPeso('82,5,3')).toBe('82,53')
    expect(sanitizarPeso('82.5.3')).toBe('82.53')
  })

  it('respeta el primer separador cuando se mezclan', () => {
    expect(sanitizarPeso('82,5.3')).toBe('82,53')
  })

  it('devuelve string vacío si no queda nada utilizable', () => {
    expect(sanitizarPeso('abc')).toBe('')
    expect(sanitizarPeso('')).toBe('')
  })
})

describe('sanitizarPeso + parsePeso', () => {
  it('un peso con coma termina siendo un número, no 0', () => {
    // El bug original: Number('82,5') es NaN y el `|| 0` lo volvía 0 kg.
    expect(Number(sanitizarPeso('82,5'))).toBeNaN()
    expect(parsePeso(sanitizarPeso('82,5'))).toBe(82.5)
  })

  it('el peso entero sigue funcionando igual', () => {
    expect(parsePeso(sanitizarPeso('60'))).toBe(60)
  })
})

// ---------------------------------------------------------------------------

describe('volumenSemanal', () => {
  it('suma el volumen de esta semana y de la anterior por separado', () => {
    const lunesActual = lunesDeSemana(new Date()).getTime()
    const lunesAnterior = lunesActual - 7 * 86400000
    const volumenPorSesion = [
      { fecha: lunesActual + 86400000, volumen: 500 },
      { fecha: lunesActual + 2 * 86400000, volumen: 300 },
      { fecha: lunesAnterior + 86400000, volumen: 1000 },
    ]
    expect(volumenSemanal(volumenPorSesion)).toEqual({ actual: 800, anterior: 1000 })
  })

  it('sin registros, ambos en 0', () => {
    expect(volumenSemanal([])).toEqual({ actual: 0, anterior: 0 })
  })

  it('ignora semanas más viejas que la anterior', () => {
    const hace3Semanas = lunesDeSemana(new Date()).getTime() - 21 * 86400000
    expect(volumenSemanal([{ fecha: hace3Semanas, volumen: 999 }])).toEqual({ actual: 0, anterior: 0 })
  })
})

describe('sesionesEsteMes', () => {
  it('cuenta solo los epochs del mes calendario actual', () => {
    const hoy = new Date()
    const esteMes = new Date(hoy.getFullYear(), hoy.getMonth(), 5).getTime()
    const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 5).getTime()
    expect(sesionesEsteMes([esteMes, mesPasado])).toBe(1)
  })

  it('sin días entrenados, devuelve 0', () => {
    expect(sesionesEsteMes([])).toBe(0)
    expect(sesionesEsteMes(undefined)).toBe(0)
  })
})

describe('prMasReciente', () => {
  it('devuelve el ejercicio con el pr.fecha más reciente', () => {
    const statsEjercicios = [
      { nombre: 'Press Banca', pr: { maxPeso: 80, fecha: 1000 } },
      { nombre: 'Sentadilla', pr: { maxPeso: 102.5, fecha: 2000 } },
      { nombre: 'Peso Muerto', pr: null },
    ]
    expect(prMasReciente(statsEjercicios)).toEqual({ nombre: 'Sentadilla', tipo: 'peso', maxPeso: 102.5, fecha: 2000 })
  })

  it('sin ningún PR todavía, devuelve null', () => {
    expect(prMasReciente([{ nombre: 'X', pr: null }])).toBeNull()
    expect(prMasReciente([])).toBeNull()
  })

  it('compara también contra prVolumen (récord de volumen en una serie) y gana el más reciente de los dos tipos', () => {
    const statsEjercicios = [
      { nombre: 'Press Banca', pr: { maxPeso: 80, fecha: 3000 }, prVolumen: { pesoUsado: 70, repsHechas: 8, fecha: 1000 } },
      { nombre: 'Sentadilla', pr: { maxPeso: 100, fecha: 500 }, prVolumen: { pesoUsado: 100, repsHechas: 11, fecha: 4000 } },
    ]
    expect(prMasReciente(statsEjercicios)).toEqual({
      nombre: 'Sentadilla', tipo: 'volumen', pesoUsado: 100, repsHechas: 11, fecha: 4000,
    })
  })

  it('un ejercicio con solo prVolumen (sin pr de peso) igual cuenta', () => {
    const statsEjercicios = [{ nombre: 'Sentadilla', pr: null, prVolumen: { pesoUsado: 100, repsHechas: 10, fecha: 1000 } }]
    expect(prMasReciente(statsEjercicios)).toEqual({ nombre: 'Sentadilla', tipo: 'volumen', pesoUsado: 100, repsHechas: 10, fecha: 1000 })
  })
})
