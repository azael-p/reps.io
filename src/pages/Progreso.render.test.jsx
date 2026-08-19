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

vi.mock('../firebase/config', () => ({ db: {}, auth: {} }))
vi.mock('../firebase/sesiones', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getSesionesPaginadas: vi.fn(),
    enrichSesionesConPrograma: vi.fn(async (_uid, pagina) => pagina.map(s => ({ ...s, diaNombre: s.resumen?.diaNombre ?? 'Push', programaNombre: 'PPL' }))),
  }
})
vi.mock('../firebase/statsGlobal', () => ({
  getResumenGlobalConFallback: vi.fn().mockResolvedValue({ diasEntrenados: [], volumenPorSesion: [] }),
}))
vi.mock('../firebase/statsEjercicios', () => ({
  getStatsEjerciciosConFallback: vi.fn().mockResolvedValue([]),
}))
vi.mock('../firebase/eliminarSesion', () => ({
  eliminarSesionConAgregados: vi.fn().mockResolvedValue(),
}))
vi.mock('../firebase/peso', () => ({
  getHistorialPeso: vi.fn().mockResolvedValue([]),
  agregarPeso: vi.fn().mockResolvedValue(undefined),
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { getSesionesPaginadas } from '../firebase/sesiones'
import { eliminarSesionConAgregados } from '../firebase/eliminarSesion'
import { lunesDeSemana } from '../utils/stats'
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
    expect(eliminarSesionConAgregados).not.toHaveBeenCalled()

    const botonesEliminar = screen.getAllByRole('button', { name: 'Eliminar' })
    await user.click(botonesEliminar[botonesEliminar.length - 1])
    await waitFor(() => expect(eliminarSesionConAgregados).toHaveBeenCalledWith('ses1', {
      usuarioId: 'user1', fecha: SESION.fecha, ejercicios: [],
    }))
  })

  it('si falla el borrado, muestra un toast de error', async () => {
    getSesionesPaginadas.mockResolvedValue({ sesiones: [SESION], ultimoDoc: null, hayMas: false })
    eliminarSesionConAgregados.mockRejectedValue(new Error('offline'))
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
    await user.click(screen.getByRole('tab', { name: 'Rachas' }))
    expect(await screen.findByText('Entrená para empezar a generar rachas.')).toBeInTheDocument()
  })
})

describe('Progreso — fallo al cargar el peso corporal', () => {
  it('avisa por toast en vez de mostrar el empty state como si no hubiera registros', async () => {
    const { getHistorialPeso } = await import('../firebase/peso')
    getHistorialPeso.mockRejectedValue(new Error('sin red'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('tab', { name: 'Peso' }))

    await waitFor(() => {
      expect(showMock).toHaveBeenCalledWith(expect.objectContaining({
        message: 'No se pudieron cargar los registros de peso.',
        variant: 'error',
      }))
    })
  })
})

describe('Progreso — registrar peso con coma decimal', () => {
  it('guarda 78,5 como 78.5 en vez de rechazarlo', async () => {
    const { agregarPeso } = await import('../firebase/peso')
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('tab', { name: 'Peso' }))
    await user.click(await screen.findByRole('button', { name: /registrar peso/i }))
    await user.type(screen.getByPlaceholderText('Ej: 78'), '78,5')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(agregarPeso).toHaveBeenCalledWith('user1', 78.5))
  })
})

describe('Progreso — resumen de un vistazo (mobile)', () => {
  it('muestra la racha actual sin entrar a ningún tab', async () => {
    const { getResumenGlobalConFallback } = await import('../firebase/statsGlobal')
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
    getResumenGlobalConFallback.mockResolvedValue({
      diasEntrenados: [hoy.getTime(), ayer.getTime()],
      volumenPorSesion: [],
    })
    renderPage()

    const resumen = await screen.findByTestId('progreso-resumen-mini')
    expect(resumen).toHaveTextContent('Racha actual')
    expect(resumen).toHaveTextContent('2')
    expect(resumen).toHaveTextContent('días seguidos')
  })

  it('muestra el volumen de esta semana con la variación vs. la semana pasada', async () => {
    const { getResumenGlobalConFallback } = await import('../firebase/statsGlobal')
    const lunesActual = lunesDeSemana(new Date()).getTime()
    const lunesAnterior = lunesActual - 7 * 86400000
    getResumenGlobalConFallback.mockResolvedValue({
      diasEntrenados: [],
      volumenPorSesion: [
        { sesionId: 's1', fecha: lunesActual + 86400000, volumen: 800, diaNombre: 'Push' },
        { sesionId: 's2', fecha: lunesAnterior + 86400000, volumen: 1000, diaNombre: 'Push' },
      ],
    })
    renderPage()

    const resumen = await screen.findByTestId('progreso-resumen-mini')
    expect(resumen).toHaveTextContent('Volumen semana')
    expect(resumen).toHaveTextContent('800 kg')
    expect(resumen).toHaveTextContent('-20%')
    expect(resumen).toHaveTextContent('vs 1.000 kg sem. pasada')
  })

  it('muestra las sesiones entrenadas en el mes calendario actual', async () => {
    const { getResumenGlobalConFallback } = await import('../firebase/statsGlobal')
    const hoy = new Date()
    const esteMes = new Date(hoy.getFullYear(), hoy.getMonth(), 3).getTime()
    const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 3).getTime()
    getResumenGlobalConFallback.mockResolvedValue({
      diasEntrenados: [esteMes, mesPasado],
      volumenPorSesion: [],
    })
    renderPage()

    const resumen = await screen.findByTestId('progreso-resumen-mini')
    expect(resumen).toHaveTextContent('Sesiones')
    expect(resumen).toHaveTextContent('este mes')
  })

  it('muestra el PR más reciente entre todos los ejercicios', async () => {
    const { getStatsEjerciciosConFallback } = await import('../firebase/statsEjercicios')
    getStatsEjerciciosConFallback.mockResolvedValue([
      { id: 'e1', nombre: 'Press Banca', grupoMuscular: 'Pecho', puntos: [], pr: { maxPeso: 80, fecha: 1000, sesionId: 's1', series: [] } },
      { id: 'e2', nombre: 'Sentadilla', grupoMuscular: 'Piernas', puntos: [], pr: { maxPeso: 102.5, fecha: 2000, sesionId: 's2', series: [] } },
    ])
    renderPage()

    const resumen = await screen.findByTestId('progreso-resumen-mini')
    expect(resumen).toHaveTextContent('PR reciente')
    expect(resumen).toHaveTextContent('Sentadilla')
    expect(resumen).toHaveTextContent('102.5 kg')
  })

  it('sin ningún PR todavía, muestra un mensaje en vez de un valor vacío', async () => {
    const { getStatsEjerciciosConFallback } = await import('../firebase/statsEjercicios')
    getStatsEjerciciosConFallback.mockResolvedValue([])
    renderPage()
    const resumen = await screen.findByTestId('progreso-resumen-mini')
    expect(resumen).toHaveTextContent('Todavía sin marcas')
  })

  it('sin datos, igual renderiza las 4 tarjetas en cero', async () => {
    renderPage()
    const resumen = await screen.findByTestId('progreso-resumen-mini')
    expect(resumen).toBeInTheDocument()
    expect(resumen).toHaveTextContent('Racha actual')
    expect(resumen).toHaveTextContent('Volumen semana')
    expect(resumen).toHaveTextContent('Sesiones')
    expect(resumen).toHaveTextContent('PR reciente')
  })
})

describe('Progreso — accesibilidad del historial', () => {
  it('la tarjeta de sesión es un botón real (accesible por teclado), no un div con onClick', async () => {
    getSesionesPaginadas.mockResolvedValue({ sesiones: [SESION], ultimoDoc: {}, hayMas: false })
    renderPage()

    const nombre = await screen.findByText('Push')
    expect(nombre.closest('button')).not.toBeNull()
  })
})
