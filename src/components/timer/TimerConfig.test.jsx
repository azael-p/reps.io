vi.mock('../../firebase/timerPresets', () => ({
  getPresets: vi.fn().mockResolvedValue([]),
  savePreset: vi.fn().mockResolvedValue({ id: 'new' }),
  deletePreset: vi.fn().mockResolvedValue(),
}))

vi.mock('../../context/UserContext', () => ({
  useUser: () => ({ usuario: { id: 'uid1' } }),
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import TimerConfig from './TimerConfig'
import { getPresets, savePreset, deletePreset } from '../../firebase/timerPresets'

const onIniciar = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  getPresets.mockResolvedValue([])
})

describe('TimerConfig', () => {
  it('renderiza el formulario de configuración', async () => {
    render(<TimerConfig onIniciar={onIniciar} />)
    await waitFor(() => {
      expect(screen.getByText('Timer HIIT')).toBeDefined()
      expect(screen.getByText(/Calentamiento/i)).toBeDefined()
      expect(screen.getByText(/Trabajo/i)).toBeDefined()
      expect(screen.getByText(/Descanso/i)).toBeDefined()
    })
  })

  it('el botón Iniciar llama a onIniciar() con la config correcta', async () => {
    render(<TimerConfig onIniciar={onIniciar} />)
    await waitFor(() => screen.getByText('Iniciar'))
    fireEvent.click(screen.getByText('Iniciar'))
    expect(onIniciar).toHaveBeenCalledTimes(1)
    const config = onIniciar.mock.calls[0][0]
    expect(config).toHaveProperty('calentamiento')
    expect(config).toHaveProperty('trabajo')
    expect(config).toHaveProperty('descanso')
    expect(config).toHaveProperty('sets')
    expect(config).toHaveProperty('enfriamiento')
  })

  it('muestra la lista de presets cargados', async () => {
    getPresets.mockResolvedValue([
      { id: 'p1', nombre: 'Cardio HIIT', sets: 8, trabajo: 40, descanso: 20, calentamiento: 300, enfriamiento: 300, creadoEn: null },
    ])
    render(<TimerConfig onIniciar={onIniciar} />)
    await waitFor(() => expect(screen.getByText('Cardio HIIT')).toBeDefined())
  })

  it('el botón Cargar preset carga los valores en el formulario', async () => {
    getPresets.mockResolvedValue([
      { id: 'p1', nombre: 'Sprint', sets: 10, trabajo: 30, descanso: 15, calentamiento: 180, enfriamiento: 180, creadoEn: null },
    ])
    render(<TimerConfig onIniciar={onIniciar} />)
    await waitFor(() => screen.getByText('Sprint'))
    fireEvent.click(screen.getByText('Sprint'))
    // sets input should show 10
    const setsInput = screen.getByDisplayValue('10')
    expect(setsInput).toBeDefined()
  })

  it('el botón Eliminar llama a deletePreset()', async () => {
    getPresets.mockResolvedValue([
      { id: 'p1', nombre: 'A borrar', sets: 4, trabajo: 20, descanso: 10, calentamiento: 120, enfriamiento: 120, creadoEn: null },
    ])
    render(<TimerConfig onIniciar={onIniciar} />)
    await waitFor(() => screen.getByLabelText('Eliminar preset'))
    fireEvent.click(screen.getByLabelText('Eliminar preset'))
    await waitFor(() => expect(deletePreset).toHaveBeenCalledWith('uid1', 'p1'))
  })

  it('el botón Guardar preset está deshabilitado si hay 5 presets', async () => {
    const presets = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`, nombre: `Preset ${i}`, sets: 4, trabajo: 20, descanso: 10,
      calentamiento: 120, enfriamiento: 120, creadoEn: null,
    }))
    getPresets.mockResolvedValue(presets)
    render(<TimerConfig onIniciar={onIniciar} />)
    await waitFor(() => screen.getByText('Guardar'))
    expect(screen.getByText('Guardar').disabled).toBe(true)
  })

  it('el botón Guardar preset guarda con el nombre ingresado', async () => {
    getPresets.mockResolvedValue([])
    render(<TimerConfig onIniciar={onIniciar} />)
    await waitFor(() => screen.getByPlaceholderText('Nombre del preset'))
    fireEvent.change(screen.getByPlaceholderText('Nombre del preset'), { target: { value: 'Mi preset' } })
    await act(async () => { fireEvent.click(screen.getByText('Guardar')) })
    expect(savePreset).toHaveBeenCalledWith('uid1', expect.objectContaining({ nombre: 'Mi preset' }))
  })
})
