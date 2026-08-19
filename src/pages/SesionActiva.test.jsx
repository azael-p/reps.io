import { render, screen, waitFor, within } from '@testing-library/react'
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
  EmptyState: ({ mensaje }) => <div>{mensaje}</div>,
  Badge: ({ children }) => <span>{children}</span>,
  Modal: ({ children, open }) => (open ? <div data-testid="modal">{children}</div> : null),
}))
// Estables entre renders: `cargar` depende de `show`, así que un vi.fn() nuevo
// por render re-dispara su efecto y resetea la posición y los inputs. En la app
// real `show` es estable (useCallback en ToastProvider).
const mockShow = vi.fn()
const mockDismiss = vi.fn()
vi.mock('../components/Toast', () => ({
  useToast: () => ({ show: mockShow, dismiss: mockDismiss }),
  ToastProvider: ({ children }) => children,
}))
vi.mock('../hooks/useKeyboardShortcut', () => ({
  useKeyboardShortcut: vi.fn(),
}))
const mockUseSyncStatus = vi.hoisted(() => vi.fn(() => ({ estado: 'online', pendientes: 0 })))
vi.mock('../hooks/useSyncStatus', () => ({ useSyncStatus: mockUseSyncStatus }))

import { getDoc } from 'firebase/firestore'
import { getEjerciciosDia } from '../firebase/ejerciciosDia'
import { getRegistrosSesion, agregarRegistro, editarRegistro } from '../firebase/registros'
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

// ---------------------------------------------------------------------------

describe('SesionActiva — el peso se arrastra a la serie siguiente', () => {
  const EJ2 = { id: 'ej2', catalogoId: 'remo-barra', nombre: 'Remo con barra', grupoMuscular: 'Espalda', seriesEsperadas: 2, repsEsperadas: 10, orden: 2 }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: false }) })
    getRegistrosSesion.mockResolvedValue([])
    getStatsEjerciciosConFallback.mockResolvedValue([])
    agregarRegistro.mockReturnValue({ id: 'reg1', listo: Promise.resolve() })
  })

  const inputPeso = () => screen.getByLabelText('Peso (kg)')

  // El bug: ultimoPesoRef se sincronizaba en un efecto (post-commit) pero
  // avanzar() lo lee sincrónicamente en el mismo handler, así que la serie 2
  // arrancaba vacía y un tap sin reescribir el peso guardaba 0 kg.
  it('la serie 2 arranca con el peso de la serie 1, no vacía', async () => {
    const user = userEvent.setup()
    getEjerciciosDia.mockResolvedValue([EJ1])
    renderSesion()
    await waitFor(() => expect(getEjerciciosDia).toHaveBeenCalled())

    await user.clear(inputPeso())
    await user.type(inputPeso(), '60')
    await user.click(screen.getByRole('button', { name: /Completar serie 1/ }))

    await screen.findByRole('button', { name: /Completar serie 2/ })
    // String y no número: el campo es type="text" + inputMode="decimal" para
    // no perder la coma decimal (type="number" descartaba "82," y guardaba 0).
    expect(inputPeso()).toHaveValue('60')
  })

  it('guarda el peso escrito en la serie 2, no 0, si se completa sin reescribirlo', async () => {
    const user = userEvent.setup()
    getEjerciciosDia.mockResolvedValue([EJ1])
    renderSesion()
    await waitFor(() => expect(getEjerciciosDia).toHaveBeenCalled())

    await user.clear(inputPeso())
    await user.type(inputPeso(), '60')
    await user.click(screen.getByRole('button', { name: /Completar serie 1/ }))
    await screen.findByRole('button', { name: /Completar serie 2/ })
    // Sin tocar el input: es exactamente el gesto que generaba los ceros.
    await user.click(screen.getByRole('button', { name: /Completar serie 2/ }))

    await waitFor(() => expect(agregarRegistro).toHaveBeenCalledTimes(2))
    expect(agregarRegistro.mock.calls[1][0]).toMatchObject({ numeroSerie: 2, pesoUsado: 60 })
  })

  it('al pasar al ejercicio siguiente no arrastra el peso del anterior', async () => {
    const user = userEvent.setup()
    getEjerciciosDia.mockResolvedValue([{ ...EJ1, seriesEsperadas: 1 }, EJ2])
    renderSesion()
    await waitFor(() => expect(getEjerciciosDia).toHaveBeenCalled())

    await user.clear(inputPeso())
    await user.type(inputPeso(), '60')
    await user.click(screen.getByRole('button', { name: /Siguiente ejercicio/ }))

    await screen.findByRole('button', { name: /Completar serie 1/ })
    expect(inputPeso()).toHaveValue('')
  })
})

// ---------------------------------------------------------------------------

describe('SesionActiva — feedback háptico al completar serie (#23)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: false }) })
    getRegistrosSesion.mockResolvedValue([])
    getStatsEjerciciosConFallback.mockResolvedValue([])
    agregarRegistro.mockReturnValue({ id: 'reg1', listo: Promise.resolve() })
  })

  it('llama a navigator.vibrate al completar una serie', async () => {
    const vibrate = vi.fn()
    navigator.vibrate = vibrate
    const user = userEvent.setup()
    getEjerciciosDia.mockResolvedValue([EJ1])
    renderSesion()
    await waitFor(() => expect(getEjerciciosDia).toHaveBeenCalled())

    await user.clear(screen.getByLabelText('Peso (kg)'))
    await user.type(screen.getByLabelText('Peso (kg)'), '60')
    await user.click(screen.getByRole('button', { name: /Completar serie 1/ }))

    await waitFor(() => expect(vibrate).toHaveBeenCalledWith(15))
    delete navigator.vibrate
  })
})

// ---------------------------------------------------------------------------

describe('SesionActiva — punto de sincronización en el header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: false }) })
    getEjerciciosDia.mockResolvedValue([EJ1])
    getRegistrosSesion.mockResolvedValue([])
  })

  it('en línea: punto verde sin aviso de pendientes', async () => {
    mockUseSyncStatus.mockReturnValue({ estado: 'online', pendientes: 0 })
    renderSesion()
    const dot = await screen.findByRole('img', { name: 'En línea' })
    expect(dot).toHaveClass('sa-sync-dot--online')
  })

  it('sin conexión: punto rojo', async () => {
    mockUseSyncStatus.mockReturnValue({ estado: 'offline', pendientes: 0 })
    renderSesion()
    const dot = await screen.findByRole('img', { name: 'Sin conexión' })
    expect(dot).toHaveClass('sa-sync-dot--offline')
  })

  it('con pendientes: punto naranja con la cantidad en el label', async () => {
    mockUseSyncStatus.mockReturnValue({ estado: 'pendiente', pendientes: 2 })
    renderSesion()
    const dot = await screen.findByRole('img', { name: '2 series sin sincronizar' })
    expect(dot).toHaveClass('sa-sync-dot--pendiente')
  })
})

// ---------------------------------------------------------------------------

describe('SesionActiva — corrección no lineal (editar una serie ya completada)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: false }) })
    getEjerciciosDia.mockResolvedValue([EJ1])
    // 2 de 3 series completadas → restaura en la serie 3, con series 1 y 2 tocables.
    getRegistrosSesion.mockResolvedValue([
      { id: 'r1', ejercicioId: 'ej1', numeroSerie: 1, pesoUsado: 80, repsHechas: 8, nota: '' },
      { id: 'r2', ejercicioId: 'ej1', numeroSerie: 2, pesoUsado: 82.5, repsHechas: 7, nota: '' },
    ])
    editarRegistro.mockResolvedValue(undefined)
  })

  it('tocar el dot de la serie 1 abre el modal precargado con sus valores', async () => {
    const user = userEvent.setup()
    renderSesion()
    await screen.findByText(/serie.*3/i)

    await user.click(screen.getByRole('button', { name: 'Editar serie 1' }))

    const modal = within(screen.getByTestId('modal'))
    expect(modal.getByText('Serie 1')).toBeInTheDocument()
    expect(modal.getByDisplayValue('80')).toBeInTheDocument()
    expect(modal.getByDisplayValue('8')).toBeInTheDocument()
  })

  it('guardar la edición llama a editarRegistro con el id correcto y no altera la serie en curso', async () => {
    const user = userEvent.setup()
    renderSesion()
    await screen.findByText(/serie.*3/i)

    await user.click(screen.getByRole('button', { name: 'Editar serie 2' }))
    const modal = within(screen.getByTestId('modal'))
    const pesoInput = modal.getByDisplayValue('82.5')
    await user.clear(pesoInput)
    await user.type(pesoInput, '85')
    await user.click(modal.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(editarRegistro).toHaveBeenCalledWith('r2', { pesoUsado: 85, repsHechas: 7 })
    })
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    // Sigue en la serie 3 (la que estaba en curso antes de editar) — el modal
    // no toca ejIdx/serieIdx.
    expect(screen.getByText(/serie.*3/i)).toBeInTheDocument()
  })

  it('corregir la última serie hecha arrastra el peso sugerido para la siguiente', async () => {
    const user = userEvent.setup()
    renderSesion()
    await screen.findByText(/serie.*3/i)

    await user.click(screen.getByRole('button', { name: 'Editar serie 2' }))
    const modal = within(screen.getByTestId('modal'))
    const pesoModal = modal.getByDisplayValue('82.5')
    await user.clear(pesoModal)
    await user.type(pesoModal, '85')
    await user.click(modal.getByRole('button', { name: 'Guardar' }))

    // El hint de "última vez" sale del peso sugerido, y solo se muestra con el
    // campo vacío: vaciarlo es la forma de leer ese valor desde afuera.
    await user.clear(screen.getByLabelText('Peso (kg)'))

    expect(await screen.findByText('↳ Última vez: 85kg')).toBeInTheDocument()
  })

  it('corregir una serie anterior NO cambia el peso sugerido', async () => {
    const user = userEvent.setup()
    renderSesion()
    await screen.findByText(/serie.*3/i)

    await user.click(screen.getByRole('button', { name: 'Editar serie 1' }))
    const modal = within(screen.getByTestId('modal'))
    const pesoModal = modal.getByDisplayValue('80')
    await user.clear(pesoModal)
    await user.type(pesoModal, '60')
    await user.click(modal.getByRole('button', { name: 'Guardar' }))

    await user.clear(screen.getByLabelText('Peso (kg)'))

    expect(await screen.findByText('↳ Última vez: 82.5kg')).toBeInTheDocument()
  })

  it('cancelar cierra el modal sin llamar a editarRegistro', async () => {
    const user = userEvent.setup()
    renderSesion()
    await screen.findByText(/serie.*3/i)

    await user.click(screen.getByRole('button', { name: 'Editar serie 1' }))
    await user.click(within(screen.getByTestId('modal')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    expect(editarRegistro).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('SesionActiva — día sin ejercicios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ diaId: 'dia1', completada: false }) })
    getEjerciciosDia.mockResolvedValue([])
    getRegistrosSesion.mockResolvedValue([])
  })

  it('muestra el EmptyState y NO manda al resumen (que completaría una sesión vacía)', async () => {
    renderSesion()

    expect(await screen.findByText('Este día no tiene ejercicios')).toBeInTheDocument()
    expect(screen.queryByTestId('resumen')).not.toBeInTheDocument()
  })
})
