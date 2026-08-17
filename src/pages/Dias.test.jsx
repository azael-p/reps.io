vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, AnimatePresence: ({ children }) => children }
})

vi.mock('../hooks/useDesktop', () => ({ useDesktop: () => false }))

vi.mock('../firebase/config', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_, col, id) => ({ _col: col, _id: id })),
  getDoc: vi.fn(),
}))

const mockShow = vi.fn()
vi.mock('../components/Toast', () => ({
  useToast: () => ({ show: mockShow }),
}))

// Expone onReorder como un botón: simular el drag real de @dnd-kit en jsdom
// no aporta nada acá, lo que se testea es el manejo del fallo de escritura.
vi.mock('../components/DnDList', () => ({
  default: ({ items, onReorder, renderItem }) => (
    <div>
      <button onClick={() => onReorder([...items].reverse().map((it, i) => ({ ...it, orden: i })))}>
        reordenar
      </button>
      {items.map((item, i) => {
        const render = renderItem(item, i)
        return <div key={item.id}>{render({ dragHandleProps: {} })}</div>
      })}
    </div>
  ),
}))

vi.mock('../firebase/dias', () => ({
  getDias: vi.fn(),
  crearDia: vi.fn(),
  editarDia: vi.fn(),
  marcarDiaParaEliminar: vi.fn(),
  desmarcarDiaParaEliminar: vi.fn(),
  eliminarDiaDefinitivo: vi.fn(),
  reordenarDias: vi.fn(),
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getDoc } from 'firebase/firestore'
import Dias from './Dias'
import {
  getDias, crearDia, editarDia, reordenarDias,
  marcarDiaParaEliminar, desmarcarDiaParaEliminar, eliminarDiaDefinitivo,
} from '../firebase/dias'

function renderPage(programaId = 'prog1') {
  return render(
    <MemoryRouter initialEntries={[`/programas/${programaId}`]}>
      <Routes>
        <Route path="/programas" element={<div data-testid="programas-page" />} />
        <Route path="/programas/:programaId" element={<Dias />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getDoc.mockResolvedValue({ exists: () => true, id: 'prog1', data: () => ({ nombre: 'Push Day' }) })
})

// ---------------------------------------------------------------------------

describe('Dias — crear', () => {
  beforeEach(() => {
    getDias.mockResolvedValue([])
  })

  it('valida que el nombre no esté vacío al confirmar con Enter', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /agregar día/i }))
    await user.type(screen.getByPlaceholderText(/día 1 - piernas/i), '{Enter}')
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument()
    expect(crearDia).not.toHaveBeenCalled()
  })

  it('crea el día con el nombre ingresado y el orden correcto', async () => {
    crearDia.mockResolvedValue('nuevo-dia-id')
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /agregar día/i }))
    await user.type(screen.getByPlaceholderText(/día 1 - piernas/i), 'Día de pierna')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(crearDia).toHaveBeenCalledWith('prog1', 'Día de pierna', 0)
    })
  })
})

// ---------------------------------------------------------------------------

describe('Dias — programa inexistente', () => {
  it('redirige a /programas si el programa no existe', async () => {
    getDoc.mockResolvedValue({ exists: () => false })
    getDias.mockResolvedValue([])
    renderPage('inexistente')
    await waitFor(() => {
      expect(screen.getByTestId('programas-page')).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------

describe('Dias — eliminar con deshacer', () => {
  beforeEach(() => {
    getDias.mockResolvedValue([{ id: 'd1', nombre: 'Día 1 - Pecho', orden: 0 }])
  })

  it('al eliminar: marca para eliminar y lo saca de la lista inmediatamente', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Día 1 - Pecho')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    expect(marcarDiaParaEliminar).toHaveBeenCalledWith('d1')
    expect(screen.queryByText('Día 1 - Pecho')).not.toBeInTheDocument()
  })

  it('muestra el toast con acción "Deshacer" y onTimeout definido', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Día 1 - Pecho')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      message: '"Día 1 - Pecho" eliminado',
      duration: 5000,
      action: expect.objectContaining({ label: 'Deshacer', onClick: expect.any(Function) }),
      onTimeout: expect.any(Function),
    }))
  })

  it('"Deshacer" desmarca el día y recarga la lista', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Día 1 - Pecho')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    const { action } = mockShow.mock.calls[0][0]
    await action.onClick()

    expect(desmarcarDiaParaEliminar).toHaveBeenCalledWith('d1')
    await waitFor(() => expect(getDias).toHaveBeenCalledTimes(2))
  })

  it('si expira el timeout sin deshacer, borra el día definitivamente', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Día 1 - Pecho')
    await user.click(screen.getByRole('button', { name: /eliminar/i }))

    const { onTimeout } = mockShow.mock.calls[0][0]
    onTimeout()

    expect(eliminarDiaDefinitivo).toHaveBeenCalledWith('d1')
    expect(desmarcarDiaParaEliminar).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('Dias — editar', () => {
  beforeEach(() => {
    getDias.mockResolvedValue([{ id: 'd1', nombre: 'Día 1 - Pecho', orden: 0 }])
  })

  it('precarga el nombre actual y llama a editarDia al guardar', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Día 1 - Pecho')
    await user.click(screen.getByRole('button', { name: /renombrar/i }))

    const input = screen.getByPlaceholderText(/día 1 - piernas/i)
    expect(input).toHaveValue('Día 1 - Pecho')

    await user.clear(input)
    await user.type(input, 'Día 1 - Espalda')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(editarDia).toHaveBeenCalledWith('d1', 'Día 1 - Espalda')
    })
  })
})

describe('Dias — fallo al reordenar', () => {
  beforeEach(() => {
    getDias.mockResolvedValue([
      { id: 'd1', nombre: 'Push', orden: 0 },
      { id: 'd2', nombre: 'Pull', orden: 1 },
    ])
  })

  it('revierte el orden local y muestra un toast de error', async () => {
    const user = userEvent.setup()
    reordenarDias.mockRejectedValue(new Error('sin red'))
    renderPage()
    await screen.findByText('Push')

    await user.click(screen.getByRole('button', { name: 'reordenar' }))

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
        message: 'No se pudo guardar el orden. Intentá de nuevo.',
        variant: 'error',
      }))
    })
    const nombres = screen.getAllByText(/^(Push|Pull)$/).map(n => n.textContent)
    expect(nombres[0]).toBe('Push')
  })
})
