# BUGS_OPTIMIZATION.md — Plan de fixes para reps.io

> Documento de ejecución para `claude-code`. Abrir en una sesión nueva y trabajar de arriba hacia abajo. Cada bloque está priorizado y trae los paths exactos a tocar. **Hacer un commit por sección.** No saltar a la siguiente sección hasta que el checklist de la sección esté completo.

**Stack:** React 19 + Vite + Firebase Firestore + motion v12 + recharts + vite-plugin-pwa. Vitest para tests. Sin Firebase Auth real (PINs hardcodeados via `src/firebase/auth.js`).

**Prioridad:** 🔴 crítico · 🟠 alto · 🟡 medio · 🟢 bajo.

---

## 1. 🔴 Firestore Rules — agujeros de seguridad

**Archivo:** `firestore.rules`

### Problema A — `dias`, `ejerciciosDia` y `registros` totalmente abiertos
Líneas 23–33:

```
match /dias/{id}            { allow read, write: if request.auth != null; }
match /ejerciciosDia/{id}   { allow read, write: if request.auth != null; }
match /registros/{id}       { allow read, write: if request.auth != null; }
```

Cualquier usuario autenticado puede leer/borrar los días, ejercicios y registros de **cualquier otro usuario**. Sólo `programas`, `sesiones` y `usuarios/{userId}` validan ownership.

### Problema B — Modo prueba caduca pronto
Las reglas estaban en "modo prueba" creado el 2026-05-20 con expiración a 30 días → vencen ~**2026-06-19**. Hoy 2026-05-28 → quedan ~3 semanas.

### Problema C — Mismatch con autenticación real
La app usa **PINs hardcodeados** (`src/firebase/auth.js`), no Firebase Auth. Hay que decidir:

- **Opción 1 (recomendada):** migrar a `signInAnonymously()` de Firebase Auth y mapear `uid` ↔ `usuarioId` interno. Las rules existentes pasan a ser efectivas.
- **Opción 2 (rápida):** dejar la app como está y endurecer reglas suponiendo "app privada de 3 personas", aceptando que cualquier persona que conozca un PIN tiene acceso a todo.

### Fix — endurecer rules con cascada (asume Opción 1)

Reemplazar bloques 23–33 por:

```
function esDuenoDeDia(diaId) {
  let dia = get(/databases/$(database)/documents/dias/$(diaId)).data;
  return get(/databases/$(database)/documents/programas/$(dia.programaId)).data.usuarioId == request.auth.uid;
}

function esDuenoDeSesion(sesionId) {
  return get(/databases/$(database)/documents/sesiones/$(sesionId)).data.usuarioId == request.auth.uid;
}

match /dias/{id} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/programas/$(resource.data.programaId)).data.usuarioId == request.auth.uid;
  allow create: if request.auth != null
    && get(/databases/$(database)/documents/programas/$(request.resource.data.programaId)).data.usuarioId == request.auth.uid;
  allow update, delete: if request.auth != null
    && get(/databases/$(database)/documents/programas/$(resource.data.programaId)).data.usuarioId == request.auth.uid;
}

match /ejerciciosDia/{id} {
  allow read, update, delete: if request.auth != null && esDuenoDeDia(resource.data.diaId);
  allow create: if request.auth != null && esDuenoDeDia(request.resource.data.diaId);
}

match /registros/{id} {
  allow read, update, delete: if request.auth != null && esDuenoDeSesion(resource.data.sesionId);
  allow create: if request.auth != null && esDuenoDeSesion(request.resource.data.sesionId);
}
```

### Deploy

```bash
firebase deploy --only firestore:rules
```

Después verificar en la consola de Firebase que el caducamiento de "modo prueba" desapareció.

### Checklist
- [ ] Decidir Opción 1 vs 2 con el usuario
- [ ] Reemplazar reglas según opción elegida
- [ ] `firebase deploy --only firestore:rules`
- [ ] Probar manualmente: crear día, agregar ejercicio, completar sesión
- [ ] Verificar que la fecha de expiración "modo prueba" ya no aparece

---

## 2. 🟠 Firestore — N+1 en cascade deletes

### `src/firebase/programas.js:23-30` — `eliminarPrograma`

Hoy hace 1 query por programa + 1 query por cada día + N deletes secuenciales. Para un programa con 6 días × 8 ejercicios = ~50 reads + 50 writes en serie.

**Fix:** una sola transacción `writeBatch`.

```js
import { writeBatch } from 'firebase/firestore'

export async function eliminarPrograma(programaId) {
  const diasSnap = await getDocs(query(collection(db, 'dias'), where('programaId', '==', programaId)))
  const diasIds = diasSnap.docs.map(d => d.id)
  const ejSnaps = await Promise.all(
    diasIds.map(diaId =>
      getDocs(query(collection(db, 'ejerciciosDia'), where('diaId', '==', diaId)))
    )
  )
  const batch = writeBatch(db)
  ejSnaps.forEach(snap => snap.docs.forEach(e => batch.delete(e.ref)))
  diasSnap.docs.forEach(d => batch.delete(d.ref))
  batch.delete(doc(db, 'programas', programaId))
  await batch.commit()
}
```

### Revisar mismos patrones en
- `src/firebase/dias.js` → `eliminarDia` (borra ejerciciosDia + dia)
- `src/firebase/sesiones.js` → `eliminarSesion` (borra registros + sesion)
- `src/firebase/ejerciciosDia.js` → `eliminarEjercicio` si dispara cascade

Para cada uno, mismo patrón: agrupar deletes en un único `writeBatch`.

### `src/firebase/programas.js:12-17` — `crearPrograma` lee todo para calcular orden

```js
const snap = await getDocs(query(collection(db, 'programas'), where('usuarioId', '==', usuarioId)))
const orden = snap.docs.length
```

**Fix sencillo:** usar `Date.now()` como orden por defecto y dejar que la reordenación manual con `reordenarProgramas` normalice los valores. Evita un read innecesario por cada `crear`.

```js
export async function crearPrograma(usuarioId, nombre) {
  const ref = await addDoc(collection(db, 'programas'), { usuarioId, nombre, orden: Date.now() })
  return ref.id
}
```

### Checklist
- [ ] `eliminarPrograma` reescrito con writeBatch
- [ ] `eliminarDia` reescrito con writeBatch
- [ ] `eliminarSesion` reescrito con writeBatch
- [ ] `crearPrograma` usa `Date.now()` como orden
- [ ] Test manual: crear → borrar programa con 3 días y verificar que no queden días/ejercicios huérfanos
- [ ] Mirar Firestore Usage en consola → confirmar caída de reads

---

## 3. 🟠 Bugs lógicos

### `src/pages/SesionActiva.jsx` — desincronización historial ↔ ultimoPeso
Buscar el bloque donde se hace `historial.push` y luego `ultimoPeso.update` (aprox línea 200–215, dentro del handler de guardar serie). Hoy son dos writes separados — si el segundo falla queda `historial` actualizado y `ultimoPeso` desfasado.

**Fix:** envolver en `writeBatch(db)` o reusar `setDoc(ref, {...}, { merge: true })` para hacerlo atómico. Si fallan ambos, mostrar toast de error y no avanzar de serie.

### `src/pages/Home.jsx` — banner de sesión activa puede mostrarse cuando ya está completa
Líneas ~75–90 (función `recargar`): se filtra `completada === false` al momento de la carga. Si el usuario completa la sesión desde otra pestaña, el banner queda. **Fix:** justo antes de mostrar el banner, hacer un `getDoc(doc(db, 'sesiones', sesionId))` quick-check; si `completada === true`, limpiar `localStorage` y no mostrar.

### `src/pages/ResumenSesion.jsx` — race entre `completarSesion` y `backfillResumen`
Buscar lugar donde se invocan ambas (aprox línea 80–95). Hoy se disparan en paralelo. **Fix:** secuencial:

```js
await backfillResumen(sesionId)   // primero escribe el resumen
await completarSesion(sesionId)    // después marca completada
```

`completarSesion` debe quedar como la última señal de que todo terminó OK.

### `src/firebase/programas.js` — `getProgramas` no maneja error
Si la red está caída, devuelve excepción no atrapada en el caller. Agregar try/catch en los callers (`Programas.jsx`, `Entrenar.jsx`, `Home.jsx`) y mostrar `<ErrorState />` (definido en UI plan) o un toast.

### Checklist
- [ ] SesionActiva: writeBatch al guardar serie
- [ ] Home: re-chequear `completada` antes de mostrar banner
- [ ] ResumenSesion: await secuencial
- [ ] Try/catch en callers de `getProgramas`, `getSesiones`, `getRegistros`

---

## 4. 🟡 React — performance

### `src/context/UserContext.jsx`
Envolver `value` del provider en `useMemo` para que cambios en otros parents no fuercen re-render a todos los consumidores:

```jsx
const value = useMemo(() => ({ usuario, loading, login, logout }), [usuario, loading])
return <UserContext.Provider value={value}>{children}</UserContext.Provider>
```

### `src/pages/Progreso.jsx` — recálculos en cada render
Identificar y envolver en `useMemo`:
- `frecuenciaSemanal()` → `useMemo(() => frecuenciaSemanal(sesionesConResumen), [sesionesConResumen])`
- `datosVolumen`, `datosGrafico`, `streaks` → cada uno con sus dependencias.
- Memoizar `Tooltip` custom y `XAxis` ticks con `useCallback`.

### `src/pages/ResumenSesion.jsx`
- `porEjercicio` (cerca de línea 146) → `useMemo(() => agrupar(registros), [registros])`.

### Keys por índice en `.map()`
Reemplazar `key={i}` por keys estables en `src/pages/Progreso.jsx` (5+ lugares). Cada item de Firestore tiene `id` — usarlo. Cuando sea data agregada (e.g. semanas), construir clave determinista (`${año}-${semana}`).

### `src/pages/Home.jsx` — `recargar` sin cancelación
Aprox líneas 60–89: `Promise.all` corre aunque el componente se desmonte. Agregar:

```js
useEffect(() => {
  let cancelled = false
  ;(async () => {
    const [a, b, c] = await Promise.all([...])
    if (cancelled) return
    setX(a); setY(b); setZ(c)
  })()
  return () => { cancelled = true }
}, [usuario])
```

### `src/pages/Entrenar.jsx:25-27` — setTimeout sin cleanup
```js
useEffect(() => {
  const t = setTimeout(() => { ... }, 200)
  return () => clearTimeout(t)
}, [...])
```

### Checklist
- [ ] UserContext memoizado
- [ ] Progreso: useMemo en cálculos pesados
- [ ] ResumenSesion: useMemo en `porEjercicio`
- [ ] Reemplazar keys por índice en Progreso
- [ ] Home: AbortController/flag de cancelación
- [ ] Entrenar: cleanup de setTimeout

---

## 5. 🟡 Firestore — paginación y queries

### `getSesiones` carga todas las sesiones del usuario
Cuando el historial crezca a 200+ sesiones, descargar todo en cada visita a Progreso/Home es derroche.

**Fix:** agregar `limit(50)` + cursor en `src/firebase/sesiones.js`. Exponer `getSesionesPaginadas(usuarioId, lastDoc)` que devuelva `{ sesiones, lastDoc }`. En `Progreso → Historial` mostrar botón "Ver más" o infinite scroll.

### Índices compuestos faltantes
La query típica es:
```js
where('usuarioId', '==', x) + where('completada', '==', true) + orderBy('fecha', 'desc')
```
Verificar en consola de Firebase si el índice existe (sale como warning en consola cuando falta). Si no, crear `firestore.indexes.json` con:

```json
{
  "indexes": [{
    "collectionGroup": "sesiones",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "usuarioId", "order": "ASCENDING" },
      { "fieldPath": "completada", "order": "ASCENDING" },
      { "fieldPath": "fecha", "order": "DESCENDING" }
    ]
  }]
}
```

Deploy con `firebase deploy --only firestore:indexes`.

### Checklist
- [ ] `getSesionesPaginadas` implementada
- [ ] Progreso → Historial usa paginación
- [ ] `firestore.indexes.json` creado y deployado

---

## 6. 🟢 PWA / Service Worker

### `vite.config.js` — falta runtime caching para Firestore
Hoy `workbox.runtimeCaching` sólo cubre Google Fonts. Para que la app abra offline mostrando datos cacheados:

```js
{
  urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*$/,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'firestore-cache',
    networkTimeoutSeconds: 4,
    expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
  },
},
```

> Nota: Firestore tiene su propia caché offline ya activada en `config.js`. Este runtime cache es para REST/Cloud Functions futuros, no estrictamente necesario hoy. Mantenerlo como mejora opcional.

### `manifest.webmanifest` — ya está OK
`theme_color` y `background_color` están en `#0a0a0c` (`vite.config.js:20-21`). No tocar.

### Checklist
- [ ] (Opcional) Sumar runtimeCaching para `firestore.googleapis.com`
- [ ] Verificar que `npm run build` no genera warnings nuevos

---

## 7. 🟢 Bundle / lazy loading

### Lazy-load de Progreso (recharts pesa ~250KB)
`src/App.jsx`: convertir la ruta `/progreso` a `React.lazy`:

```jsx
const Progreso = React.lazy(() => import('./pages/Progreso'))
// dentro del Routes:
<Suspense fallback={<ListSkeleton />}>
  <Route path="/progreso" element={<Progreso />} />
</Suspense>
```

Verificar con `npm run build` que aparece un chunk separado para Progreso + recharts.

### Checklist
- [ ] Progreso lazy-loaded
- [ ] Verificar chunks en `dist/assets/`

---

## 8. 🟢 Accesibilidad

### `src/components/ui.jsx` — `<Modal />`
- Sumar `role="dialog"` y `aria-modal="true"` en el contenedor.
- Implementar focus trap mínimo: al abrir, hacer `focus()` al primer botón; al cerrar, devolver foco al elemento que lo invocó (guardar `document.activeElement` en `useRef`).

### `src/pages/SesionActiva.jsx`
- Cada input de peso/reps necesita `aria-label="Peso (kg)"` / `aria-label="Repeticiones"`.
- El contador de series ("3/4") con `aria-live="polite"` para que se anuncie al completar.

### `src/components/Calendario.jsx`
- Botones de navegación de mes con `aria-label="Mes anterior" / "Mes siguiente"`.
- Días con `aria-label="14 de mayo, sesión registrada"`.

### Contraste
Verificar `--text-mute: #9a9aa3` sobre `--bg-card: #16161b` con un checker (WebAIM, axe). Si no llega a 4.5:1, subir luminancia a `#a8a8b2`.

### Checklist
- [ ] Modal aria-* + focus trap básico
- [ ] aria-label en inputs de SesionActiva
- [ ] aria-live en contador de series
- [ ] aria-label en Calendario
- [ ] Confirmar contraste AA en --text-mute

---

## 9. 🟢 Tests faltantes

### Cobertura actual
- `src/firebase/registros.test.js` — helpers locales
- `src/firebase/sesiones.test.js` — helpers locales
- `src/components/BottomNav.test.jsx`, `Calendario.test.jsx`, `SeleccionarEjercicio.test.jsx`

### Tests a sumar
- `src/firebase/programas.test.js` — `crearPrograma`, `eliminarPrograma` (post-batch), `reordenarProgramas`. Mockear Firestore con `firebase/firestore` mocks de Vitest.
- `src/firebase/dias.test.js` — `eliminarDia` con cascade.
- `src/pages/SesionActiva.test.jsx` — restauración de sesión desde Firestore (mock de `getRegistros` + `getSesion`).
- `src/pages/ResumenSesion.test.jsx` — orden secuencial de `backfillResumen` y `completarSesion`.

### Comando
```bash
npm test
```
Ejecutarlo después de cada batch de fixes que toque archivos cubiertos por tests existentes para detectar regresiones.

### Checklist
- [ ] `programas.test.js` con tests del nuevo `eliminarPrograma` batch
- [ ] `dias.test.js`
- [ ] `SesionActiva.test.jsx` test de restore
- [ ] `ResumenSesion.test.jsx` test de orden de awaits
- [ ] `npm test` verde

---

## 10. Checklist global

Ir tildando a medida que cada sección se commitea.

- [ ] 🔴 Sección 1 — Firestore Rules
- [ ] 🟠 Sección 2 — Cascade deletes
- [ ] 🟠 Sección 3 — Bugs lógicos
- [ ] 🟡 Sección 4 — React performance
- [ ] 🟡 Sección 5 — Paginación
- [ ] 🟢 Sección 6 — PWA
- [ ] 🟢 Sección 7 — Lazy load
- [ ] 🟢 Sección 8 — Accesibilidad
- [ ] 🟢 Sección 9 — Tests

**Reglas de oro durante la ejecución:**
1. Commitear cada sección por separado (commit msg: `fix(security): ...`, `perf(firestore): ...`, etc).
2. Correr `npm run lint && npm test` antes de cada commit.
3. Probar manualmente la feature afectada antes de pasar a la siguiente sección.
4. Deployar a Firebase Hosting sólo al final, con todo verde local (`npm run build && firebase deploy`).
