vi.mock('./config', () => ({ auth: 'AUTH', db: {} }))

const mockSignInWithPopup = vi.fn()
const mockSignOut = vi.fn()
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
  signInWithPopup: (...args) => mockSignInWithPopup(...args),
  signOut: (...args) => mockSignOut(...args),
}))

const mockGetDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockTerminate = vi.fn()
const mockClearIndexedDbPersistence = vi.fn()
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, col, id) => ({ _col: col, _id: id })),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  terminate: (...args) => mockTerminate(...args),
  clearIndexedDbPersistence: (...args) => mockClearIndexedDbPersistence(...args),
}))

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { signInWithGoogle, signOutUser, handleFirstLogin } from './auth'

const originalLocation = window.location
const mockCachesDelete = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockTerminate.mockResolvedValue(undefined)
  mockClearIndexedDbPersistence.mockResolvedValue(undefined)
  mockCachesDelete.mockResolvedValue(true)
  global.caches = { delete: mockCachesDelete }
  delete window.location
  window.location = { href: '' }
})

afterEach(() => {
  window.location = originalLocation
})

// ---------------------------------------------------------------------------

describe('signInWithGoogle', () => {
  it('llama a signInWithPopup y devuelve el user de Firebase', async () => {
    const fakeUser = { uid: 'u1' }
    mockSignInWithPopup.mockResolvedValue({ user: fakeUser })

    const result = await signInWithGoogle()

    expect(mockSignInWithPopup).toHaveBeenCalledWith('AUTH', expect.any(Object))
    expect(result).toBe(fakeUser)
  })
})

// ---------------------------------------------------------------------------

describe('signOutUser', () => {
  it('llama a signOut con la instancia de auth', async () => {
    mockSignOut.mockResolvedValue(undefined)
    await signOutUser()
    expect(mockSignOut).toHaveBeenCalledWith('AUTH')
  })

  it('termina y limpia la persistencia de Firestore, y borra el cache del SW', async () => {
    mockSignOut.mockResolvedValue(undefined)
    await signOutUser()
    expect(mockTerminate).toHaveBeenCalledWith({})
    expect(mockClearIndexedDbPersistence).toHaveBeenCalledWith({})
    expect(mockCachesDelete).toHaveBeenCalledWith('firestore-cache')
  })

  it('fuerza una recarga a "/" para reinicializar Firestore', async () => {
    mockSignOut.mockResolvedValue(undefined)
    await signOutUser()
    expect(window.location.href).toBe('/')
  })

  it('si falla la limpieza de Firestore, igual completa el logout y recarga', async () => {
    mockSignOut.mockResolvedValue(undefined)
    mockTerminate.mockRejectedValue(new Error('otra pestaña sigue activa'))
    await signOutUser()
    expect(window.location.href).toBe('/')
  })

  it('si signOut falla, no limpia nada ni recarga', async () => {
    mockSignOut.mockRejectedValue(new Error('sin red'))
    await expect(signOutUser()).rejects.toThrow('sin red')
    expect(mockTerminate).not.toHaveBeenCalled()
    expect(window.location.href).toBe('')
  })
})

// ---------------------------------------------------------------------------

describe('handleFirstLogin — usuario nuevo', () => {
  beforeEach(() => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockSetDoc.mockResolvedValue(undefined)
  })

  it('crea el documento de usuario con los datos de Google', async () => {
    const firebaseUser = { uid: 'u1', email: 'a@b.com', displayName: 'Azael', photoURL: 'http://foto' }

    const result = await handleFirstLogin(firebaseUser)

    expect(mockSetDoc).toHaveBeenCalledWith(
      { _col: 'usuarios', _id: 'u1' },
      { nombre: 'Azael', email: 'a@b.com', photoURL: 'http://foto' },
    )
    expect(result).toEqual({
      usuario: { id: 'u1', nombre: 'Azael', email: 'a@b.com', photoURL: 'http://foto' },
    })
  })

  it('usa el email como nombre si no hay displayName', async () => {
    const firebaseUser = { uid: 'u1', email: 'a@b.com', displayName: null, photoURL: null }

    const result = await handleFirstLogin(firebaseUser)

    expect(result.usuario.nombre).toBe('a@b.com')
    expect(mockSetDoc.mock.calls[0][1].nombre).toBe('a@b.com')
  })

  it('guarda photoURL como null si Google no la provee', async () => {
    const firebaseUser = { uid: 'u1', email: 'a@b.com', displayName: 'Azael', photoURL: undefined }

    await handleFirstLogin(firebaseUser)

    expect(mockSetDoc.mock.calls[0][1].photoURL).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe('handleFirstLogin — usuario existente', () => {
  it('no vuelve a crear el documento y devuelve los datos ya guardados en Firestore', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ nombre: 'Nombre guardado', email: 'a@b.com', photoURL: 'http://x' }),
    })
    const firebaseUser = { uid: 'u1', email: 'a@b.com', displayName: 'Nombre de Google', photoURL: 'http://y' }

    const result = await handleFirstLogin(firebaseUser)

    expect(mockSetDoc).not.toHaveBeenCalled()
    expect(result).toEqual({
      usuario: { id: 'u1', nombre: 'Nombre guardado', email: 'a@b.com', photoURL: 'http://x' },
    })
  })
})
