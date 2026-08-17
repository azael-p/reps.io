import { render, waitFor, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../firebase/config', () => ({ db: {} }))
vi.mock('../firebase/analytics', () => ({ logEvento: vi.fn() }))
vi.mock('../hooks/useDesktop', () => ({ useDesktop: () => false }))
vi.mock('../context/UserContext', () => ({
  useUser: () => ({ usuario: { id: 'user1', nombre: 'Test' } }),
}))
vi.mock('../firebase/sesiones', () => ({
  backfillResumen: vi.fn(),
  actualizarNotaSesion: vi.fn(),
}))
vi.mock('../firebase/completarSesion', () => ({ completarSesionConAgregados: vi.fn() }))
vi.mock('../firebase/registros', () => ({
  getRegistrosSesion: vi.fn(),
  editarRegistro: vi.fn(),
}))
vi.mock('../firebase/statsGlobal', () => ({ aplicarSesionAResumenGlobal: vi.fn() }))
vi.mock('../firebase/statsEjercicios', () => ({
  aplicarSesionAStats: vi.fn(),
  rebuildStatsEjercicios: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}))
vi.mock('../components/ui', () => ({
  Modal: ({ children, open }) => (open ? <div data-testid="modal">{children}</div> : null),
  PageWrapper: ({ children }) => <div>{children}</div>,
}))
const mockShow = vi.fn()
vi.mock('../components/Toast', () => ({
  useToast: () => ({ show: mockShow }),
}))

import { getDoc } from 'firebase/firestore'
import { backfillResumen } from '../firebase/sesiones'
import { completarSesionConAgregados } from '../firebase/completarSesion'
import { aplicarSesionAResumenGlobal } from '../firebase/statsGlobal'
import { aplicarSesionAStats } from '../firebase/statsEjercicios'
import { getRegistrosSesion } from '../firebase/registros'
import ResumenSesion from './ResumenSesion'

function renderResumen(sesionId = 'ses1') {
  return render(
    <MemoryRouter initialEntries={[`/sesion/${sesionId}/resumen`]}>
      <Routes>
        <Route path="/sesion/:sesionId/resumen" element={<ResumenSesion />} />
      </Routes>
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------

describe('ResumenSesion — completar sesión sin bloquear la UI (bug offline)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getRegistrosSesion.mockResolvedValue([
      { ejercicioId: 'e1', nombreEjercicio: 'Press Banca', grupoMuscular: 'Pecho', numeroSerie: 1, pesoUsado: 80, repsHechas: 8 },
    ])
  })

  it('destraba el spinner y renderiza la página aunque completarSesionConAgregados nunca resuelva (sin red)', async () => {
    completarSesionConAgregados.mockReturnValue(new Promise(() => {})) // simula ACK que nunca llega

    getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ diaId: 'dia1', nota: '', completada: false }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ nombre: 'Push' }) })

    renderResumen()

    expect(await screen.findByText('Press Banca')).toBeTruthy()
    expect(completarSesionConAgregados).toHaveBeenCalledWith('ses1', expect.objectContaining({ usuarioId: 'user1' }))
  })

  it('si completarSesionConAgregados rechaza, avisa por toast no bloqueante en vez de mostrar un error que tape la página', async () => {
    completarSesionConAgregados.mockRejectedValue(new Error('offline'))

    getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ diaId: 'dia1', nota: '', completada: false }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ nombre: 'Push' }) })

    renderResumen()

    await screen.findByText('Press Banca')
    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning' }))
    })
  })

  it('no llama a completarSesionConAgregados si la sesión ya está completada', async () => {
    backfillResumen.mockResolvedValue(undefined)

    getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          diaId: 'dia1', nota: '', completada: true,
          resumen: { ejercicios: [], volumenTotal: 0, diaNombre: 'Push' },
        }),
      })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ nombre: 'Push' }) })

    renderResumen()

    await waitFor(() => {
      expect(completarSesionConAgregados).not.toHaveBeenCalled()
    })
  })
})

describe('ResumenSesion — backfill de una sesión completada sin resumen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getRegistrosSesion.mockResolvedValue([
      { ejercicioId: 'e1', nombreEjercicio: 'Press Banca', grupoMuscular: 'Pecho', numeroSerie: 1, pesoUsado: 80, repsHechas: 8 },
    ])
    getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ diaId: 'dia1', nota: '', completada: true, fecha: new Date('2026-08-10') }),
      })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ nombre: 'Push' }) })
  })

  it('repara el resumen y también los agregados (stats/global y statsEjercicios)', async () => {
    backfillResumen.mockResolvedValue(undefined)
    aplicarSesionAResumenGlobal.mockResolvedValue(undefined)
    aplicarSesionAStats.mockResolvedValue(undefined)

    renderResumen()

    await screen.findByText('Press Banca')
    await waitFor(() => {
      expect(backfillResumen).toHaveBeenCalledWith('ses1', expect.objectContaining({ volumenTotal: 640 }))
      expect(aplicarSesionAResumenGlobal).toHaveBeenCalledWith('user1', expect.objectContaining({ sesionId: 'ses1' }))
      expect(aplicarSesionAStats).toHaveBeenCalledWith('user1', expect.objectContaining({ sesionId: 'ses1' }))
    })
  })

  it('si la reparación falla, avisa por toast sin bloquear la página', async () => {
    backfillResumen.mockResolvedValue(undefined)
    aplicarSesionAResumenGlobal.mockRejectedValue(new Error('offline'))
    aplicarSesionAStats.mockResolvedValue(undefined)

    renderResumen()

    await screen.findByText('Press Banca')
    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning' }))
    })
  })
})

describe('ResumenSesion — edición de serie (stepper)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        diaId: 'dia1', nota: '', completada: true, nombre: 'Push',
        resumen: { ejercicios: [], volumenTotal: 0, diaNombre: 'Push' },
      }),
    })
  })

  async function abrirModalEdicion(container) {
    await waitFor(() => expect(container.querySelector('.resumen-serie-row')).toBeTruthy())
    fireEvent.click(container.querySelector('.resumen-serie-row'))
    await waitFor(() => expect(screen.getByLabelText('Sumar 2,5 kg')).toBeTruthy())
  }

  it('un tap corto en "Sumar 2,5 kg" incrementa el peso editado en 2.5', async () => {
    getRegistrosSesion.mockResolvedValue([
      { id: 'r1', ejercicioId: 'e1', nombreEjercicio: 'Press Banca', grupoMuscular: 'Pecho', numeroSerie: 1, pesoUsado: 80, repsHechas: 8 },
    ])
    const { container } = renderResumen()
    await abrirModalEdicion(container)

    const btn = screen.getByLabelText('Sumar 2,5 kg')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    fireEvent.pointerUp(btn, { pointerId: 1 })
    fireEvent.click(btn)

    expect(screen.getByDisplayValue('82.5')).toBeTruthy()
  })

  it('mantener presionado "Restar 2,5 kg" no baja el peso editado de 0', async () => {
    getRegistrosSesion.mockResolvedValue([
      { id: 'r1', ejercicioId: 'e1', nombreEjercicio: 'Press Banca', grupoMuscular: 'Pecho', numeroSerie: 1, pesoUsado: 0, repsHechas: 8 },
    ])
    const { container } = renderResumen()
    await abrirModalEdicion(container)

    vi.useFakeTimers()
    const btn = screen.getByLabelText('Restar 2,5 kg')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    await act(async () => { vi.advanceTimersByTime(500 + 150 * 3) })
    fireEvent.pointerUp(btn, { pointerId: 1 })
    vi.useRealTimers()

    expect(screen.getByDisplayValue('0')).toBeTruthy()
  })

  it('mantener presionado "Restar una repetición" no baja las reps editadas de 1', async () => {
    getRegistrosSesion.mockResolvedValue([
      { id: 'r1', ejercicioId: 'e1', nombreEjercicio: 'Press Banca', grupoMuscular: 'Pecho', numeroSerie: 1, pesoUsado: 80, repsHechas: 1 },
    ])
    const { container } = renderResumen()
    await abrirModalEdicion(container)

    vi.useFakeTimers()
    const btn = screen.getByLabelText('Restar una repetición')
    fireEvent.pointerDown(btn, { pointerId: 1, button: 0 })
    await act(async () => { vi.advanceTimersByTime(500 + 150 * 3) })
    fireEvent.pointerUp(btn, { pointerId: 1 })
    vi.useRealTimers()

    expect(screen.getByDisplayValue('1')).toBeTruthy()
  })
})
