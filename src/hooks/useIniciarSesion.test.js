const mockShow = vi.hoisted(() => vi.fn())
const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('../components/Toast', () => ({ useToast: () => ({ show: mockShow }) }))
vi.mock('../context/UserContext', () => ({ useUser: () => ({ usuario: { id: 'user1' } }) }))
vi.mock('../firebase/sesiones', () => ({ crearSesion: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIniciarSesion } from './useIniciarSesion'
import { crearSesion } from '../firebase/sesiones'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

// ---------------------------------------------------------------------------

describe('useIniciarSesion', () => {
  it('crea la sesión, guarda el puntero en localStorage y navega sin esperar el ACK', () => {
    crearSesion.mockReturnValue({ id: 'ses1', listo: Promise.resolve() })
    const { result } = renderHook(() => useIniciarSesion())

    result.current('dia1')

    expect(crearSesion).toHaveBeenCalledWith('user1', 'dia1')
    expect(localStorage.getItem('sesion_activa_user1')).toBe('ses1')
    expect(mockNavigate).toHaveBeenCalledWith('/sesion/ses1')
  })

  it('si el ACK del servidor falla, avisa por toast sin revertir la navegación', async () => {
    const listo = Promise.reject(new Error('offline'))
    listo.catch(() => {})
    crearSesion.mockReturnValue({ id: 'ses1', listo })
    const { result } = renderHook(() => useIniciarSesion())

    result.current('dia1')
    await new Promise(r => setTimeout(r, 0))

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning' }))
    expect(mockNavigate).toHaveBeenCalledWith('/sesion/ses1')
  })
})
