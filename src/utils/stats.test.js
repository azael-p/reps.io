import { describe, it, expect } from 'vitest'
import { parsePeso, sanitizarPeso } from './stats'

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
