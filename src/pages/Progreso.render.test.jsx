// Test de render/wiring de la página completa tras el refactor a sub-
// componentes (src/pages/progreso/*): cubre lo que Progreso.test.jsx (solo
// funciones puras) no cubría — que la composición y el data flow entre
// Progreso.jsx y sus sub-componentes siga funcionando.
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})
vi.mock('../hooks/useDesktop', () => ({ useDesktop: () => false }))

const USUARIO = vi.hoisted(() => ({ id: 'user1', nombre: 'Test' }))
vi.mock('../context/UserContext', () => ({ useUser: () => ({ usuario: USUARIO }) }))

const showMock = vi.hoisted(() => vi.fn())
vi.mock('../components/Toast', () => ({ useToast: () => ({ show: showMock }) }))

vi.mock('../firebase/sesiones', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getSesionesPaginadas: vi.fn(),
    enrichSesionesConPrograma: vi.fn(async (_uid, pagina) => pagina.map(s => ({ ...s, diaNombre: s.resumen?.diaNombre ?? 'Push', programaNombre: 'PPL' }))),
    eliminarSesion: vi.fn().mockResolvedValue(),
  }
})
vi.mock('../firebase/statsGlobal', () => ({
  getResumenGlobalConFallback: vi.fn().mockResolvedValue({ diasEntrenados: [], volumenPorSesion: [] }),
  removerSesionDeResumenGlobal: vi.fn().mockResolvedValue(),
}))
vi.mock('../firebase/statsEjercicios', () => ({
  getStatsEjerciciosConFallback: vi.fn().mockResolvedValue([]),
  rebuildStatsEjercicios: vi.fn().mockResolvedValue(),
}))
vi.mock('../firebase/peso', () => ({
  getHistorialPeso: vi.fn().mockResolvedValue([]),
  agregarPeso: vi.fn(),
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { getSesionesPaginadas, eliminarSesion } from '../firebase/sesiones'
import { removerSesionDeResumenGlobal } from '../firebase/statsGlobal'
import { rebuildStatsEjercicios } from '../firebase/statsEjercicios'
import Progreso from './Progreso'

const ts = (y, m, d) => {
  const date = new Date(y, m - 1, d)
  return { toDate: () => date, toMillis: () => date.getTime() }
}

const SESION = {
  id: 'ses1', usuarioId: 'user1', diaId: 'dia1', completada: true,
  fecha: ts(2026, 6, 10), resumen: { volumenTotal: 500, diaNombre: 'Push', ejercicios: [] },
}

function renderPage() {
  return render(<MemoryRouter><Progreso /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  getSesionesPaginadas.mockResolvedValue({ sesiones: [], ultimoDoc: null, hayMas: false })
})

// ---------------------------------------------------------------------------

describe('Progreso — historial', () => {
  it('muestra el estado vacío cuando no hay sesiones', async () => {
    renderPage()
    expect(await screen.findByText(/Cero sesiones/)).toBeInTheDocument()
  })

  it('lista las sesiones cargadas', async () => {
    getSesionesPaginadas.mockResolvedValue({ sesiones: [SESION], ultimoDoc: {}, hayMas: false })
    renderPage()
    expect(await screen.findByText('Push')).toBeInTheDocument()
  })

  it('"Ver más" pide la siguiente página y la agrega a la lista', async () => {
    getSesionesPaginadas.mockResolvedValueOnce({ sesiones: [SESION], ultimoDoc: { id: 'cursor' }, hayMas: true })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Push')

    const sesion2 = { ...SESION, id: 'ses2', resumen: { ...SESION.resumen, diaNombre: 'Pull' } }
    getSesionesPaginadas.mockResolvedValueOnce({ sesiones: [sesion2], ultimoDoc: null, hayMas: false })
    await user.click(screen.getByText('Ver más'))

    await waitFor(() => expect(getSesionesPaginadas).toHaveBeenCalledWith('user1', { after: { id: 'cursor' }, pageSize: 20 }))
    expect(await screen.findByText('Pull')).toBeInTheDocument()
    expect(screen.getByText('Push')).toBeInTheDocument()
  })

  it('eliminar una sesión pide confirmación y solo borra al confirmar', async () => {
    getSesionesPaginadas.mockResolvedValue({ sesiones: [SESION], ultimoDoc: null, hayMas: false })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Push')

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText('¿Eliminar esta sesión?')).toBeInTheDocument()
    expect(eliminarSesion).not.toHaveBeenCalled()

    const botonesEliminar = screen.getAllByRole('button', { name: 'Eliminar' })
    await user.click(botonesEliminar[botonesEliminar.length - 1])
    await waitFor(() => expect(eliminarSesion).toHaveBeenCalledWith('ses1'))
    expect(removerSesionDeResumenGlobal).toHaveBeenCalledWith('user1', { sesionId: 'ses1', fecha: SESION.fecha })
    expect(rebuildStatsEjercicios).toHaveBeenCalledWith('user1', [])
  })

  it('si falla el borrado, muestra un toast de error', async () => {
    getSesionesPaginadas.mockResolvedValue({ sesiones: [SESION], ultimoDoc: null, hayMas: false })
    eliminarSesion.mockRejectedValue(new Error('offline'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Push')
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await screen.findByText('¿Eliminar esta sesión?')
    const botonesEliminar = screen.getAllByRole('button', { name: 'Eliminar' })
    await user.click(botonesEliminar[botonesEliminar.length - 1])
    await waitFor(() => {
      expect(showMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
    })
    consoleError.mockRestore()
  })
})

// ---------------------------------------------------------------------------

describe('Progreso — tabs', () => {
  it('cambiar a la tab Rachas muestra su contenido', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/Cero sesiones/)
    await user.click(screen.getByRole('button', { name: 'Rachas' }))
    expect(await screen.findByText('Entrená para empezar a generar rachas.')).toBeInTheDocument()
  })
})
