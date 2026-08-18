vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReferenciaCard from './ReferenciaCard'

const REF_ANTERIOR = {
  fecha: new Date(),
  series: [
    { numeroSerie: 1, pesoUsado: 80, repsHechas: 8 },
    { numeroSerie: 2, pesoUsado: 82, repsHechas: 7 },
  ],
}

const REF_PR = {
  maxPeso: 90,
  series: [
    { numeroSerie: 1, pesoUsado: 90, repsHechas: 5 },
  ],
}

function renderCard(props = {}) {
  const utils = render(
    <ReferenciaCard
      tabRef="ultima" setTabRef={vi.fn()}
      refAnterior={undefined} refPR={undefined} serieActual={1}
      {...props}
    />
  )
  const resumen = () => utils.container.querySelector('.sa-ref-valor-compact')?.textContent
  return { ...utils, resumen }
}

// ---------------------------------------------------------------------------

describe('ReferenciaCard — bloque único (destacado de la serie + resumen completo)', () => {
  it('con dato para la serie actual, muestra el destacado Y el resumen de todas las series', () => {
    const { resumen } = renderCard({ refAnterior: REF_ANTERIOR, serieActual: 2 })

    expect(screen.getByText('Última vez — serie 2')).toBeInTheDocument()
    expect(screen.getByText('82 kg × 7 reps')).toBeInTheDocument()
    // Resumen completo, con las dos series listadas.
    expect(resumen()).toContain('80kg × 8')
    expect(resumen()).toContain('82kg × 7')
  })

  it('sin dato para la serie puntual (ej. serie 5 no existe en la referencia), no muestra el destacado pero sí el resumen', () => {
    const { resumen } = renderCard({ refAnterior: REF_ANTERIOR, serieActual: 5 })

    expect(screen.queryByText(/Última vez — serie 5/)).not.toBeInTheDocument()
    expect(resumen()).toContain('80kg × 8')
  })

  it('primera vez con el ejercicio: sin destacado ni resumen, solo el mensaje vacío', () => {
    renderCard({ refAnterior: null })
    expect(screen.getByText('Primera vez con este ejercicio 🎉')).toBeInTheDocument()
  })

  it('cargando: muestra el skeleton', () => {
    renderCard({ refAnterior: undefined })
    expect(screen.getByText('Última vez')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------

describe('ReferenciaCard — tab PR', () => {
  it('con marca personal, muestra el destacado con el ícono de trofeo', () => {
    renderCard({ tabRef: 'pr', refPR: REF_PR, serieActual: 1 })

    expect(screen.getByText('PR personal — serie 1')).toBeInTheDocument()
    expect(screen.getByText('90 kg × 5 reps')).toBeInTheDocument()
    expect(screen.getByText(/Tu marca: 90kg/)).toBeInTheDocument()
  })

  it('sin marca todavía, muestra el mensaje vacío', () => {
    renderCard({ tabRef: 'pr', refPR: null })
    expect(screen.getByText('Sin marca todavía')).toBeInTheDocument()
  })
})
