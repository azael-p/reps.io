import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './config'

const provider = new GoogleAuthProvider()

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider)
  return result.user
}

export async function signOutUser() {
  await signOut(auth)
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
