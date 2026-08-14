import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, terminate, clearIndexedDbPersistence } from 'firebase/firestore'
import { auth, db } from './config'

const provider = new GoogleAuthProvider()

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider)
  return result.user
}

// Limpia el cache local de Firestore (datos de entrenamiento) para que no
// quede legible en un dispositivo compartido tras cerrar sesión. terminate()
// deja `db` inutilizable, así que forzamos un reload: config.js reinicializa
// una instancia nueva al volver a cargar. Es best-effort: si otra pestaña
// sigue usando la persistencia, clearIndexedDbPersistence rechaza — no debe
// impedir que el logout se complete.
export async function signOutUser() {
  await signOut(auth)
  try {
    await terminate(db)
    await clearIndexedDbPersistence(db)
  } catch (e) {
    console.error('No se pudo limpiar el cache de Firestore al cerrar sesión:', e)
  }
  if (typeof caches !== 'undefined') {
    try { await caches.delete('firestore-cache') } catch { /* Cache Storage no disponible */ }
  }
  window.location.href = '/'
}

export async function handleFirstLogin(firebaseUser) {
  const { uid, email, displayName, photoURL } = firebaseUser

  const ref = doc(db, 'usuarios', uid)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    await setDoc(ref, {
      nombre: displayName || email,
      email,
      photoURL: photoURL || null,
    })
    return { usuario: { id: uid, nombre: displayName || email, email, photoURL } }
  }

  return { usuario: { id: uid, ...snap.data() } }
}
