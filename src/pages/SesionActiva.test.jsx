import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../firebase/config', () => ({ db: {} }))
vi.mock('../firebase/analytics', () => ({ logEvento: vi.fn() }))
vi.mock('../hooks/useDesktop', () => ({ useDesktop: () => false }))
vi.mock('../context/UserContext', () => ({
  useUser: () => ({ usuario: { id: 'user1', nombre: 'Test' } }),
}))
vi.mock('../firebase/sesiones', () => ({
  getSesionesConResumen: vi.fn().mockResolvedValue([]),
  eliminarSesion: vi.fn(),
}))
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
import { getRegistrosSesion } from '../firebase/registros'
import SesionActiva from './SesionActiva'

const EJ1 = { id: 'ej1', nombre: 'Press Banca', grupoMuscular: 'Pecho', seriesEsperadas: 3, repsEsperadas: 8, orden: 1 }

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
