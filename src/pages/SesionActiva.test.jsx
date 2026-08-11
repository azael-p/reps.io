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
  getUltimaVezEjercicioLocal: vi.fn().mockReturnValue(null),
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
  useEnterShortcut: vi.fn(),
}))

import { getDoc } from 'firebase/firestore'
import { getEjerciciosDia } from '../firebase/ejerciciosDia'
import { getRegistrosSesion, getUltimaVezEjercicioLocal } from '../firebase/registros'
import { getSesionesConResumen } from '../firebase/sesiones'
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
    getDoc.mockResolvedValue({ data: () => ({ diaId: 'dia1', completada: false }) })
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

describe('SesionActiva — "última vez" y PR cruzando días distintos (mismo catalogoId)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDoc.mockResolvedValue({ data: () => ({ diaId: 'dia1', completada: false }) })
    getEjerciciosDia.mockResolvedValue([EJ1])
    getRegistrosSesion.mockResolvedValue([])
    getSesionesConResumen.mockResolvedValue([])
  })

  it('pide "última vez" pasando el ejercicio completo (con catalogoId), no solo el id del día', async () => {
    getUltimaVezEjercicioLocal.mockReturnValue(null)
    renderSesion()

    await waitFor(() => {
      expect(getUltimaVezEjercicioLocal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'ej1', catalogoId: 'press-banca-plano' }),
        expect.anything(),
      )
    })
  })

  it('el PR cruza una sesión de otro día que tiene el mismo catalogoId pero otro ejercicioId', async () => {
    getSesionesConResumen.mockResolvedValue([
      {
        id: 'ses-pecho1',
        fecha: { toMillis: () => new Date('2026-08-01').getTime() },
        resumen: {
          ejercicios: [
            {
              ejercicioId: 'ej-de-otro-dia', // id de ejerciciosDia distinto (otro día)
              catalogoId: 'press-banca-plano', // mismo ejercicio real
              nombre: 'Press de banca plano',
              series: [{ numeroSerie: 1, pesoUsado: 100, repsHechas: 5 }],
            },
          ],
        },
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
})
