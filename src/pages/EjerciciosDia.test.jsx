vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

vi.mock('../firebase/config', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_, col, id) => ({ _col: col, _id: id })),
  getDoc: vi.fn(),
}))

const mockShow = vi.fn()
vi.mock('../components/Toast', () => ({
  useToast: () => ({ show: mockShow }),
}))

vi.mock('../components/SeleccionarEjercicio', () => ({
  default: () => null,
}))

vi.mock('../firebase/ejerciciosDia', () => ({
  getEjerciciosDia: vi.fn(),
  agregarEjercicioDia: vi.fn(),
  editarEjercicioDia: vi.fn(),
  marcarEjercicioParaEliminar: vi.fn(),
  desmarcarEjercicioParaEliminar: vi.fn(),
  eliminarEjercicioDefinitivo: vi.fn(),
  reordenarEjercicios: vi.fn(),
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getDoc } from 'firebase/firestore'
import EjerciciosDia from './EjerciciosDia'
import {
  getEjerciciosDia, editarEjercicioDia,
  marcarEjercicioParaEliminar, desmarcarEjercicioParaEliminar, eliminarEjercicioDefinitivo,
} from '../firebase/ejerciciosDia'

function renderPage(programaId = 'prog1', diaId = 'dia1') {
  return render(
    <MemoryRouter initialEntries={[`/programas/${programaId}/${diaId}`]}>
      <Routes>
        <Route path="/programas/:programaId/:diaId" element={<EjerciciosDia />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getDoc.mockImplementation((ref) => {
    if (ref._col === 'dias') return Promise.resolve({ exists: () => true, id: ref._id, data: () => ({ nombre: 'Push Day' }) })
    if (ref._col === 'programas') return Promise.resolve({ exists: () => true, id: ref._id, data: () => ({ nombre: 'PPL' }) })
    return Promise.resolve({ exists: () => false, data: () => undefined })
  })
})

// ---------------------------------------------------------------------------

describe('EjerciciosDia — editar', () => {
  beforeEach(() => {
    getEjerciciosDia.mockResolvedValue([
      { id: 'e1', nombre: 'Press Banca', grupoMuscular: 'Pecho', seriesEsperadas: 3, repsEsperadas: 8, orden: 0 },
    ])
  })

  it('precarga series y reps actuales al abrir edición', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Press Banca')
    await user.click(screen.getByRole('button', { name: /editar/i }))

    const [seriesInput, repsInput] = screen.getAllByRole('spinbutton')
    expect(seriesInput).toHaveValue(3)
    expect(repsInput).toHaveValue(8)
  })

  it('valida que series y reps sean mayores a 0', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Press Banca')
    await user.click(screen.getByRole('button', { name: /editar/i }))

    const [seriesInput] = screen.getAllByRole('spinbutton')
    await user.clear(seriesInput)
    await user.type(seriesInput, '0')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByText('Series y reps deben ser mayores a 0')).toBeInTheDocument()
    expect(editarEjercicioDia).not.toHaveBeenCalled()
  })

  it('guarda los nuevos valores de series y reps', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Press Banca')
    await user.click(screen.getByRole('button', { name: /editar/i }))

    const [seriesInput, repsInput] = screen.getAllByRole('spinbutton')
    await user.clear(seriesInput)
    await user.type(seriesInput, '4')
    await user.clear(repsInput)
    await user.type(repsInput, '10')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(editarEjercicioDia).toHaveBeenCalledWith('e1', {
        nombre: 'Press Banca', seriesEsperadas: 4, repsEsperadas: 10,
      })
    })
  })
})

// ---------------------------------------------------------------------------

describe('EjerciciosDia — eliminar con deshacer', () => {
  beforeEach(() => {
    getEjerciciosDia.mockResolvedValue([
      { id: 'e1', nombre: 'Press Banca', grupoMuscular: 'Pecho', seriesEsperadas: 3, repsEsperadas: 8, orden: 0 },
    ])
  })

  it('al eliminar: marca para eliminar y lo saca de la lista inmediatamente', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Press Banca')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    expect(marcarEjercicioParaEliminar).toHaveBeenCalledWith('e1')
    expect(screen.queryByText('Press Banca')).not.toBeInTheDocument()
  })

  it('muestra el toast con acción "Deshacer" y onTimeout definido', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Press Banca')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      message: '"Press Banca" eliminado',
      duration: 5000,
      action: expect.objectContaining({ label: 'Deshacer', onClick: expect.any(Function) }),
      onTimeout: expect.any(Function),
    }))
  })

  it('"Deshacer" desmarca el ejercicio y recarga la lista', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Press Banca')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    const { action } = mockShow.mock.calls[0][0]
    await action.onClick()

    expect(desmarcarEjercicioParaEliminar).toHaveBeenCalledWith('e1')
    await waitFor(() => expect(getEjerciciosDia).toHaveBeenCalledTimes(2))
  })

  it('si expira el timeout sin deshacer, borra el ejercicio definitivamente', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Press Banca')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    const { onTimeout } = mockShow.mock.calls[0][0]
    onTimeout()

    expect(eliminarEjercicioDefinitivo).toHaveBeenCalledWith('e1')
    expect(desmarcarEjercicioParaEliminar).not.toHaveBeenCalled()
  })
})
