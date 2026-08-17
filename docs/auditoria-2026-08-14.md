# Auditoría de reps.io — 14 de agosto de 2026

Análisis completo del código: bugs, seguridad y deuda técnica. Todos los hallazgos
fueron verificados leyendo el código; cada uno cita `archivo:línea` y transcribe el
fragmento relevante.

**Estado base al momento de la auditoría:**

- `npm run test:run` → 41 archivos, 347 tests, **todos pasan**
- `npm run lint` → **0 errores**, 7 warnings (`react-hooks/set-state-in-effect`)
- `npm audit` → 20 vulnerabilidades (1 crítica, 9 altas, 9 moderadas, 1 baja)
- Cero `TODO`/`FIXME`/`HACK` en `src/` y `scripts/`

Esta auditoría es **solo diagnóstico**: no se modificó código de la app, ni reglas,
ni configuración.

---

## Resumen priorizado

| # | Sev. | Ubicación | Problema |
|---|---|---|---|
| 1 | 🔴 crítica | `ResumenSesion.jsx:98-110` | Completar sesión sin red cuelga la UI y pierde el entrenamiento — **✅ resuelto 2026-08-14** |
| 2 | 🔴 crítica | `ResumenSesion.jsx:98-105` | Completar sesión no es atómico y el self-healing no repara el desfasaje — **✅ resuelto 2026-08-14** |
| 3 | 🔴 crítica | `statsGlobal.js:62-82` | `setDoc` sin merge puede borrar el historial de stats — **✅ resuelto 2026-08-14** |
| 4 | 🟠 alta | `statsEjercicios.js:80-89` | `getDoc` dentro de un `for`: N round-trips secuenciales — **✅ resuelto 2026-08-14** |
| 5 | 🟠 alta | `SeleccionarEjercicio.jsx:105-107` | `seriesEsperadas: 0` vuelve un día imposible de entrenar — **✅ resuelto 2026-08-14** |
| 6 | 🟠 alta | `Timer.jsx:16-19`, `useWakeLock.js` | Wake lock y audio nunca liberados al salir; nunca re-adquiridos — **✅ resuelto 2026-08-14** |
| 7 | 🟠 alta | `useTimer.js:87-103` | El timer se desincroniza con la pantalla bloqueada — **✅ resuelto 2026-08-14** |
| 8 | 🟠 alta | `firebase.json:15-34` | Hosting sin ningún header de seguridad (clickjacking) — **✅ resuelto 2026-08-14** |
| 9 | 🟠 alta | `useEliminarConUndo.js:33-35` | Docs soft-deleted que nunca se borran — **✅ resuelto 2026-08-14** |
| 10 | 🟡 media-alta | `vite.config.js:88-96` | El SW cachea respuestas de Firestore y no se purgan al cerrar sesión — **✅ resuelto 2026-08-14** |
| 11 | 🟡 media | `Entrenar.jsx:37-57` | Elegir otro día abandona la sesión en curso con sus registros — **✅ resuelto 2026-08-14** |
| 12 | 🟡 media | `firestore.rules:42,48,85,95` | Sin validación de tipo ni tamaño en los campos grandes — **✅ resuelto 2026-08-15** |
| 13 | 🟡 media | `Progreso.jsx:227-237` | Eliminar una sesión no es atómico — **✅ resuelto 2026-08-17** |
| 14 | 🟡 media | `utils/stats.js:39-65` | Frecuencia semanal: omite semanas vacías y cuenta sesiones como días — **✅ resuelto 2026-08-17** |
| 15 | 🟡 media | `UpdateBanner.jsx:18-20` | Auto-reload sin aviso a mitad de una serie — **✅ resuelto 2026-08-17** |
| 16 | 🟡 media | `ResumenSesion.jsx:106-108` | Backfillea el resumen pero no los agregados — **✅ resuelto 2026-08-17** |
| 17 | 🟡 media | varios | Errores tragados en silencio y promesas flotantes — **✅ resuelto 2026-08-17** |
| 18 | 🟡 media | `npm audit` | 20 vulnerabilidades; `npm audit fix` resuelve la mayoría sin breaking changes |
| 19–26 | 🟢 baja | ver sección | `statsDocId`, DST, código muerto, `localStorage`, accesibilidad, reglas menores |

Los tres primeros son los que **rompen datos de usuarios reales** y deberían ir
primero. El #4, #5 y #8 son los de mejor relación esfuerzo/impacto.

**Actualización 2026-08-14:** los bugs #1, #2 y #3 fueron resueltos en un
único fix combinado (ver la sección "Resolución" dentro de cada uno, más
abajo). De paso se detectó y arregló el mismo patrón del #1 en
`agregarRegistro` (`src/firebase/registros.js`), no listado originalmente en
esta tabla. El bug #4 también quedó resuelto (ver su propia sección de
Resolución): mitad como efecto colateral del fix del #2, mitad con un fix
separado en `programas.js`.

---

## 🔴 Críticos

### 1. Completar la sesión sin red cuelga la UI y pierde el entrenamiento

[src/pages/ResumenSesion.jsx:98-110](../src/pages/ResumenSesion.jsx#L98-L110)

```js
if (!sesionData.completada) {
  const resumen = buildResumen(regs, diaNombreVal)
  await backfillResumen(sesionId, resumen)
  await completarSesion(sesionId)
  if (usuario?.id) {
    await aplicarSesionAResumenGlobal(usuario.id, { sesionId, fecha: sesionData.fecha, resumen })
    await aplicarSesionAStats(usuario.id, { sesionId, fecha: sesionData.fecha, resumen })
  }
}
...
setCargando(false)   // línea 110
```

Con `persistentLocalCache` activo ([src/firebase/config.js:18-22](../src/firebase/config.js#L18-L22)),
las promesas de `updateDoc`/`addDoc`/`setDoc` **no resuelven hasta el ACK del
servidor**. La escritura se aplica al cache local y se sincroniza después, pero el
`await` queda pendiente indefinidamente mientras no haya red.

**Escenario de falla:** gimnasio en subsuelo, sin señal. El usuario termina el
entrenamiento y entra al resumen. `await backfillResumen(...)` nunca resuelve →
`setCargando(false)` (línea 110) nunca corre → **spinner infinito**. Peor: las tres
escrituras siguientes ni siquiera se encolan, porque están detrás del `await`. El
usuario cierra la app; la sesión queda `completada: false`, no aparece en el
historial (todas las queries filtran `completada == true`), no suma al calendario
ni a la racha, y sus `registros` quedan huérfanos consumiendo cuota.

**Mismo patrón:** [src/firebase/sesiones.js:44-53](../src/firebase/sesiones.js#L44-L53)
(`crearSesion` → spinner infinito en `Entrenar`, no se puede empezar a entrenar
offline) y [src/firebase/peso.js:4-9](../src/firebase/peso.js#L4-L9) (`agregarPeso`).

**Fix propuesto:** no `await`ear las escrituras que deben funcionar offline —
Firestore garantiza el orden y la entrega local. Disparar el pipeline y actualizar
la UI de forma optimista, o envolver en `Promise.race` con timeout y continuar. Como
mínimo, mover `setCargando(false)` a un `finally`… aunque eso no alcanza: el
problema no es el `catch`, es que la promesa nunca se asienta.

**Resolución (2026-08-14):** se aplicó el patrón "fire-and-forget con toast
diferido" en los 4 puntos con este bug (más uno adicional encontrado durante el
fix, ver abajo):

- [`ResumenSesion.jsx` `cargar()`](../src/pages/ResumenSesion.jsx#L98) y
  `guardarEdicion()`: las escrituras ya no se `await`ean antes de destrabar la
  UI. `setCargando(false)` corre inmediatamente después de la parte 100%
  local/lectura; un fallo eventual se reporta con un toast (`variant:'warning'`,
  vía `useToast`) en vez de `setError` bloqueante.
- [`crearSesion`](../src/firebase/sesiones.js#L44) (`Entrenar.jsx`) y
  [`agregarRegistro`](../src/firebase/registros.js#L17) (`SesionActiva.jsx`,
  ver nota abajo): se pre-genera el id del doc con `doc(collection(db, '...'))`
  (Firestore lo genera client-side, sin round trip) y se escribe con `setDoc`
  sin esperar su resolución; ambas devuelven `{ id, listo }` — el `id` es
  usable de inmediato, `listo` es la promesa para reportar un fallo tardío.
  `Entrenar.jsx` navega con el id pre-generado sin esperar `listo`.
- `agregarPeso` (`peso.js`) no se modificó — sus 2 callers
  (`Onboarding.jsx`, `Progreso.jsx`) dejaron de hacer `await` sobre ella.
- **Bug adicional descubierto al implementar el fix, no listado originalmente:**
  el mismo patrón exacto vivía en `agregarRegistro`
  (`src/firebase/registros.js:17`, llamado desde `SesionActiva.jsx` en cada
  serie completada durante el entrenamiento) — el caso más expuesto de los
  cuatro por frecuencia (una escritura cada 1-2 min durante toda la sesión, en
  el escenario de uso central de la app). Se decidió con el usuario incluirlo
  en el mismo fix. `registroId` se sigue necesitando de forma síncrona para
  `retroceder()` (permite reeditar la última serie); el id pre-generado lo
  garantiza sin esperar red.
- Se eliminaron los spinners bloqueantes en 3 de estos puntos (edición de
  serie en `ResumenSesion`, botón de `Onboarding`, modal de peso en
  `Progreso`) porque la escritura ya se aplicó al cache local al invocarla —
  decisión de UX confirmada explícitamente con el usuario. En
  `SesionActiva.jsx`, el estado `guardando` se conservó como guard
  anti-doble-tap (ya no depende del ACK, se resuelve en el mismo tick).

Tests: `ResumenSesion.test.jsx`, `Entrenar.test.jsx` y `registros.test.js`
tienen casos nuevos que simulan una escritura que nunca resuelve (`new
Promise(() => {})`) y verifican que la UI igual se destraba.

### 2. Completar la sesión no es atómico y el self-healing no repara el desfasaje

[src/pages/ResumenSesion.jsx:98-105](../src/pages/ResumenSesion.jsx#L98-L105) (mismo bloque)

Son **4 escrituras secuenciales a 3 rutas distintas** sin transacción ni batch. Si
falla la tercera (`aplicarSesionAResumenGlobal`), la sesión ya quedó
`completada: true` con su `resumen`, pero `stats/global` no tiene ni el día ni el
volumen, y `statsEjercicios` no tiene el PR ni la última vez.

Lo grave es que **el fallback self-healing no detecta este estado**:

```js
// statsGlobal.js:51-58 — solo reconstruye si el doc NO EXISTE
export async function getResumenGlobalConFallback(uid) {
  const existente = await getResumenGlobal(uid)
  if (existente) return existente     // ← un doc desactualizado se devuelve tal cual
  ...
}
```

```js
// statsEjercicios.js:118-120 — solo reconstruye si la colección está VACÍA
const existentes = await getStatsEjercicios(uid)
if (existentes.length > 0) return existentes
```

Un agregado **parcialmente** desactualizado nunca se cura: calendario, racha,
frecuencia semanal, volumen y PR quedan mal de forma permanente hasta correr
`scripts/backfillStats.js` a mano.

**Fix propuesto:** agrupar `sesiones/{id}` + `stats/global` + los
`statsEjercicios/{id}` en un solo `writeBatch` (son ≤ ~10 docs, muy lejos del
límite de 500), y/o versionar el agregado con `ultimaSesionAplicada` para poder
detectar el drift y repararlo.

**Resolución (2026-08-14):** implementado casi tal cual el fix propuesto.

- Nuevo orquestador
  [`completarSesionConAgregados`](../src/firebase/completarSesion.js) arma
  un único `writeBatch` que agrupa `sesiones/{id}` (vía `completarSesion` con
  el parámetro `batch` que ahora acepta), `stats/global` (vía la nueva
  escritura ciega, ver bug #3) y cada `statsEjercicios/{id}` (vía
  `aplicarSesionAStats`, que también pasó a aceptar un `batch` externo y
  hacer `batch.set(...)` sin comitear). El `commit()` es uno solo: o se
  aplican las 3 colecciones o ninguna.
- Mejora incidental al tocar
  [`aplicarSesionAStats`](../src/firebase/statsEjercicios.js#L75): las
  lecturas `getDoc` por ejercicio (bug #4, fuera de alcance de este fix)
  pasaron de secuenciales en un `for` a `Promise.all` — no resuelve el bug #4
  completo (`rebuildStatsEjercicios`/`getStatsEjerciciosConFallback` siguen
  con su patrón actual), pero era gratis al tener que tocar la función igual.
- Se implementó la segunda mitad del fix propuesto (versionar el agregado):
  `stats/global` ahora guarda `ultimaSesionId` y `actualizadoEn` en cada
  escritura del batch. **Importante:** esto es solo trazabilidad — no hay
  lógica de reparación automática que consuma estos campos todavía. El
  self-healing (`getResumenGlobalConFallback`,
  `getStatsEjerciciosConFallback`) sigue exactamente como se describe arriba
  (solo repara si falta el doc completo/la colección está vacía). Con el
  batch atómico, el escenario original de este bug (desfasaje parcial al
  completar una sesión) queda estructuralmente cerrado para ese flujo — lo
  que no cubre es inconsistencias previas a este fix, ni el flujo de
  `guardarEdicion()` (re-editar series de una sesión ya completada), que
  **deliberadamente quedó fuera del batch atómico** por decisión de alcance
  con el usuario (sigue haciendo 3 llamadas separadas, aunque ahora
  no-bloqueantes — ver bug #1). Es la extensión natural más obvia de este
  mismo diseño si se decide cerrar ese hueco más adelante.
- No se usó `runTransaction` — no está en uso en el proyecto y no convive
  bien con el modelo offline-first (una transacción no se beneficia del
  cache local igual que un `writeBatch`, así que hubiera reintroducido el
  bug #1).

Tests nuevos: [`completarSesion.test.js`](../src/firebase/completarSesion.test.js)
verifica que los 3 helpers reciben el mismo batch compartido y que se comitea
una sola vez, y que un `commit()` colgado no bloquea a quien la llama.

### 3. `setDoc` sin merge puede borrar el historial de stats

[src/firebase/statsGlobal.js:62-82](../src/firebase/statsGlobal.js#L62-L82)

```js
const actual = (await getResumenGlobal(uid)) ?? { diasEntrenados: [], volumenPorSesion: [] }
...
await setDoc(statsRef(uid), {
  diasEntrenados: [...dias].sort((a, b) => a - b),
  volumenPorSesion: volumen.sort((a, b) => a.fecha - b.fecha).slice(-MAX_VOLUMEN),
})
```

Es un ciclo leer-modificar-escribir sin transacción, y el `setDoc` **sobreescribe**
el documento entero (no hace merge). Offline u online-con-cache, `getDoc` puede
resolver desde el cache local; si `stats/global` **no está en el cache** (teléfono
nuevo, cache purgado por el navegador, primer arranque de la PWA), `snap.exists()`
devuelve `false`, `actual` cae al default vacío, y el `setDoc` reemplaza meses de
historial por **un solo día y un solo punto de volumen**.

**Escenario de falla:** usuario con 8 meses de historial estrena teléfono, abre la
app y va directo a `/entrenar` sin pasar por Home ni Progreso (que son las
pantallas que cachearían el doc). Al completar la sesión, el calendario y las
rachas se resetean a 1 día.

El mismo patrón sin salvaguarda está en
[statsGlobal.js:56](../src/firebase/statsGlobal.js#L56) (si `getSesionesConResumen`
devuelve un cache parcial, persiste un agregado truncado) y en
[statsGlobal.js:108](../src/firebase/statsGlobal.js#L108).

**Fix propuesto:** `runTransaction`, o `setDoc(..., { merge: true })` con
`arrayUnion` para `diasEntrenados`; y abortar la escritura si la lectura vino del
cache (`snap.metadata.fromCache`).

**Resolución (2026-08-14):** implementado el fix propuesto, con dos caminos
distintos según si hace falta leer antes de escribir o no.

- **Camino de alta (sesión nueva completada) — el caso real del bug:** nueva
  [`agregarSesionAResumenGlobalBlind`](../src/firebase/statsGlobal.js#L65)
  escribe directamente con `arrayUnion` + `{merge:true}`, **sin ningún
  `getDoc` previo**. Al no leer, estructuralmente no puede confundir un
  cache vacío/purgado con "no hay historial" — el escenario de falla
  original (celular nuevo → pisa 8 meses de historial) queda cerrado de
  raíz para este camino, que es el que se ejecuta al completar una sesión
  (vía el batch de `completarSesionConAgregados`, ver bug #2).
- **Camino de edición (`guardarEdicion`, re-editar series de una sesión ya
  completada)** sigue necesitando leer-modificar-escribir porque tiene que
  **reemplazar** una entrada existente por `sesionId` — algo que `arrayUnion`
  no puede hacer. Para este camino se agregó la salvaguarda propuesta:
  [`aplicarSesionAResumenGlobal`](../src/firebase/statsGlobal.js#L83) ahora
  chequea `snap.metadata.fromCache` — si el doc "no existe" según una
  lectura servida desde el cache (sin red), no asume que el historial está
  vacío: hace la misma alta ciega de arriba en vez de un `setDoc` de
  reemplazo total. También se le agregó `{merge:true}` como defensa
  adicional.
- `removerSesionDeResumenGlobal` también pasó su `setDoc` a `{merge:true}`
  (defensa adicional — es un flujo de borrado, no de alta; el riesgo
  residual ahí es "no borro un día que debería", no pérdida de historial).
- **Trade-off aceptado y documentado:** `arrayUnion` no puede cappear ni
  ordenar `volumenPorSesion` en la escritura (a diferencia del camino de
  edición, que sigue recortando a `MAX_VOLUMEN=200`). El array puede crecer
  más en el camino de alta que antes. El cap para lectura en `Progreso.jsx`
  ya se hacía en memoria, así que no rompe nada funcional hoy, pero vale
  monitorear el tamaño del doc en usuarios de mucha antigüedad — no
  resuelto en este fix (tarea de compactación periódica, pendiente).
- No se usó `runTransaction` (misma razón que en el bug #2: no está en uso
  en el proyecto y reintroduciría el riesgo de cuelgue offline del bug #1).

Tests nuevos en
[`statsGlobal.test.js`](../src/firebase/statsGlobal.test.js): confirman que
la escritura ciega nunca llama `getDoc`, y que el guard de `fromCache`
efectivamente evita el `setDoc` de reemplazo cuando el doc "no existe" según
una lectura de cache (vs. el camino normal cuando la lectura fue confirmada
por el servidor).

---

## 🟠 Altos

### 4. `getDoc` dentro de un `for`

[src/firebase/statsEjercicios.js:80-89](../src/firebase/statsEjercicios.js#L80-L89)

```js
const batch = writeBatch(db)
for (const ej of ejercicios) {
  const id = statsDocId(ej)
  const ref = doc(db, 'usuarios', uid, 'statsEjercicios', id)
  const snap = await getDoc(ref)          // ← N lecturas SECUENCIALES
  const merged = mergeSesionEnStats(snap.exists() ? snap.data() : null, ej, fechaMs, sesionId)
  batch.set(ref, merged)
}
```

Con 8 ejercicios por sesión son 8 round-trips encadenados, justo en el momento más
sensible (fin del entrenamiento, celular en la mano, conectividad mala). Viola la
regla explícita de `CLAUDE.md` sobre queries individuales.

**Matiz importante para el fix:** reemplazarlo por `getStatsEjercicios(uid)`
(traer la colección entera) **no reduce lecturas** — Firestore cobra 1 lectura por
documento devuelto, y la colección tiene más docs que ejercicios en la sesión.
Reduce **latencia**, no costo, y probablemente aumenta el costo. El fix correcto es
paralelizar los `getDoc` con `Promise.all`: mismas 8 lecturas, un solo round-trip.

**Antipatrón relacionado** en [src/firebase/programas.js:37-45](../src/firebase/programas.js#L37-L45):
`diasIds.map(diaId => getDocs(...))` — N queries en paralelo. Se resuelve con
`where('diaId', 'in', chunk)` en tandas de 30, exactamente como ya se hace en
[sesiones.js:24-30](../src/firebase/sesiones.js#L24-L30).

**Resolución (2026-08-14):** cerrado en dos partes.

- **`aplicarSesionAStats` (el caso original del bug):** ya se había resuelto
  como efecto colateral del fix del bug #2 — los `getDoc` secuenciales pasaron
  a [`Promise.all`](../src/firebase/statsEjercicios.js#L86-L87) (ver la
  sección "Resolución" del bug #2). Esta entrada solo faltaba marcarse como
  cerrada en la tabla resumen.
- **Corrección al texto original:** la nota del bug #2 decía que
  `rebuildStatsEjercicios` y `getStatsEjerciciosConFallback` "seguían con el
  patrón actual". Revisando el código no es así: ninguna de las dos hace
  `getDoc` por ejercicio — ambas llaman una sola vez a
  `getSesionesConResumen` (una query) y después procesan todo en memoria
  antes de escribir con `batch.set`. No hay N round-trips ahí; no necesitaban
  fix.
- **Antipatrón relacionado en `programas.js` (el otro pendiente real):**
  [`eliminarProgramaDefinitivo`](../src/firebase/programas.js#L29-L53) ahora
  agrupa `diasIds` en tandas de 30 y hace una sola query
  `where('diaId', 'in', chunk)` por tanda en vez de una `getDocs` por día —
  mismo patrón que [`enrichSesionesConPrograma`](../src/firebase/sesiones.js#L6-L42).

Test nuevo en [`programas.test.js`](../src/firebase/programas.test.js):
verifica que, con varios días, se hace una sola query `in` para
`ejerciciosDia` en vez de una por día.

### 5. `seriesEsperadas: 0` vuelve un día imposible de entrenar

[src/components/SeleccionarEjercicio.jsx:105-107](../src/components/SeleccionarEjercicio.jsx#L105-L107)

```js
function confirmar() {
  onSeleccionar({ ..., seriesEsperadas: Number(series), repsEsperadas: Number(reps) })
}
```

No hay validación. Los `min="1" max="20"` de los `<input type="number">` son
puramente declarativos: sin un `<form>` que dispare validación nativa, no bloquean
nada. Si el usuario borra el campo, `Number('') === 0` y se guarda
`seriesEsperadas: 0`.

Después, en [src/pages/SesionActiva.jsx:101-108](../src/pages/SesionActiva.jsx#L101-L108):

```js
if (series.length >= ej.seriesEsperadas) {   // 0 >= 0 → true
  restoredEjIdx = i + 1
```

El ejercicio **se saltea entero** al entrar a la sesión. Si es el único del día,
`restoredEjIdx >= ejs.length` (línea 111) navega directo al resumen: el día es
imposible de entrenar y el usuario no ve ningún mensaje de error. Las reglas
tampoco lo bloquean — [firestore.rules:78-79](../firestore.rules#L78-L79) solo
valida `keys().hasOnly(...)`, no tipos ni rangos.

**Fix propuesto:** validar en `confirmar()` (`series >= 1 && reps >= 1`) y agregar
`is int && >= 1` a la regla de `ejerciciosDia`.

**Resolución (2026-08-14):** implementada la mitad cliente del fix propuesto.

- [`confirmar()`](../src/components/SeleccionarEjercicio.jsx#L105-L111) ahora
  valida `series >= 1 && reps >= 1` antes de llamar a `onSeleccionar` —
  mismo criterio y mismo mensaje de error ("Series y reps deben ser mayores
  a 0") que ya usaba [`guardarEdicion()`](../src/pages/EjerciciosDia.jsx#L62-L71)
  para el flujo de edición, que **ya estaba validado** desde antes de esta
  auditoría y no tenía el bug (se verificó al revisar el alcance: el problema
  era exclusivo del alta, no de la edición). Si la validación falla, se
  muestra un error inline (`.picker-error-msg`, mismo patrón visual que
  `.crud-error-msg`) y no se llama a `onSeleccionar`; el error se limpia al
  tocar cualquiera de los dos inputs.
- **No se tocó `firestore.rules`.** La validación `is int && >= 1` en la
  regla de `ejerciciosDia` se dejó fuera de este fix a propósito: agregarla
  al `update` retroactivamente podría bloquear un soft-delete
  (`eliminadoEn`) sobre un documento legacy que ya tenga `seriesEsperadas: 0`
  guardado antes de este fix (el `update` rule valida el documento
  resultante completo, no el diff). Endurecer las reglas de tipo/rango de
  forma coherente en todas las colecciones es el alcance del bug #12
  (todavía abierto), que es el lugar más apropiado para revisar ese
  trade-off con más cuidado — no vale la pena resolverlo a medias acá. El
  bug de UX (la razón real por la que este ítem estaba en 🟠 alta) queda
  cerrado con el fix de cliente: ya no se puede llegar a guardar
  `seriesEsperadas: 0` desde la app.

Tests nuevos en
[`SeleccionarEjercicio.test.jsx`](../src/components/SeleccionarEjercicio.test.jsx):
cubren series vacío, reps vacío, y que el error se limpia al corregir el
valor y confirmar de nuevo.

### 6. Wake lock y audio nunca liberados al salir del Timer, y nunca re-adquiridos

[src/pages/Timer.jsx:16-19](../src/pages/Timer.jsx#L16-L19) —
`wakeLock.liberar()` solo se llama desde `handleTerminar`. No hay
`useEffect(() => () => wakeLock.liberar(), [])`.

Si el usuario toca la BottomNav a mitad del timer, el componente se desmonta:
`useTimer` sí limpia su interval, pero el wake lock y el `<audio loop>` de
[useWakeLock.js:18-26](../src/components/timer/useWakeLock.js#L18-L26) quedan
vivos. Pantalla encendida y audio silencioso en bucle hasta cerrar la app —
drenaje de batería durante todo el entrenamiento.

Además `useWakeLock` no escucha `visibilitychange`. La Wake Lock API **se libera
sola cuando la página pasa a hidden**; al volver nunca se vuelve a pedir, así que
después del primer cambio de app la pantalla se apaga sola por el resto de la
sesión.

**Fix propuesto:** cleanup en `useEffect` al desmontar + re-request en
`document.addEventListener('visibilitychange', ...)` cuando
`document.visibilityState === 'visible'`.

**Resolución (2026-08-14):** implementado el fix propuesto, íntegro dentro de
[`useWakeLock`](../src/components/timer/useWakeLock.js) (único consumidor:
`Timer.jsx`, sin cambios necesarios ahí).

- Nuevo `activoRef` trackea si el caller quiere la pantalla encendida (`true`
  desde `activar()`, `false` desde `liberar()`), independiente de si el
  sentinel de la Wake Lock API sigue vivo o no.
- `useEffect(() => liberar, [liberar])` libera el wake lock y pausa el audio
  al desmontar el hook — cubre el caso de la BottomNav a mitad del timer.
  `liberar()` ya era idempotente (lo cubre el test "llamar liberar() dos
  veces no libera el sentinel dos veces"), así que no importa si
  `handleTerminar` ya lo había llamado antes del desmonte.
- Listener de `visibilitychange`: si vuelve a `visible` y `activoRef.current`
  sigue en `true`, se vuelve a llamar `activar()` — re-pide el sentinel de la
  Wake Lock API (que el browser libera solo al pasar a `hidden`) y, en la
  estrategia de audio (iOS/Safari), reintenta `play()` sobre la misma
  instancia.

Tests nuevos en
[`useWakeLock.test.js`](../src/components/timer/useWakeLock.test.js): cleanup
al desmontar (con y sin wake lock activo), re-adquisición al volver a
`visible` (ambas estrategias), que no reacciona a `hidden`, y que no
re-adquiere si ya se había llamado a `liberar()` antes del cambio de
visibilidad.

### 7. El timer se desincroniza con la pantalla bloqueada

[src/components/timer/useTimer.js:87-103](../src/components/timer/useTimer.js#L87-L103)

```js
intervalRef.current = setInterval(() => {
  const cur = estadoRef.current
  if (!cur.iniciado || cur.pausado) return
  const elapsed = (Date.now() - timestampInicioFaseRef.current - segundosPausadosRef.current) / 1000
  const restantes = Math.max(0, Math.ceil(duracionFase(cur.fase, cur.config) - elapsed))
  if (restantes <= 0) {
    const siguiente = calcularSiguienteFase(cur.fase, cur.setActual, cur.config)
    if (siguiente) iniciarFaseRef.current(siguiente.fase, siguiente.setActual, cur.config)
    return
  }
```

El cálculo de `segundosRestantes` es correcto (se basa en `Date.now()`, no en el
conteo de ticks), pero el **avance de fase es de a una por tick**, y `iniciarFase`
resetea `timestampInicioFaseRef.current = Date.now()` (línea 68).

**Escenario de falla:** HIIT de 40 s trabajo / 20 s descanso × 8 sets. El usuario
bloquea la pantalla en el set 2 y la desbloquea 5 minutos después. El navegador
congeló el interval; al volver, el timer avanza **una sola fase** y arranca los
20 s de descanso desde cero, en vez de estar en el set 7. Encima
`tiempoTotalSegundos` (línea 80) sí cuenta los 5 minutos reales, así que el resumen
final muestra un total que no cuadra con los sets hechos.

**Fix propuesto:** en cada tick, avanzar en bucle mientras el `elapsed` cubra fases
completas, descontando la duración consumida en vez de resetear el timestamp.

**Relacionado (🟢 baja):** no hay beep ni `navigator.vibrate` en los cambios de
fase, lo que vuelve al timer inutilizable como HIIT con la pantalla apagada.

**Resolución (2026-08-14):** implementado el fix propuesto, íntegro dentro de
[`iniciarFase`](../src/components/timer/useTimer.js#L66).

- `iniciarFase` ahora acepta un cuarto parámetro opcional `elapsedInicial`
  (default `0`), que se resta del `Date.now()` usado para fijar
  `timestampInicioFaseRef.current` y del `segundosRestantes` inicial de la
  fase. Con el valor por defecto, `iniciar()` y `saltarIntervalo()` — los
  otros dos callers — quedan con el comportamiento exacto de antes.
- El callback del `setInterval`, al detectar que la fase actual terminó, ya
  no llama a `iniciarFase` con la fase siguiente directo: primero recorre en
  un `while` local (sin tocar estado ni disparar renders) las fases
  intermedias usando `calcularSiguienteFase`/`duracionFase`, descontando la
  duración de cada una del tiempo sobrante (`overflow`), hasta encontrar la
  fase donde realmente cae el tiempo transcurrido. Recién ahí invoca
  `iniciarFaseRef.current(...)` una única vez, con esa fase/set y el
  `overflow` restante como `elapsedInicial`. Como todo el recorrido es
  síncrono y previo al único `setEstadoSync` del tick, no hay fases
  intermedias visibles ni renders de paso.
- El bucle corta explícitamente antes de tratar `'fin'` como una fase con
  duración a descontar, así que un tiempo dormido mayor a la duración total
  del timer aterriza directo en `fin` sin importar cuán grande sea el
  overflow, y sin riesgo de loop infinito ni siquiera con fases de 0
  segundos en la config (la máquina de estados de `calcularSiguienteFase` es
  finita — a lo sumo `2*sets + 3` transiciones — independientemente de las
  duraciones).
- `tiempoTotalSegundos` no requirió cambios: ya se calculaba bien a partir de
  `Date.now() - tiempoTotalInicioRef.current`; el fix hace que la fase/set
  mostrados en `fin` ahora cuadren con ese total, que era el síntoma
  reportado en el escenario de falla original.

Tests nuevos en
[`useTimer.test.js`](../src/components/timer/useTimer.test.js), usando
`vi.setSystemTime(...)` para adelantar el reloj del sistema sin avanzar el
fake-timer clock (simula el congelamiento del navegador) seguido de un único
tick: saltar varias fases completas y aterrizar en la fase/set/segundos
correctos, aterrizar exactamente en `fin` en el límite del timer, aterrizar
en `fin` con un tiempo dormido muy superior al timer completo,
`tiempoTotalSegundos` consistente con `fin` tras el salto, una config con
todas las fases en 0 segundos sin colgarse, y `saltarIntervalo()` sin cambios
de comportamiento.

### 8. Hosting sin ningún header de seguridad

[firebase.json:15-34](../firebase.json#L15-L34) — el bloque `headers` solo define
`Cache-Control`. No hay `Content-Security-Policy`, `X-Frame-Options` /
`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` ni
`Permissions-Policy`.

**Impacto:** la app es embebible en un `<iframe>` de cualquier origen →
clickjacking sobre acciones destructivas que son de un solo tap (eliminar programa,
eliminar sesión). Sin CSP no hay defensa en profundidad si alguna dependencia
introduce un sink de XSS; sin `nosniff` hay MIME sniffing.

**Fix propuesto:** agregar un bloque `{ "source": "**", "headers": [...] }` con al
menos:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com; frame-ancestors 'none'; base-uri 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

Nota: el popup de Google Sign-In requiere `frame-src https://<project>.firebaseapp.com`
si en algún momento se migra a `signInWithRedirect`. Conviene probar la CSP en modo
`Content-Security-Policy-Report-Only` antes de aplicarla.

**Resolución (2026-08-14):** implementado en dos niveles de riesgo separados,
en [`firebase.json`](../firebase.json#L35-L45), en un bloque nuevo con
`"source": "**"` (Firebase Hosting aplica todos los bloques de `headers` que
matcheen un mismo archivo, así que este bloque se suma a los de
`Cache-Control` ya existentes para `sw.js`, `index.html` y `assets/**`, no
los reemplaza).

- **Enforcing desde este mismo deploy** (bajo riesgo de romper algo, se
  aplicaron directo):
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'`
    (el primero por compatibilidad con navegadores viejos, el segundo es el
    reemplazo moderno recomendado) — cierran directamente el vector de
    clickjacking que motivó la severidad 🟠 alta del ítem, porque la app
    nunca necesita embeberse en un `<iframe>` ajeno.
  - `Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()` —
    deshabilita APIs del navegador que la app no usa. Deliberadamente **no**
    incluye `screen-wake-lock` (usada por [`useWakeLock`](../src/components/timer/useWakeLock.js),
    ver bug #6) ni `autoplay`: al no listarlas, retienen su comportamiento
    default del navegador en vez de quedar bloqueadas.
- **`Content-Security-Policy-Report-Only`** con la política completa
  (`default-src 'self'`, `script-src`, `style-src`, `font-src`, `img-src`,
  `connect-src`, `worker-src`, `frame-ancestors`, `base-uri`, `form-action`),
  siguiendo la recomendación de la propia auditoría de no aplicarla en modo
  enforcing sin probarla primero. Se decidió el rollout en dos pasos con el
  usuario porque el deploy de este proyecto va directo a producción en cada
  push a `main` ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)),
  sin ambiente de preview, y porque se detectó un origen externo no
  contemplado en el fix propuesto original: la app usa Firebase Analytics
  ([`src/firebase/analytics.js`](../src/firebase/analytics.js), `getAnalytics(app)`),
  que carga `gtag.js` desde `googletagmanager.com` y reporta a dominios de
  `google-analytics.com`/`analytics.google.com` — de haberse enforced directo
  sin listar esos orígenes, se habría roto analytics (o peor, de haber
  faltado algún dominio de `identitytoolkit`/`firestore`, se habría roto
  login o sync) para usuarios reales sin forma de probarlo antes.
  - **Nota:** no hay `report-uri`/`report-to` configurado (no hay backend
    para recibirlos), así que las violaciones solo son visibles abriendo la
    consola del navegador manualmente. **Próximo paso pendiente, fuera de
    alcance de este fix:** tras deployar, revisar la consola en un uso real
    de la app (login, entrenar una sesión completa, ver Progreso) y recién
    ahí promover `Content-Security-Policy-Report-Only` a
    `Content-Security-Policy` (fusionando con la directiva `frame-ancestors`
    que ya quedó enforcing por separado).
  - `photoURL` (guardado en `usuarios/{uid}` desde el perfil de Google, ver
    `handleFirstLogin` en `auth.js`) se verificó que no se renderiza en
    ningún `<img>` del código actual, así que `img-src` no necesitó incluir
    `googleusercontent.com`.
  - El popup de `signInWithPopup` no requiere `frame-src`: CSP `frame-src`
    solo rige elementos `<iframe>`/`<object>` embebidos en la página, no
    ventanas abiertas con `window.open`. La nota de la auditoría sobre
    `frame-src` sigue aplicando tal cual si en el futuro se migra a
    `signInWithRedirect`.

### 9. Docs soft-deleted que nunca se borran

[src/hooks/useEliminarConUndo.js:33-35](../src/hooks/useEliminarConUndo.js#L33-L35)
+ [src/components/Toast.jsx:118-125](../src/components/Toast.jsx#L118-L125)

```js
duration: 5000,
onTimeout: () => eliminarDefinitivo(item.id),
```

El borrado real vive en un `setTimeout` de 5 s dentro del ToastProvider. Si el
usuario elimina un programa/día/ejercicio y cierra la PWA antes de que expire, el
timeout muere con la pestaña: el doc queda con `eliminadoEn` seteado — invisible en
todas las listas ([programas.js:12](../src/firebase/programas.js#L12),
[dias.js:18](../src/firebase/dias.js#L18),
[ejerciciosDia.js:18](../src/firebase/ejerciciosDia.js#L18)) pero **nunca borrado**,
y sin ninguna UI para recuperarlo. Se acumula basura silenciosa que consume cuota.

Además, borrar un día o programa no limpia las `sesiones` que lo referencian →
`enrichSesionesConPrograma` cae a `'–'` en el historial.

**Fix propuesto:** hacer el borrado definitivo idempotente y ejecutarlo también al
arrancar la app (barrer docs con `eliminadoEn` anterior a N minutos), o usar TTL
policies de Firestore.

**Resolución (2026-08-14):** implementado el camino de "barrer al arrancar la
app" del fix propuesto (no se usaron TTL policies de Firestore: requieren
configuración fuera del repo vía consola/gcloud, y el proyecto no tiene
Cloud Functions habilitadas para complementar la limpieza server-side).

- Nuevo módulo [`limpieza.js`](../src/firebase/limpieza.js) con
  `limpiarEliminadosDefinitivamente(usuarioId)`: consulta `programas`,
  `dias` y `ejerciciosDia` con `where('usuarioId','==',uid).where('eliminadoEn','>',0)`
  (query server-side, cubierta por los índices automáticos de un solo campo,
  sin tocar `firestore.indexes.json` ni `firestore.rules` — `allow read: if
  esElDueno()` ya no restringe por campos), filtra en memoria los que
  vencieron un umbral de 10 minutos (margen generoso sobre los 5s del undo
  del toast) y llama a las funciones de borrado ya existentes
  (`eliminarProgramaDefinitivo`, `eliminarDiaDefinitivo`,
  `eliminarEjercicioDefinitivo`) para cada una, en paralelo. No se
  modificaron esas 3 funciones: ya eran idempotentes por construcción
  (`deleteDoc`/`batch.delete` sobre un doc inexistente es un no-op en
  Firestore, y las de programa/día vuelven a consultar sus hijos por query
  en vez de asumir que existen), así que el barrido tolera sin problema
  correr dos veces sobre el mismo doc o solaparse con un borrado en cascada
  (ej. un día vencido que ya fue borrado como parte de un programa vencido
  procesado en el mismo `Promise.all`).
- Enganchado en [`UserContext.jsx`](../src/context/UserContext.jsx), dentro
  de `onAuthStateChanged`, inmediatamente después de que `handleFirstLogin`
  resuelve: se llama sin `await` (fire-and-forget con `.catch`, mismo patrón
  que las escrituras no bloqueantes del bug #1) para no demorar
  `setLoading(false)` ni el login. Como el `useEffect` que suscribe
  `onAuthStateChanged` corre una sola vez por vida de la SPA, el barrido se
  dispara exactamente "al arrancar la app" para cualquier usuario
  autenticado, sin depender de que visite una página en particular.
- **Bug real encontrado al escribir el test de la query en paralelo:**
  `programasIds.map(eliminarProgramaDefinitivo)` (pasando la función
  directo, sin wrappear) le pasa a cada llamada `(id, index, array)` por el
  comportamiento nativo de `Array.prototype.map` — inofensivo hoy porque
  `eliminarProgramaDefinitivo` solo declara un parámetro y descarta el
  resto, pero es un code smell que se corrigió a `.map(id =>
  eliminarProgramaDefinitivo(id))` en las 3 colecciones, para no depender de
  que la firma de esas funciones nunca cambie.
- **Fuera de alcance, deliberadamente:** no se tocó la limpieza de
  `sesiones` que referencian un día/programa ya borrado
  (`enrichSesionesConPrograma` sigue cayendo a `'–'` en el historial para
  esos casos) — es un problema de denormalización distinto, tocaría la
  estructura de `resumen` de sesiones completadas, y el fix propuesto
  original para este bug no lo incluía, solo lo señalaba como consecuencia
  observada. Queda como seguimiento pendiente.

Tests nuevos en
[`limpieza.test.js`](../src/firebase/limpieza.test.js): docs sin
`eliminadoEn` no aparecen en la query, docs dentro del umbral no se borran,
docs vencidos disparan el borrado correspondiente con su id exacto (el test
que detectó el bug de `.map` de arriba), y las 3 colecciones se consultan
con los filtros esperados.

---

## 🟡 Medios

### 10. El service worker cachea respuestas de Firestore y no se purgan al cerrar sesión

[vite.config.js:88-96](../vite.config.js#L88-L96)

```js
{
  urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*$/,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'firestore-cache',
    networkTimeoutSeconds: 4,
    expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
  },
}
```

Dos problemas en uno:

- **Privacidad:** el canal WebChannel de Firestore usa GET para el backchannel, así
  que cuerpos de respuesta con datos de entrenamiento quedan en Cache Storage, sin
  cifrar, durante 7 días — y **no se purgan al cerrar sesión**
  ([auth.js:16-18](../src/firebase/auth.js#L16-L18) solo hace `signOut`; tampoco se
  limpia el IndexedDB de `persistentLocalCache`). En un dispositivo compartido, el
  siguiente usuario puede leerlos desde DevTools.
- **Funcionamiento:** interponer un cache HTTP sobre `/Listen/channel` y
  `/Write/channel` (long-polling) puede servir un handshake cacheado o cortar a los
  4 s un long-poll legítimo → listeners que no reconectan y datos rancios que el SDK
  cree frescos.

No aporta nada: el soporte offline ya lo da `persistentLocalCache`, que es la vía
correcta.

**Fix propuesto:** eliminar esa entrada de `runtimeCaching`, y en `signOutUser()`
llamar a `clearIndexedDbPersistence(db)` y `caches.delete('firestore-cache')`
después del `signOut`.

**Resolución (2026-08-14):** implementado el fix propuesto, con un matiz de
API de Firestore que la auditoría no explicitaba.

- Eliminada la entrada `runtimeCaching` de Firestore en
  [`vite.config.js`](../vite.config.js) — cierra el problema de
  funcionamiento (el SW ya no interpone un cache HTTP sobre el long-polling
  de `/Listen/channel`/`/Write/channel`); el soporte offline sigue cubierto
  por `persistentLocalCache`, que era la vía correcta.
- [`signOutUser()`](../src/firebase/auth.js#L16) ahora, después de
  `signOut(auth)`: llama a `terminate(db)` seguido de
  `clearIndexedDbPersistence(db)`, borra el bucket `'firestore-cache'` de
  Cache Storage (cubre a usuarios que ya lo tenían poblado antes de este fix,
  aunque la entrada de `runtimeCaching` ya no lo repueble), y termina
  forzando `window.location.href = '/'`.
  - **El `terminate(db)` previo es obligatorio, no opcional:**
    `clearIndexedDbPersistence()` rechaza con `failed-precondition` si el
    cliente de Firestore sigue "corriendo" (que es el caso normal después de
    usar la app), y `terminate()` es el único modo soportado de pararlo. Como
    `terminate()` deja esa instancia de `db` permanentemente inutilizable, y
    `db` es un singleton exportado de `config.js` importado en todos los
    módulos de `firebase/`, la única forma de dejar la app usable de nuevo
    sin reestructurar ese singleton es forzar un reload completo — que es lo
    que hace la línea final. Se verificó que no hay ningún `onSnapshot` en
    todo `src/` (todo el proyecto usa lecturas one-shot con
    `getDoc`/`getDocs`), así que no hay listeners activos que pudieran
    complicar el `terminate()`.
  - **Best-effort, no bloqueante:** la limpieza de Firestore está en un
    `try/catch` que solo loguea — si otra pestaña de la PWA sigue abierta y
    usando la misma persistencia (el proyecto usa
    `persistentMultipleTabManager()`), `clearIndexedDbPersistence` rechaza
    porque detecta esa otra pestaña activa; el logout debe completarse igual
    y el reload final se ejecuta siempre que `signOut(auth)` haya tenido
    éxito.
  - **Cambio de UX aceptado conscientemente:** cerrar sesión ahora hace un
    reload completo del documento en vez de una transición SPA instantánea a
    Login. Es un patrón común en apps que priorizan borrar cache local al
    salir (Gmail, WhatsApp Web), y logout es una acción explícita e
    infrecuente (no forma parte del flujo "celular en mano entre series" que
    `CLAUDE.md` prioriza optimizar), así que el trade-off se consideró
    aceptable sin necesidad de UI adicional.
  - `Home.jsx` mantiene su `navigate('/')` después de `await logout()` sin
    cambios: en producción queda como una llamada redundante e inofensiva
    (el reload real ya está en marcha para cuando esa línea corre), y
    tocarla rompía innecesariamente el test existente de
    `Home.test.jsx` (que mockea `logout()` y verifica la navegación en SPA
    de forma aislada, sin pasar por el `signOutUser` real) sin aportar
    ningún beneficio.

Tests nuevos en [`auth.test.js`](../src/firebase/auth.test.js): `terminate`
y `clearIndexedDbPersistence` se llaman con la instancia de `db`, se borra el
cache `'firestore-cache'`, se fuerza la recarga a `'/'`, un fallo en la
limpieza de Firestore igual completa el logout y recarga, y si `signOut` en
sí falla no se limpia nada ni se recarga (el error se propaga tal cual, sin
dejar al usuario con una recarga que lo devolvería igual de logueado).

### 11. Elegir otro día abandona la sesión en curso con sus registros

[src/pages/Entrenar.jsx:37-57](../src/pages/Entrenar.jsx#L37-L57)

```js
const stored = localStorage.getItem(`sesion_activa_${usuario.id}`)
if (stored) {
  const snap = await getDoc(doc(db, 'sesiones', stored))
  if (snap.exists() && !snap.data().completada && snap.data().diaId === diaId) {
    navigate(`/sesion/${stored}`); return
  }
}
const sesionId = await crearSesion(usuario.id, diaId)
localStorage.setItem(`sesion_activa_${usuario.id}`, sesionId)
```

La comprobación exige que coincida el `diaId`. Si hay una sesión sin terminar de
"Push" y el usuario elige "Pull", se crea una sesión nueva y se **pisa** la clave de
localStorage. La sesión de Push queda `completada: false` para siempre: no sale en
el historial, no sale en el banner de Home, y sus `registros` quedan huérfanos.

**Escenario de falla:** te equivocás de día, volvés atrás, elegís el correcto →
perdiste las series ya cargadas, sin ningún aviso.

**Fix propuesto:** detectar *cualquier* sesión sin completar (no solo la del mismo
`diaId`) y ofrecer "continuar / descartar".

**Resolución (2026-08-14):** implementado el fix propuesto tal cual, con un
modal nuevo en vez de una decisión silenciosa.

- En [`Entrenar.jsx`](../src/pages/Entrenar.jsx), `empezar()` ya no exige que
  `diaId` de la sesión guardada coincida con el elegido para considerarla
  "en curso": cualquier sesión con `completada: false` cuenta. Si coincide el
  día, el comportamiento es idéntico a antes (retoma directo). Si es de
  **otro** día, en vez de pisarla silenciosamente se busca el nombre de ese
  día (`getDoc` sobre `dias/{diaId}`, mismo patrón que ya usa `Home.jsx` para
  el banner de sesión pendiente) y se muestra un modal nuevo
  ("Sesión sin terminar") con dos acciones:
  - **Continuar** → navega directo a la sesión pendiente, sin tocar nada.
  - **Descartar y empezar de nuevo** → llama a la función `eliminarSesion`
    ya existente en [`sesiones.js`](../src/firebase/sesiones.js#L167) (borra
    la sesión y sus `registros` asociados en un solo `batch`, ya existía
    para el flujo de Progreso, no se modificó) y solo si tiene éxito arma la
    sesión nueva del día elegido.
  - Cerrar el modal ("Volver" o back del navegador, vía el `Modal` genérico
    de [`ui.jsx`](../src/components/ui.jsx#L61)) no crea ni borra nada — el
    usuario puede reintentar sin haber perdido la sesión pendiente.
  - `eliminarSesion` sí se espera con `await` (a diferencia del patrón
    fire-and-forget usado para escrituras que no bloquean la UI en otros
    fixes de esta auditoría): es una acción explícita, infrecuente, donde el
    usuario espera una confirmación de que se descartó antes de que se cree
    la nueva sesión, y un fallo debe avisarse en vez de dejar dos sesiones
    sin terminar compitiendo por la misma clave de `localStorage`.
- Clases CSS nuevas con prefijo `entrenar-modal-*` en `src/index.css`
  (título, texto, botones), reutilizando el mismo look de los modales ya
  existentes (`.progreso-modal-titulo`/`.progreso-cancel-btn` en
  `PesoModal.jsx`) pero sin cruzar el prefijo entre páginas, siguiendo la
  convención de `CLAUDE.md`.
- **No probado visualmente en navegador:** el login real de la app usa
  `signInWithPopup` con Google, que no se puede automatizar en este entorno
  headless sin credenciales de usuario. La cobertura viene de los tests
  (`Entrenar.test.jsx`), que sí simulan el click completo de las 3 acciones
  del modal.

Tests nuevos en [`Entrenar.test.jsx`](../src/pages/Entrenar.test.jsx): el
modal aparece con el nombre del día pendiente (y no crea nada de una),
"Continuar" navega sin crear ni borrar, "Volver" cierra el modal sin tocar
nada, "Descartar" borra la sesión vieja y crea la nueva en el orden correcto,
y un fallo al descartar muestra error y no crea la sesión nueva. Se removió
el test viejo que esperaba que un día distinto creara la sesión nueva
directamente (comportamiento que este fix reemplaza a propósito).

### 12. Reglas sin validación de tipo ni tamaño en los campos grandes

- [firestore.rules:85](../firestore.rules#L85) → `soloCambia(['nota','completada','resumen'])`:
  `resumen` es un objeto anidado arbitrario, sin restricción de forma ni tamaño.
- [firestore.rules:42](../firestore.rules#L42) → `stats/global` acepta
  `diasEntrenados` y `volumenPorSesion` como arrays de cualquier tipo y longitud.
- [firestore.rules:48](../firestore.rules#L48) → ídem con `puntos`.
- [firestore.rules:95](../firestore.rules#L95) → `registros`: `pesoUsado`,
  `repsHechas`, `numeroSerie` y `nota` sin `is number`, sin rangos y sin límite de
  longitud.

Contrasta con `historialPeso` ([firestore.rules:34-36](../firestore.rules#L34-L36)),
que sí valida bien: `peso is number && >= 20 && <= 300`.

**Impacto:** el registro es abierto (`signInWithPopup` con Google, sin allowlist),
así que cualquier cuenta puede escribir documentos de hasta 1 MB con contenido
arbitrario en `sesiones.resumen`, `stats` o `registros`, sin límite de cantidad. Es
abuso de almacenamiento y facturación contra el dueño del proyecto — no filtración
de datos ajenos. También puede romper el cliente de la propia víctima si mete tipos
inesperados en `resumen.ejercicios[].series`, que `src/pages/progreso/` consume sin
validar.

**Fix propuesto:** espejar en reglas los caps que ya existen en el cliente
(`MAX_VOLUMEN = 200` en `statsGlobal.js:12`, `MAX_PUNTOS = 150` en
`statsEjercicios.js:15`) y agregar tipos y rangos a `registros`
(`pesoUsado is number && >= 0 && <= 1000`, `repsHechas is number && >= 0 && <= 1000`,
`nota.size() < 500`).

**Resolución (2026-08-15):** implementado en `firestore.rules`, espejando los
caps del cliente donde ya existían y agregando tipos/rangos donde faltaban.

- Nueva función `resumenValido(r)` valida la forma de `sesiones.resumen`
  (`volumenTotal is number && >= 0`, `diaNombre is string && <= 300` chars,
  `ejercicios is list && <= 100`) — solo se evalúa en `update` cuando
  `campoTocado('resumen')`, así que editar solo `nota` en una sesión legacy
  no la revalida contra la forma nueva. No se valida la forma interna de
  cada ejercicio/serie: `rules` no puede iterar listas anidadas.
- `statsEjercicios.puntos` cappeado a `<= 150` (`MAX_PUNTOS`) sin
  condicional en `create`/`update`: ese doc siempre se reescribe completo
  (sin merge) por el cliente, así que `puntos` llega siempre como el array
  final ya cappeado — seguro de validar directo.
- `registros`: en `create`, `pesoUsado`/`repsHechas is number && >= 0 && <=
  1000`, `nota is string && <= 500` chars y `numeroSerie is number && >= 1
  && <= 200`, todos obligatorios. En `update`, cada campo se valida solo si
  `campoTocado(...)`, para no romper ediciones de docs legacy que tengan un
  valor fuera de rango en un campo que ese update no toca.
- `diasEntrenados`/`volumenPorSesion` de `stats/global` quedaron
  deliberadamente **sin cap**: se escriben también vía `arrayUnion()`
  (`agregarSesionAResumenGlobalBlind`), y los field transforms de Firestore
  no son inspeccionables en las reglas al momento de evaluarlas — capearlos
  hubiera arriesgado la misma regresión que tuvo que arreglar un fix
  anterior.
- Se agregaron los 3 índices compuestos (`usuarioId` + `eliminadoEn`) que
  `programas`/`dias`/`ejerciciosDia` necesitan para la query de
  `limpiarEliminadosDefinitivamente` (bug #9) a `firestore.indexes.json`.
- Verificado con 16 casos vía `@firebase/rules-unit-testing` contra el
  emulador: docs legacy fuera de rango, tamaños límite, y una reconfirmación
  de que el fix del bug #5 (`seriesEsperadas: 0`) sigue intacto.

### 13. Eliminar una sesión no es atómico

[src/pages/Progreso.jsx:227-237](../src/pages/Progreso.jsx#L227-L237)

```js
await eliminarSesion(sesion.id)
await removerSesionDeResumenGlobal(usuario.id, {...})
await rebuildStatsEjercicios(usuario.id, sesion.resumen?.ejercicios ?? [])
```

Si falla el paso 2 o 3, la sesión y sus registros ya están borrados pero
`stats/global` sigue contando ese día y ese volumen, y `statsEjercicios` sigue
mostrando un PR de una sesión inexistente — con `pr.sesionId` apuntando a un doc
borrado, así que tocarlo navega a un resumen roto. El `catch` solo muestra un toast:
no hay reintento ni reparación.

**Resolución (2026-08-17):** implementado con el mismo patrón de `writeBatch`
compartido que ya había resuelto el bug #2 análogo
(`completarSesionConAgregados`, ver arriba). No se usó `runTransaction`, por
la misma razón que en los bugs #2 y #3 (no convive bien con el modelo
offline-first del proyecto).

- Nuevo orquestador
  [`eliminarSesionConAgregados`](../src/firebase/eliminarSesion.js) arma un
  único `writeBatch` que agrupa el borrado de `sesiones/{id}` + sus
  `registros` (vía `eliminarSesion`, que ahora acepta un `batch` externo,
  mismo patrón que `completarSesion`), `stats/global` (vía
  `removerSesionDeResumenGlobal`, también con `batch` opcional) y el
  `statsEjercicios/{id}` de cada ejercicio afectado (vía
  `rebuildStatsEjercicios`, ídem). Un solo `commit()`: o se aplican las 3
  colecciones o ninguna.
- **Matiz que no tiene el bug #2:** a diferencia de completar una sesión
  (solo escrituras aditivas), `rebuildStatsEjercicios` **lee** el historial
  completo (`getSesionesConResumen`) para reconstruir los stats desde cero.
  Un `writeBatch` pendiente no es visible para lecturas hasta que se
  comitea, así que si esa lectura corriera después de armar (pero antes de
  comitear) el `batch.delete` de la sesión, seguiría viendo la sesión que se
  está por borrar y la incluiría por error en el rebuild. Se resolvió sin
  depender del orden lectura/escritura: `rebuildStatsEjercicios` ahora
  recibe un parámetro opcional `excluirSesionId` que filtra esa sesión del
  historial en memoria antes de reconstruir, independientemente de si su
  borrado ya se comiteó o no. `removerSesionDeResumenGlobal` no tenía este
  problema — su query de "sesiones del mismo día" ya excluía explícitamente
  por id, así que le alcanzó con aceptar el `batch` opcional sin más
  cambios.
- Las 3 funciones de base (`eliminarSesion`, `removerSesionDeResumenGlobal`,
  `rebuildStatsEjercicios`) mantienen su firma retrocompatible (`batch =
  null`, comitean su propio batch si no reciben uno externo), así que sus
  demás callers (`cancelarSesion`/`descartarYEmpezar` sobre sesiones
  incompletas, y `guardarEdicion()` en `ResumenSesion.jsx` para el flujo de
  edición) siguen funcionando sin cambios.
- `Progreso.jsx` sigue haciendo `await` explícito sobre el borrado dentro de
  su `try/catch` (no fire-and-forget) — mismo criterio que el bug #11 para
  acciones de borrado explícitas e infrecuentes, donde el usuario espera una
  confirmación antes de continuar.

Tests nuevos: [`eliminarSesion.test.js`](../src/firebase/eliminarSesion.test.js)
verifica que los 3 helpers reciben el mismo batch compartido, que se comitea
una sola vez, y que `rebuildStatsEjercicios` recibe `excluirSesionId`. Casos
nuevos también en `sesiones.test.js`, `statsGlobal.test.js` y
`statsEjercicios.test.js` para el batch externo de cada función de base, y en
`statsEjercicios.test.js` un caso específico que reconstruye el PR con dos
sesiones en el historial y confirma que la que se está borrando queda
excluida.

### 14. Frecuencia semanal: omite semanas vacías y cuenta sesiones como días

[src/utils/stats.js:39-65](../src/utils/stats.js#L39-L65)

Dos defectos en la misma función:

1. Agrupa por lunes en un objeto y hace `.slice(-8)`: **las semanas con 0 días
   simplemente no existen en el array**. Si entrenás en enero, parás dos meses y
   volvés en abril, el gráfico muestra "6 ene–12 ene" pegado a "7 abr–13 abr" como
   si fueran consecutivas, sugiriendo una constancia que no existió. La UI lo
   rotula "Frecuencia semanal", lo que refuerza la lectura errónea.
2. `semanas[key].dias += 1` cuenta **una sesión**, no un día distinto. Dos sesiones
   el mismo día suman 2 al contador de "días", y una semana puede llegar a mostrar
   más de 7.

**Fix propuesto:** generar las 8 semanas contiguas hacia atrás desde `lunesHoy`
rellenando con 0, y deduplicar por día (`Set` de epochs) antes de contar.

**Resolución (2026-08-17):** implementado el fix propuesto tal cual, en
[`frecuenciaSemanal`](../src/utils/stats.js#L39-L77).

- Se arma un `Set` de epochs de día (00:00 local) a partir de `sesiones`
  antes de agrupar por semana — dos sesiones el mismo día colapsan a un
  solo epoch, así que ya no pueden sumar más de 1 al contador de "días" de
  esa semana.
- En vez de iterar solo las semanas que tienen datos (`Object.values(...)`),
  ahora se generan las 8 semanas contiguas desde `lunesHoy` hacia atrás con
  un `for` fijo, rellenando con `dias: 0` las que no tengan entradas. El
  resultado pasa de "array de longitud variable, solo semanas con datos" a
  "siempre exactamente 8 semanas, alineadas al calendario real" — una
  semana sin entrenar ya no desaparece, así que dos rachas separadas por un
  parate ya no aparecen pegadas en el gráfico.
- La fórmula de "lunes de una fecha" (`(d.getDay()+6)%7`), que estaba
  duplicada 2 veces dentro de la función, se extrajo a un helper local
  `lunesDeSemana(d)` **dentro de `stats.js`** (no se movió a
  `utils/fechas.js` ni se exportó: no tiene otro consumidor en el repo, y
  no vale la pena promoverla a utilidad compartida solo por esto).
- El epoch de día se calcula con `new Date(d.getFullYear(), d.getMonth(),
  d.getDate()).getTime()`, el mismo patrón que ya usan `epochDia()`
  (`statsGlobal.js`) y el inline de `getStreaksLocal` (`sesiones.js`) — pero
  **sin importarlo de `firebase/`**, porque `stats.js` es explícitamente
  puro (comentario de cabecera del archivo: "sin React ni Firestore"); se
  repite el one-liner localmente en vez de cruzar esa frontera de capas.
- No hizo falta tocar `Progreso.jsx` ni `HistorialTab.jsx`: el shape de
  input/output no cambió (sigue siendo `{ sesiones }` → `[{ semana, dias
  }]`), y cada semana del array de 8 sigue teniendo un label único (`key`
  de React en `HistorialTab.jsx` no colisiona).

Tests en [`Progreso.test.jsx`](../src/pages/Progreso.test.jsx)
(`describe('frecuenciaSemanal', ...)`): se reescribieron todos los que
asumían un array de longitud variable (ahora indexan la semana relevante
dentro de las 8, típicamente `result[7]` para "esta semana"), y se agregaron
2 casos nuevos que antes no tenían cobertura: dos sesiones el mismo día
cuentan como 1 solo día, y una sesión vieja + una actual dejan las semanas
intermedias en `0` en vez de "pegarse".

### 15. Auto-reload sin aviso a mitad de una serie

[src/components/UpdateBanner.jsx:18-20](../src/components/UpdateBanner.jsx#L18-L20)

```js
useEffect(() => {
  if (needRefresh) updateServiceWorker(true)
}, [needRefresh, updateServiceWorker])
```

`updateServiceWorker(true)` recarga la página sin preguntar, y `registration.update()`
corre cada 60 minutos. Si cae mientras el usuario está en `SesionActiva` con peso y
reps tipeados pero sin haber tocado "Completar serie", se pierde lo escrito. El
componente se llama "Banner" pero devuelve `null`: no muestra ningún banner.

**Fix propuesto:** mostrar el banner de verdad y dejar que el usuario decida, o como
mínimo no recargar si `location.pathname` empieza con `/sesion/`.

**Resolución (2026-08-17):** implementada la opción completa del fix
propuesto (dejar la decisión en manos del usuario siempre, no solo en
`/sesion/*`), reutilizando el sistema de toasts ya existente en vez de
construir una UI de banner nueva.

- [`UpdateBanner.jsx`](../src/components/UpdateBanner.jsx) ya no llama
  `updateServiceWorker(true)` apenas `needRefresh` pasa a `true`. En cambio
  muestra un toast vía `useToast()` (el mismo `ToastProvider` que ya envuelve
  `<App/>` desde `main.jsx`) con `duration: 0` — no se autodescarta — y una
  `action: { label: 'Actualizar', onClick: () => updateServiceWorker(true) }`,
  mismo patrón que ya usa el "Deshacer" de
  [`useEliminarConUndo.js`](../src/hooks/useEliminarConUndo.js). El toast
  también trae su propio botón de cierre (X) ya existente en
  [`Toast.jsx`](../src/components/Toast.jsx): cerrarlo sin actualizar queda
  como opción de primera clase, no como efecto colateral.
- Se prefirió esta opción sobre el mínimo (bloquear solo en `/sesion/*`)
  porque el mismo riesgo de perder estado sin guardar no es exclusivo de esa
  ruta (un formulario a medio completar en `Progreso`, un timer corriendo en
  `Timer.jsx`, etc.) — dejar la decisión siempre en manos del usuario cierra
  el problema de raíz sin depender de mantener una lista de rutas
  "sensibles" sincronizada a mano.
- El efecto depende de `show`/`dismiss` (ambos `useCallback` con deps `[]`
  dentro de `ToastProvider`, por lo tanto estables entre renders) y no del
  objeto `{ show, dismiss }` completo que devuelve `useToast()` (ese sí
  cambia de referencia en cada render de `ToastProvider`) — evita que
  `react-hooks/exhaustive-deps` fuerce una dependencia inestable que
  reabriría/cerraría el toast en cada render ajeno a `needRefresh`.
- No se tocó el chequeo periódico (`registration.update()` cada 60 min) ni
  su cleanup de `setInterval` — sin cambios en ese flujo.

Tests en [`UpdateBanner.test.jsx`](../src/components/UpdateBanner.test.jsx):
se reescribió el caso que esperaba el auto-reload por uno que verifica que
se muestra el toast (`duration: 0`, `action.label: 'Actualizar'`) sin llamar
a `updateServiceWorker`, se agregó un caso nuevo que invoca el `onClick` de
la acción capturada y confirma que ahí sí se actualiza, y se ajustó el caso
de "sin versión nueva" para además afirmar que no se muestra ningún toast.

### 16. Backfillea el resumen pero no los agregados

[src/pages/ResumenSesion.jsx:106-108](../src/pages/ResumenSesion.jsx#L106-L108)

```js
} else if (!sesionData.resumen && regs.length > 0) {
  await backfillResumen(sesionId, buildResumen(regs, diaNombreVal))
}
```

Se repara el doc de la sesión pero **no** se llama a
`aplicarSesionAResumenGlobal` ni a `aplicarSesionAStats`. Esa sesión queda visible
en el historial pero ausente del volumen, del calendario, de las rachas y de los
PR — y como los agregados ya existen, ningún fallback la va a recuperar (ver #2).

**Resolución (2026-08-17):** el bloque de backfill en
[`ResumenSesion.jsx`](../src/pages/ResumenSesion.jsx) ahora repara también
los dos agregados, no solo el doc de la sesión.

- Además de `backfillResumen`, dispara `aplicarSesionAResumenGlobal` (para
  `stats/global`: volumen, calendario, rachas) y `aplicarSesionAStats` (para
  `statsEjercicios`: PR y última vez) con el mismo `resumen` recién
  construido. Se agrupan en un `Promise.all` para tener un solo punto de
  reporte de error.
- **No se usó el `writeBatch` atómico** de `completarSesionConAgregados`
  (bug #2), a propósito: este es un camino de *reparación* de una sesión ya
  completada, no el alta original. Las 3 escrituras son idempotentes por
  `sesionId` (`aplicarSesionAResumenGlobal` reemplaza la entrada existente,
  `mergeSesionEnStats` filtra el punto previo del mismo `sesionId`), así que
  una aplicación parcial se corrige sola en la próxima visita al resumen —
  no hace falta la garantía de todo-o-nada, y evitarla mantiene el cambio
  chico.
- Se respeta el patrón no-bloqueante del bug #1: no se `await`ea nada antes
  de destrabar la UI; un fallo tardío se reporta con un toast
  (`variant: 'warning'`) en vez de un error que tape la página.
- Se mantiene el guard `usuario?.id` (igual que la rama de arriba): sin
  usuario cargado solo se repara el doc de la sesión.

Tests nuevos en [`ResumenSesion.test.jsx`](../src/pages/ResumenSesion.test.jsx)
(`describe('ResumenSesion — backfill de una sesión completada sin resumen')`):
una sesión completada sin `resumen` y con registros llama a las 3 funciones
con el `sesionId`/volumen correctos, y un fallo en cualquiera de ellas
muestra el toast de warning sin bloquear el render.

### 17. Errores tragados en silencio y promesas flotantes

- [src/pages/EjerciciosDia.jsx:52](../src/pages/EjerciciosDia.jsx#L52) —
  `catch (e) { console.error(e) }`: si falla agregar el ejercicio no hay toast, y el
  `cargar()` siguiente muestra la lista sin él. El usuario cree que se agregó.
- [src/pages/EjerciciosDia.jsx:116-118](../src/pages/EjerciciosDia.jsx#L116-L118) —
  `onReorder={async (r) => { setEjercicios(r); await reordenarEjercicios(...) }}` sin
  `try/catch`: si el batch falla, el orden local diverge del de Firestore y salta un
  `unhandledrejection`. Mismo patrón en `Dias.jsx` y `Programas.jsx`.
- [src/pages/Progreso.jsx:118](../src/pages/Progreso.jsx#L118) — `cargarPeso` traga
  el error y setea `pesoCargado: true`, así que se muestra el empty state "Sin
  registros de peso" cuando en realidad la query falló.

**Resolución (2026-08-17):** los 3 puntos resueltos con el patrón de toast de
error que ya usaba el resto de la app (`useToast()` + `variant: 'error'`, como
en `Progreso.jsx`/`SesionActiva.jsx`/`Entrenar.jsx`/`Home.jsx`). No se
introdujo ninguna abstracción nueva.

- **Agregar ejercicio** ([`EjerciciosDia.jsx`](../src/pages/EjerciciosDia.jsx)):
  el `catch (e) { console.error(e) }` ahora muestra
  "No se pudo agregar el ejercicio. Intentá de nuevo.". El `cargar()` posterior
  se mantiene: refleja el estado real de Firestore, y ahora el usuario entiende
  por qué el ejercicio no aparece.
- **`onReorder` sin `try/catch`** (`EjerciciosDia.jsx`, `Dias.jsx`,
  `Programas.jsx` — el mismo patrón en los 3): se agregó
  **optimistic update con rollback**: se guarda el array previo antes del
  `setEstado(reordenados)`, y si la escritura falla se restaura y se muestra
  "No se pudo guardar el orden. Intentá de nuevo.". Cierra las dos mitades del
  problema: ya no hay `unhandledrejection`, y el orden local deja de divergir
  del de Firestore.
  - Se implementó **inline en cada página** en vez de extraer un hook
    compartido: son 3 usos independientes de ~8 líneas cada uno, y un
    `useReorderConRollback` genérico agregaría indirección sin eliminar
    duplicación real (cada uno tiene su propio estado y su propia función de
    escritura).
  - No existía ningún patrón de rollback previo en el repo para copiar (lo
    más cercano, `useEliminarConUndo`, es un undo manual del usuario, no una
    reversión automática ante un fallo de escritura).
- **`cargarPeso`** ([`Progreso.jsx`](../src/pages/Progreso.jsx)): el catch
  ahora muestra "No se pudieron cargar los registros de peso.". Se dejó
  `setPesoCargado(true)` como estaba (no se rediseñó la máquina de estados):
  visualmente sigue cayendo al empty state, pero el fallo ya no es silencioso.

Tests nuevos: `EjerciciosDia.test.jsx` (fallo al agregar → toast; fallo al
reordenar → rollback del orden + toast; reorden exitoso → sin toast de error),
`Dias.test.jsx` y `Programas.test.jsx` (rollback + toast), y
`Progreso.render.test.jsx` (fallo de `getHistorialPeso` → toast). Los 3
archivos de páginas con DnD mockean `DnDList` exponiendo `onReorder` como un
botón — simular el drag real de `@dnd-kit` en jsdom no aporta nada, lo que se
testea es el manejo del fallo de escritura. Se verificó que el test de
rollback efectivamente falla si se quita la línea que restaura el estado.

### 18. Dependencias: 20 vulnerabilidades

`npm audit` → **1 crítica, 9 altas, 9 moderadas, 1 baja**.

| Paquete | Sev. | Vía | Nota |
|---|---|---|---|
| `websocket-driver` ≤0.7.4 | crítica | `firebase` → `@firebase/database` → `faye-websocket` | Prod, pero la app no usa Realtime Database y el build de browser usa `WebSocket` nativo → explotabilidad real ~nula |
| `react-router` 7.15.1 | alta | vía `react-router-dom` | XSS por protocolo y open redirect por backslash. La app solo navega a rutas literales, pero conviene actualizar |
| `undici`, `protobufjs`, `form-data`, `fast-uri`, `uuid`, `gaxios`, `google-gax`, `retry-request`, `teeny-request`, `@google-cloud/*` | alta/moderada | `firebase-admin` (dev) | Solo afectan a `scripts/` corriendo local con service account |
| `vite` 8.0.12, `postcss`, `nanoid`, `@babel/core`, `brace-expansion` | alta/moderada | dev/build | No llegan al bundle de producción |

**Fix propuesto:** `npm audit fix` resuelve `react-router`, `vite`, `postcss`,
`nanoid`, `brace-expansion`, `fast-uri` y `form-data` sin breaking changes.
`firebase-admin@14` es un major y requiere revisión manual.

---

## 🟢 Bajos

### 19. Colisión y drift de `statsDocId` para ejercicios custom

[src/firebase/statsEjercicios.js:20-26](../src/firebase/statsEjercicios.js#L20-L26).
El id se deriva del slug del nombre, pero `esMismoEjercicio`
([sesiones.js:101-104](../src/firebase/sesiones.js#L101-L104)) compara el `nombre`
crudo. Consecuencias:

1. `"Sentadilla búlgara"` y `"sentadilla bulgara"` slugifican al **mismo doc** pero
   son ejercicios distintos para `esMismoEjercicio` → se mezclan los PR.
2. Renombrar un ejercicio custom crea un doc nuevo y **abandona el viejo**, que
   sigue apareciendo en el selector de Progreso como un ejercicio fantasma.
3. `statsDocId({ nombre: '⚡' })` → slug vacío → id `n_`, compartido por todos los
   nombres sin caracteres ASCII.

### 20. Ventana de día de ±1 h en cambios de horario

[src/firebase/statsGlobal.js:94-95](../src/firebase/statsGlobal.js#L94-L95) —
`const fin = new Date(e + 86400000)` asume días de 24 h exactas, pero `e` es
medianoche **local**. En una transición de DST el día dura 23 o 25 h, así que
`removerSesionDeResumenGlobal` puede no ver una sesión del mismo día (y borrar el
día del calendario indebidamente) o ver una del día siguiente. Uruguay no usa DST
hoy, así que es latente. **Fix:** `new Date(y, m, d + 1)`.

### 21. Código muerto con tests que dan falsa cobertura

Estas funciones exportadas no tienen ningún consumidor fuera de su propio archivo y
sus tests (todo Progreso migró a los agregados): `getVolumenPorSesionLocal`,
`getEjerciciosUsadosConGrupoLocal`, `getRegistrosPorEjercicioLocal`,
`getStreaksLocal`, `getFechasSesiones` (`sesiones.js:107-158`),
`getUltimaVezEjercicioLocal` (`registros.js:6-15`) y `buildResumenGlobal`
(`statsGlobal.js:23-42`, solo lo usa el fallback). Parte de los 347 tests verdes
cubre código que ya nadie ejecuta.

### 22. `localStorage` contradice la regla del proyecto

`CLAUDE.md` dice "No usar `localStorage` para nada — todo el estado persistente va a
Firestore", pero hay 16 usos en `SesionActiva.jsx`, `Entrenar.jsx`, `Home.jsx` y
`ResumenSesion.jsx` (puntero de sesión activa, cache del calendario, flag de
onboarding). Conviene actualizar la regla o el código: hoy el flag de onboarding y
el puntero de sesión activa **no sincronizan entre dispositivos**, y el cache del
calendario (`Home.jsx:87`) puede quedar desfasado del agregado real.

### 23. Accesibilidad

Los tap targets están bien (44×44 consistente en los steppers) y los `inputMode`
numéricos están donde importa (`SerieForm.jsx:28,39`, `ResumenSesion.jsx:348,361`).
Lo que falta:

- [src/pages/progreso/HistorialTab.jsx:57](../src/pages/progreso/HistorialTab.jsx#L57) —
  `<div className="progreso-sesion-info" onClick={...}>` que navega al resumen: no
  es focusable ni activable por teclado.
- [src/components/ui.jsx:35](../src/components/ui.jsx#L35) — breadcrumbs como
  `<span onClick>` sin `role="button"` ni `tabIndex`.
- [src/components/Calendario.jsx:134-138](../src/components/Calendario.jsx#L134-L138) —
  celdas `motion.div` con `aria-label` pero sin `role`; un `aria-label` sobre un div
  genérico suele ser ignorado por los lectores de pantalla.
- [src/pages/sesion-activa/SerieForm.jsx:32](../src/pages/sesion-activa/SerieForm.jsx#L32) —
  el atajo "↳ Última vez: Xkg" es un `<p onClick>`.
- [src/pages/progreso/PesoModal.jsx:12](../src/pages/progreso/PesoModal.jsx#L12) —
  `type="number"` sin `inputMode="decimal"`: escribir `78,5` con coma no funciona y
  el mensaje que aparece ("Ingresá un peso entre 20 y 300 kg") confunde.

### 24. Reglas de Firestore: detalles menores

- **`create` usa `hasOnly` sin `hasAll`** ([firestore.rules:63,71,79,87,95](../firestore.rules#L63)):
  `hasOnly` acepta subconjuntos, así que se puede crear `programas/{id}` con solo
  `{usuarioId}`, sin `nombre` ni `orden` → `a.orden - b.orden` da `NaN` y rompe el
  render de la propia UI. **Fix:** agregar `hasAll([...])` en paralelo.
- **FKs sin validar dueño** ([firestore.rules:71,79,87,95](../firestore.rules#L71)):
  se puede crear un `dias` propio apuntando al `programaId` de otro usuario. No
  permite leer nada ajeno (todas las reglas de read y todas las queries filtran por
  `usuarioId`), así que solo genera basura en el propio árbol.
- **Límite de 5 presets solo en el cliente**
  ([timerPresets.js:14-15](../src/firebase/timerPresets.js#L14-L15)): bypasseable
  con el SDK directo. Impacto cosmético.
- **`email` auto-declarado** ([firestore.rules:26,28](../firestore.rules#L26)): no
  se compara contra `request.auth.token.email`, y
  `scripts/reporteActividad.js:135-136` prefiere el valor de Firestore sobre el de
  Auth (`perfilFs?.email ?? perfilAuth?.email`). Un usuario puede mostrar un email
  falso en el reporte interno. El HTML se escapa, así que no hay inyección — solo
  confusión de identidad. **Fix:** invertir la precedencia en el script.

### 25. UID real hardcodeado en un repo público

`scripts/migrarSesiones.js:25` → `const FERNANDO_UID = 'JkLFCW4UQrSuB0NiK8k6BTME1qM2'`.
No es un secreto (las reglas no permiten leer los datos de ese usuario), pero es un
identificador de usuario real en un repositorio público. Conviene pasarlo por
`argv`.

### 26. Restringir la API key de Firebase

La API key en el bundle es esperada y no es un secreto, pero conviene restringirla
en la GCP Console por HTTP referrer (`reps-io.web.app`) para limitar el abuso de
cuota de Identity Toolkit desde otros orígenes.

**Nota operativa:** `scripts/serviceAccount.json` existe en el working dir (2,4 KB,
clave privada de Admin SDK con bypass total de las reglas). Está correctamente
gitignorado y nunca fue commiteado — se señala solo porque es el activo de mayor
valor del repo y vive sin cifrar en disco.

---

## Apéndice — verificado y correcto

Esto se auditó y **no** tiene problemas. Se documenta para no volver a revisarlo:

**Reglas de Firestore**
- `ejerciciosCatalogo` es de solo lectura ([firestore.rules:98-101](../firestore.rules#L98-L101),
  `allow write: if false`). No existe el vector de envenenamiento del catálogo
  global.
- No hay `match /{document=**}`, ni `allow read/write: if true`, ni ninguna
  colección sin filtro de dueño.
- `usuarioId` no se puede modificar: doble defensa con `noCambiaDueno()`
  ([:13-15](../firestore.rules#L13-L15)) y con las listas de `affectedKeys`, que no
  lo incluyen. No se pueden robar ni donar documentos.
- Las 4 subcolecciones de `usuarios/{uid}` exigen `request.auth.uid == userId` en
  read, create, update y delete.
- `delete` está cubierto en todas las colecciones, siempre por `esElDueno()`.
- Falsificar los propios `stats` no tiene impacto: solo son legibles por su dueño y
  no hay leaderboard ni lógica cross-user.

**Credenciales**
- `git log --all --diff-filter=A` no muestra ningún `.env*` ni `serviceAccount.json`
  añadido jamás; `git ls-files` tampoco los lista hoy.
- `.gitignore` cubre `.env`, `.env.local`, `scripts/serviceAccount.json` y
  `scripts/reportes/` (que contiene PII).
- `src/firebase/config.js` usa exclusivamente `import.meta.env.VITE_*`; CI usa
  GitHub Secrets. Cero claves hardcodeadas en `src/` o `scripts/`.

**Aplicación**
- Cero ocurrencias de `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`
  o `document.write` en todo `src/`. El único `<a href>` externo es constante y
  lleva `rel="noopener noreferrer"`. El HTML del reporte admin escapa todo.
- `PrivateRoute` ([App.jsx:23-27](../src/App.jsx#L23-L27)) devuelve `null` mientras
  carga y redirige a `/` si no hay usuario; `/` (Login) es la única ruta pública y
  no muestra datos.
- Todas las queries filtran por `usuarioId`, y los efectos guardan con
  `if (!usuario?.id) return`. No se encontró ninguna race con `usuarioId` undefined.
- Los ~35 `console.error` solo vuelcan objetos `Error`: ninguno imprime tokens, uid
  ni datos de usuario.
- El rewrite SPA de `firebase.json` y `robots.txt` con `Allow: /` son correctos:
  todas las rutas con datos están detrás de `PrivateRoute` y solo existen del lado
  del cliente.
