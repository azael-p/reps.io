import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

vi.mock('../firebase/config', () => ({ db: {} }))
vi.mock('../firebase/analytics', () => ({ logEvento: vi.fn() }))
vi.mock('../hooks/useDesktop', () => ({ useDesktop: () => false }))
vi.mock('../context/UserContext', () => ({
  useUser: () => ({ usuario: { id: 'user1', nombre: 'Test' } }),
}))
// esMismoEjercicio se deja real (importOriginal) — es lo que se está probando.
vi.mock('../firebase/sesiones', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getSesionesConResumen: vi.fn().mockResolvedValue([]),
    eliminarSesion: vi.fn(),
  }
})
vi.mock('../firebase/ejerciciosDia', () => ({
  getEjerciciosDia: vi.fn(),
}))
vi.mock('../firebase/registros', () => ({
  getRegistrosSesion: vi.fn(),
  agregarRegistro: vi.fn(),
  editarRegistro: vi.fn(),
}))
vi.mock('../firebase/statsEjercicios', () => ({
  getStatsEjerciciosConFallback: vi.fn().mockResolvedValue([]),
}))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}))
vi.mock('../components/ui', () => ({
  ConfirmDialog: () => null,
  Badge: ({ children }) => <span>{children}</span>,
}))
vi.mock('../components/Toast', () => ({
  useToast: () => ({ show: vi.fn(), dismiss: vi.fn() }),
  ToastProvider: ({ children }) => children,
}))
vi.mock('../hooks/useKeyboardShortcut', () => ({
  useKeyboardShortcut: vi.fn(),
}))

import { getDoc } from 'firebase/firestore'
import { getEjerciciosDia } from '../firebase/ejerciciosDia'
import { getRegistrosSesion } from '../firebase/registros'
import { getStatsEjerciciosConFallback } from '../firebase/statsEjercicios'
import SesionActiva from './SesionActiva'

const EJ1 = { id: 'ej1', catalogoId: 'press-banca-plano', nombre: 'Press Banca', grupoMuscular: 'Pecho', seriesEsperadas: 3, repsEsperadas: 8, orden: 1 }

function renderSesion(sesionId = 'ses1') {
  return render(
    <MemoryRouter initialEntries={[`/sesion/${sesionId}`]}>
      <Routes>
        <Route path="/sesion/:sesionId" element={<SesionActiva />} />
        <Route path="/sesion/:sesionId/resumen" element={<div data-testid="resumen" />} />
      </Routes>
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------

describe('SesionActiva — restauración desde Firestore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: false }) })
    getEjerciciosDia.mockResolvedValue([EJ1])
  })

  it('carga ejercicios desde Firestore al montar', async () => {
    getRegistrosSesion.mockResolvedValue([])

    renderSesion()

    await waitFor(() => {
      expect(getEjerciciosDia).toHaveBeenCalledWith('dia1')
    })
  })

  it('restaura posición a la serie correcta si hay registros previos', async () => {
    // 2 series completadas de 3 → debe restaurar en serie 3
    getRegistrosSesion.mockResolvedValue([
      { id: 'r1', ejercicioId: 'ej1', numeroSerie: 1, pesoUsado: 80, repsHechas: 8, nota: '' },
      { id: 'r2', ejercicioId: 'ej1', numeroSerie: 2, pesoUsado: 82, repsHechas: 7, nota: '' },
    ])

    renderSesion()

    await waitFor(() => {
      expect(screen.getByText(/serie.*3/i)).toBeTruthy()
    })
  })

  it('redirige a resumen si todos los ejercicios ya están completos', async () => {
    // 3 series completadas de 3 → sesión finalizada
    getRegistrosSesion.mockResolvedValue([
      { id: 'r1', ejercicioId: 'ej1', numeroSerie: 1, pesoUsado: 80, repsHechas: 8, nota: '' },
      { id: 'r2', ejercicioId: 'ej1', numeroSerie: 2, pesoUsado: 80, repsHechas: 8, nota: '' },
      { id: 'r3', ejercicioId: 'ej1', numeroSerie: 3, pesoUsado: 80, repsHechas: 8, nota: '' },
    ])

    renderSesion()

    await waitFor(() => {
      expect(screen.getByTestId('resumen')).toBeTruthy()
    })
  })

  it('guarda sesionId en localStorage al montar', async () => {
    getRegistrosSesion.mockResolvedValue([])
    renderSesion('ses-abc')

    await waitFor(() => {
      expect(localStorage.getItem('sesion_activa_user1')).toBe('ses-abc')
    })
  })
})

// ---------------------------------------------------------------------------

describe('SesionActiva — "última vez" y PR desde statsEjercicios (cruce por catalogoId)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: false }) })
    getEjerciciosDia.mockResolvedValue([EJ1])
    getRegistrosSesion.mockResolvedValue([])
    getStatsEjerciciosConFallback.mockResolvedValue([])
  })

  it('muestra "última vez" desde el doc de stats que comparte catalogoId (aunque el nombre difiera)', async () => {
    getStatsEjerciciosConFallback.mockResolvedValue([
      {
        id: 'press-banca-plano',
        catalogoId: 'press-banca-plano', // mismo ejercicio real, nombre distinto
        nombre: 'Press de banca plano',
        grupoMuscular: 'Pecho',
        pr: null,
        ultimaVez: {
          fecha: new Date('2026-08-01').getTime(),
          sesionId: 'otra-sesion',
          series: [{ numeroSerie: 1, pesoUsado: 80, repsHechas: 8 }],
        },
        puntos: [],
      },
    ])

    renderSesion()

    await waitFor(() => {
      expect(screen.getByText(/80kg ×/)).toBeInTheDocument()
    })
  })

  it('el PR sale del doc de stats con el mismo catalogoId pero otro ejercicioId', async () => {
    getStatsEjerciciosConFallback.mockResolvedValue([
      {
        id: 'press-banca-plano',
        catalogoId: 'press-banca-plano',
        nombre: 'Press de banca plano',
        grupoMuscular: 'Pecho',
        pr: {
          maxPeso: 100,
          fecha: new Date('2026-08-01').getTime(),
          sesionId: 'otra-sesion',
          series: [{ numeroSerie: 1, pesoUsado: 100, repsHechas: 5 }],
        },
        ultimaVez: null,
        puntos: [],
      },
    ])

    renderSesion()

    const user = userEvent.setup()
    await waitFor(() => screen.getByText(/PR personal/i))
    await user.click(screen.getByText('PR personal'))

    await waitFor(() => {
      expect(screen.getByText(/Tu marca: 100kg/i)).toBeInTheDocument()
    })
  })

  it('la referencia de la sesión en curso se ignora (no se muestra a sí misma como "última vez")', async () => {
    getStatsEjerciciosConFallback.mockResolvedValue([
      {
        id: 'press-banca-plano',
        catalogoId: 'press-banca-plano',
        nombre: 'Press Banca',
        grupoMuscular: 'Pecho',
        pr: null,
        ultimaVez: { fecha: Date.now(), sesionId: 'ses1', series: [{ numeroSerie: 1, pesoUsado: 90, repsHechas: 5 }] },
        puntos: [],
      },
    ])

    renderSesion() // renderSesion usa sesionId 'ses1'

    await waitFor(() => {
      expect(screen.getByText(/Primera vez con este ejercicio/)).toBeInTheDocument()
    })
  })
})
