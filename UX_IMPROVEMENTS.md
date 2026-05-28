# UX_IMPROVEMENTS.md — Plan de UX para reps.io

> Tercer documento de ejecución. **Orden de ejecución de los tres planes:**
> 1. `BUGS_OPTIMIZATION.md` (fixes críticos, base sana)
> 2. `UI_IMPROVEMENTS.md` (sistema visual)
> 3. `UX_IMPROVEMENTS.md` ← este (flujos, feedback, fricción)
>
> **Asume que los dos anteriores ya están ejecutados.** Hace referencia a clases como `.btn-primary`, `.input`, `.card-elevated` y a componentes nuevos como `<ErrorState />` que sólo existen tras ejecutar el UI plan.

**Foco del documento:** sacar fricción del uso diario, sumar feedback inmediato a cada acción, hacer accionables los estados vacíos y de error, y dar personalidad al copy. Pensado para una app que se usa **mid-entrenamiento, con manos sudadas, a una sola mano**.

**Prioridad:** 🔴 crítico para el flujo diario · 🟠 alto · 🟡 medio · 🟢 nice-to-have.

---

## 0. Plan de ejecución (orden sugerido)

1. **Sección 1** — Toast/feedback system (base para todo lo demás).
2. **Sección 2** — Undo destructivo + confirmaciones.
3. **Sección 3** — Empty states accionables.
4. **Sección 4** — Inputs mobile-first (inputMode, autofocus, validación inline).
5. **Sección 5** — SesionActiva: reducir fricción mid-entrenamiento.
6. **Sección 6** — RestTimer configurable.
7. **Sección 7** — Smart defaults y "última vez".
8. **Sección 8** — Historial filtrable + detalle de sesión.
9. **Sección 9** — Onboarding extendido y tour de features.
10. **Sección 10** — Copy y personalidad.
11. **Sección 11** — Accesibilidad de flujo (keyboard, focus).

Commit por sección (`feat(ux): toast system`, `feat(ux): undo on delete`, etc).

---

## 1. 🔴 Sistema de Toasts / feedback global

Hoy la app no tiene toasts. Acciones como "programa creado", "sesión guardada", "error de red" pasan en silencio o quedan resueltas sólo por el cambio de estado en pantalla.

### Crear `src/components/Toast.jsx` + hook `useToast`

```jsx
import { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((toast) => {
    const id = crypto.randomUUID()
    setToasts(t => [...t, { id, duration: 3000, variant: 'success', ...toast }])
    if (toast.duration !== 0) {
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), toast.duration ?? 3000)
    }
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  return (
    <ToastCtx.Provider value={{ show, dismiss }}>
      {children}
      <div style={{ position: 'fixed', bottom: 80, left: 0, right: 0, zIndex: 100, pointerEvents: 'none', padding: '0 16px' }}>
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              style={{ pointerEvents: 'auto', marginBottom: 8, /* card-elevated styles */ }}
            >
              {/* icono según variant, mensaje, acción opcional, botón X */}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
```

Envolver el `<App />` con `<ToastProvider>` en `src/main.jsx`.

### API esperada

```js
const { show, dismiss } = useToast()
show({ message: 'Programa creado' })                                // success default
show({ variant: 'error', message: 'No se pudo guardar' })
show({ variant: 'info', message: 'Sin conexión, guardando local' })
show({                                                              // con acción (undo)
  message: 'Programa eliminado',
  action: { label: 'Deshacer', onClick: () => restaurar() },
  duration: 5000,
})
```

### Dónde aplicar (post-creación)
- `Programas.jsx` — crear, editar, eliminar
- `Dias.jsx` — crear, editar, eliminar
- `EjerciciosDia.jsx` — agregar, eliminar
- `SesionActiva.jsx` — guardar serie, corregir serie anterior (los `pendingEdits` que confirmaron sin feedback hoy)
- `ResumenSesion.jsx` — guardar nota
- Cualquier `try { ... } catch (e) { console.error }` que tenga `<ErrorState />` además debería emitir un toast de error contextual.

### Checklist
- [ ] `ToastProvider` + `useToast` creados
- [ ] Wrapper en `main.jsx`
- [ ] Toasts integrados en flujos de programas / días / ejercicios
- [ ] Toasts integrados en SesionActiva
- [ ] Tipos visuales: success (verde), error (rojo), info (azul), warning (naranja)

---

## 2. 🔴 Undo en acciones destructivas

Hoy, borrar un programa elimina **6+ días con 8+ ejercicios cada uno + todos los registros**. Sin red de seguridad.

### Patrón: soft-delete con toast de undo (5s)

Para `eliminarPrograma`:

1. En vez de borrar inmediato, marcar `eliminadoEn: Date.now()` en el doc.
2. Mostrar toast con acción "Deshacer" durante 5s.
3. Si el usuario toca Deshacer → `updateDoc(programa, { eliminadoEn: deleteField() })`.
4. Si pasan los 5s sin acción → ejecutar `eliminarPrograma` real (la versión batched del bug plan).
5. `getProgramas` filtra `!eliminadoEn`.

```jsx
async function handleEliminar(programa) {
  await marcarParaEliminar(programa.id)         // soft delete
  setProgramas(prev => prev.filter(p => p.id !== programa.id))
  const toastId = show({
    message: `"${programa.nombre}" eliminado`,
    action: {
      label: 'Deshacer',
      onClick: async () => {
        await desmarcarParaEliminar(programa.id)
        recargar()
        dismiss(toastId)
      },
    },
    duration: 5000,
    onTimeout: () => eliminarPrograma(programa.id),  // hard delete
  })
}
```

> Agregar `onTimeout` callback al ToastProvider de la Sección 1.

### Confirmación pesada sólo cuando no hay undo posible
Para acciones donde no se puede ofrecer undo razonablemente (e.g. cambiar usuario, cerrar sesión activa con series guardadas), mantener `<ConfirmDialog />`.

### Aplicar a
- 🔴 `Programas.jsx` — eliminar programa
- 🔴 `Dias.jsx` — eliminar día
- 🟠 `EjerciciosDia.jsx` — eliminar ejercicio
- 🟡 `SesionActiva.jsx` — la edición de serie anterior debería poder revertirse antes de guardar
- 🟡 `ResumenSesion.jsx` — eliminar/editar registro tras terminar

### Checklist
- [ ] `marcarParaEliminar` / `desmarcarParaEliminar` en `programas.js`, `dias.js`, `ejerciciosDia.js`
- [ ] `getProgramas` / `getDias` / `getEjerciciosDia` filtran `eliminadoEn`
- [ ] Toast con acción + onTimeout que hace el hard delete batched
- [ ] Confirmación dura sólo en acciones sin undo posible

---

## 3. 🟠 Empty states accionables

Hoy, cuando un usuario nuevo entra:
- `Programas`: ¿qué ve? Probablemente lista vacía sin CTA evidente más allá del "+" del header.
- `Entrenar`: si no tiene programas, queda atascado.

### Regla: cada empty state debe responder "¿qué hago ahora?"

Usar `<EmptyState />` (ya existe en `ui.jsx`, mejorado en UI plan) con CTA primario claro y, cuando aplique, secundario.

### Paginas a revisar

#### `src/pages/Programas.jsx` — sin programas
- Icono: dumbbell o ListChecks
- Título: "Todavía no tenés programas"
- Mensaje: "Un programa es una rutina (ej. PPL, Full Body). Tiene días con ejercicios."
- CTA primario: "Crear mi primer programa" → abre modal
- CTA secundario (opcional): "Ver ejemplo" → muestra modal informativo con captura

#### `src/pages/Entrenar.jsx` — sin programas
- Si `programas.length === 0`: NO mostrar el selector vacío. Mostrar empty state que redirija a Programas:
- Título: "Necesitás un programa primero"
- CTA: "Crear programa" → `navigate('/programas')`

#### `src/pages/Entrenar.jsx` — programa sin días
- "Este programa todavía no tiene días"
- CTA: "Agregar día" → `navigate(`/programas/${id}`)`

#### `src/pages/Dias.jsx` — programa sin días
- "Sin días por ahora"
- CTA: "Agregar día"

#### `src/pages/EjerciciosDia.jsx` — día sin ejercicios
- "Sin ejercicios"
- CTA: "Agregar ejercicio" → abre `<SeleccionarEjercicio />`

#### `src/pages/Progreso.jsx` — sin sesiones completadas
- Por tab:
  - **Historial**: "Todavía no completaste ninguna sesión" + CTA "Empezar entrenamiento" → `/entrenar`
  - **Gráfico**: "Necesitás al menos 2 sesiones para ver progreso" + indicador de cuántas tenés
  - **Volumen**: igual
  - **Rachas**: "Sin rachas todavía" (no requiere CTA, es self-evident)
  - **Peso**: "Registrá tu peso para ver evolución" + input inline rápido

#### `src/pages/SesionActiva.jsx` — ejercicio sin "última vez"
La card "Última vez" hoy aparece vacía o se oculta. Mejor: mostrar "Primera vez con este ejercicio 🎉 — buscá un peso cómodo y vamos viendo".

### Checklist
- [ ] Programas: empty con CTA + ejemplo
- [ ] Entrenar: redirige a Programas si vacío
- [ ] Dias/EjerciciosDia: empty con CTA contextual
- [ ] Progreso: empty distinto por cada tab
- [ ] SesionActiva: mensaje para primera vez con un ejercicio

---

## 4. 🟠 Inputs mobile-first

### `inputMode` correcto en todos los inputs numéricos

- **Peso (kg):** `inputMode="decimal"` (permite coma/punto)
- **Reps:** `inputMode="numeric"` `pattern="[0-9]*"`
- **PIN:** `inputMode="numeric"` `pattern="\d*"` + `autoComplete="one-time-code"` (saca el "passwords manager" de iOS)
- **Peso corporal (Onboarding, Progreso → Peso):** `inputMode="decimal"`

Locations:
- `src/pages/SesionActiva.jsx` — inputs de peso y reps
- `src/pages/ResumenSesion.jsx` — inputs de edición
- `src/pages/Login.jsx` — PIN
- `src/components/Onboarding.jsx:73` (hoy `type="number"` está OK pero suma `inputMode="decimal"`)
- `src/components/SeleccionarEjercicio.jsx` — búsqueda → `inputMode="search"`

### Autofocus contextual

- Al abrir Modal de "Crear programa" → focus en el input.
- Al abrir `<SeleccionarEjercicio />` → focus en el input de búsqueda (sólo desktop; en mobile abrir teclado al instante es invasivo, mantener tap manual).
- En SesionActiva, al avanzar a nueva serie → focus automático en peso.
- Detectar mobile: `if (!matchMedia('(pointer: coarse)').matches) input.focus()`.

### Validación inline (no bloqueante)

Hoy, peso=0 o reps=0 se aceptan silenciosamente. Sumar:
- Validación visual al perder foco: si `peso <= 0`, borde rojo y caption "Peso debe ser mayor a 0".
- Mantener el botón "Guardar serie" activo (no bloquear), pero al click mostrar toast de error si la validación falla. Razón: no frustrar al usuario que está tipeando.

```jsx
const [pesoError, setPesoError] = useState('')
<input
  className={`input num ${pesoError ? 'input-error' : ''}`}
  inputMode="decimal"
  onBlur={() => setPesoError(peso <= 0 ? 'Ingresá un peso válido' : '')}
/>
{pesoError && <span className="caption" style={{ color: 'var(--danger)' }}>{pesoError}</span>}
```

Agregar `.input-error { border-color: var(--danger); }` al CSS.

### Botones "step" para peso (mobile)

Mientras tipear un decimal en mobile es fricción. Sumar +2.5kg / -2.5kg / +5kg como atajos:

```jsx
<div style={{ display: 'flex', gap: 6 }}>
  <button className="btn btn-ghost" onClick={() => setPeso(p => Math.max(0, p - 2.5))}>−2.5</button>
  <button className="btn btn-ghost" onClick={() => setPeso(p => Math.max(0, p - 5))}>−5</button>
  <input className="input num" .../>
  <button className="btn btn-ghost" onClick={() => setPeso(p => p + 2.5)}>+2.5</button>
  <button className="btn btn-ghost" onClick={() => setPeso(p => p + 5)}>+5</button>
</div>
```

Mismo para reps con +1 / -1.

### Checklist
- [ ] inputMode correcto en todos los numéricos
- [ ] Autofocus contextual (desktop sí, mobile no)
- [ ] Validación inline no-bloqueante con borde rojo + caption
- [ ] Stepper buttons en SesionActiva (peso ±2.5/±5, reps ±1)

---

## 5. 🔴 SesionActiva — reducir fricción mid-entrenamiento

Ésta es la pantalla más usada de la app. Cada tap extra duele.

### A — Agregar serie extra (sin contar como "más de lo planeado")
Hoy las series son fijas por `seriesEsperadas`. En la práctica un usuario muchas veces hace 4 cuando programó 3. Sumar botón "+ serie extra" debajo de la última serie, que agrega una serie ad-hoc al `ejercicioDia` sin modificar `seriesEsperadas`.

### B — Saltar ejercicio (skip)
A veces un ejercicio no se puede hacer (máquina ocupada). Botón secundario "Saltar ejercicio →" que marca todos los registros pendientes de ese ejercicio como `saltado: true` y avanza al próximo. En `ResumenSesion` aparece como "Saltado" con badge gris.

### C — Reordenar ejercicios mid-sesión
Hoy el orden es fijo por `orden` del `ejercicioDia`. Sumar botón "Cambiar orden" arriba a la derecha del header de SesionActiva que abre un modal con drag handle (reuso `DnDList.jsx` existente) para reordenar los ejercicios pendientes. **No reescribe `orden` en Firestore** (eso sería un cambio permanente), sólo guarda en estado local de la sesión.

### D — Atajo a "anterior serie de este ejercicio"
Hoy hay botón "← Corregir serie anterior" que cubre la **última** serie. Sumar: en la card de "última vez" (sesión pasada), tap en cualquier serie histórica abre un sheet con detalle: peso, reps, nota, fecha. Para que el usuario decida qué peso usar comparando contra sí mismo.

### E — Vista de "sesión completa" antes de finalizar
Al llegar al último ejercicio, antes de mostrar el botón "Terminar sesión", insertar una vista intermedia con resumen de todo lo registrado, para que el usuario pueda volver atrás y corregir antes de cerrar. Esto reemplaza el flujo actual de "terminar → ResumenSesion → editar".

### F — Indicador de progreso global más rico
Hoy: barra de progreso por sesión. Sumar:
- Mini-counter al lado: `3/8 ejercicios · 12/24 series`
- Color de la barra cambia: 0–50% naranja, 50–100% verde-fuerte.

### G — Botón "guardar serie" siempre visible
Asegurar que en mobile el botón Guardar Serie quede dentro del viewport incluso con el teclado abierto. Usar `position: sticky; bottom: env(safe-area-inset-bottom)` en el contenedor del botón.

### Checklist
- [ ] Botón "+ serie extra"
- [ ] Botón "Saltar ejercicio"
- [ ] Modal de reordenar ejercicios pendientes
- [ ] Detalle por tap en serie histórica
- [ ] Vista preview antes de terminar
- [ ] Counter `Xej/Yse` + color progresivo
- [ ] Botón Guardar siempre dentro del viewport

---

## 6. 🟠 RestTimer configurable

`src/components/RestTimer.jsx:4` — `DURACION_DEFAULT = 180`. Hardcoded a 3 minutos.

### Cambios
1. **Por ejercicio:** sumar campo `descansoSeg` opcional en `ejerciciosDia/{id}`. Si no está, usar default global.
2. **Default global por usuario:** sumar `descansoDefault` en `usuarios/{id}` (default 120s).
3. **Override rápido en el timer:** dos botones flotantes en el RestTimer: `−30s` y `+30s` que ajustan `endTimeRef.current` y forzan `setTick`.
4. **Recordar el ajuste:** si el usuario ajusta 3 veces seguidas en el mismo ejercicio, sugerir actualizar `descansoSeg` para ese ejercicio con un toast "Querés que recordemos 2:30 para sentadillas?" → tap = guarda.

```jsx
<button onClick={() => { endTimeRef.current += 30000; setTick(t => t + 1) }} className="btn btn-ghost">+30s</button>
<button onClick={() => { endTimeRef.current = Math.max(Date.now() + 1000, endTimeRef.current - 30000); setTick(t => t + 1) }} className="btn btn-ghost">−30s</button>
```

### Sonido (opcional)
Al terminar, hoy vibra. Sumar **bip suave** vía Web Audio API (no archivo, sintetizado: `OscillatorNode`). Toggle global en algún settings futuro; por ahora dejarlo on por default. Respetar `prefers-reduced-motion` y silenciar si la página no está visible.

### Checklist
- [ ] `descansoSeg` opcional en `ejerciciosDia`
- [ ] `descansoDefault` en `usuarios`
- [ ] Botones ±30s en el timer
- [ ] Sugerencia auto-guardar tras 3 ajustes consecutivos
- [ ] Bip suave Web Audio al finalizar

---

## 7. 🟠 Smart defaults y "última vez"

### A — Pre-llenar peso con el de la última vez
Hoy, abre el input de peso vacío. Sumar:
- `placeholder` con el peso de la última serie del mismo ejercicio: `placeholder={ultimaVez?.pesoUsado ?? ''}`.
- **NO** prellenar el `value` (sería confuso), pero sí mostrar abajo un hint tappeable: "↳ Última vez: 80kg · 8 reps. Tocá para usar."

### B — Reps esperadas como placeholder
- `placeholder={repsEsperadas}` en el input de reps.

### C — Sugerencia de progresión
Si el usuario completó las series anteriores con el mismo peso a las reps esperadas: tras "Guardar serie", mostrar tooltip suave "Subiste todas las series? Probá +2.5kg la próxima". (Sólo log, no autoincrementar.)

### D — Última vez extendida
La card "Última vez" actual muestra solo la última sesión. Sumar tab dentro de la card: "Última" / "Mejor PR" (peso máximo histórico para ese ejercicio).

### E — Auto-mostrar grupo muscular
En SesionActiva, junto al nombre del ejercicio, mostrar `<Badge>{grupoMuscular}</Badge>` para reforzar contexto.

### Checklist
- [ ] Placeholder de peso = última vez
- [ ] Hint tappeable "Tocá para usar"
- [ ] Placeholder de reps = repsEsperadas
- [ ] Card "Última vez" con tab "Mejor PR"
- [ ] Badge de grupo muscular en SesionActiva

---

## 8. 🟡 Historial filtrable y detalle de sesión

### A — Filtros en `Progreso → Historial`
Hoy es lista cronológica sin filtros. Sumar barra de filtros chips arriba de la lista:
- Por programa (todos / [nombres de programas])
- Por grupo muscular (Todos / Pierna / Espalda / Pecho / ...)
- Por mes (chips de los últimos 6 meses)

Cada chip toggle con animación `layoutId="filtroChip"` (consistente con UI plan).

### B — Tap en sesión histórica → detalle
Hoy probablemente la sesión histórica no es navegable. Sumar ruta `/sesion/:id` que renderiza una vista read-only similar a `ResumenSesion` con:
- Serie por serie
- Notas
- Comparación con sesión anterior del mismo día/programa
- Botón "Eliminar sesión" (con undo de Sección 2)

### C — Tap en día del calendario (Home)
Hoy el calendario marca días con sesión pero **no es interactivo**. Sumar: tap en un día con sesión → navega a `/sesion/{id}` (si hay 1) o muestra sheet con lista de sesiones de ese día (si hay varias, edge case raro).

### Checklist
- [ ] Chips de filtro en Historial (programa / grupo / mes)
- [ ] Ruta `/sesion/:id` read-only
- [ ] Tap en día con sesión → navega al detalle

---

## 9. 🟡 Onboarding extendido

### A — Lo que ya hay
`src/components/Onboarding.jsx` muestra 3 pasos + input de peso una sola vez. `localStorage` flag `onboardingDone` en `src/pages/Home.jsx:57-58`.

### B — Tour de features (segundo onboarding)
Después del primer programa creado, disparar un **tour de 3 spotlights**:
1. Spotlight en el botón "+" del Header → "Acá creás un día"
2. Spotlight en el BottomNav → "Tu progreso en vivo"
3. Spotlight en "Entrenar" → "Cuando estés listo, empezá"

Implementación: componente `<FeatureTour steps={[...]} />` con `position: fixed`, overlay semi-opaco y un "hole" alrededor del target via `clip-path`. Flag separado en localStorage: `featureTourDone`.

### C — Reactivar onboarding
En un settings futuro: botón "Ver intro de nuevo" que resetea ambos flags. Por ahora: comando de consola `localStorage.removeItem('onboardingDone')` documentado en README.

### D — Estado vacío con onboarding contextual
Cuando el usuario crea su primer programa pero **aún no tiene días**: en lugar del empty state genérico, mostrar un mensaje específico: "Buenísimo. Ahora creá el primer día (ej: 'Lunes - Pierna')."

### Checklist
- [ ] `<FeatureTour />` creado con 3 pasos
- [ ] Trigger tras crear primer programa
- [ ] Flag `featureTourDone` en localStorage
- [ ] Mensaje "first program done" diferenciado

---

## 10. 🟢 Copy y personalidad

La app tiene tono neutro. Para una app personal con amigos puede ser más cálida.

### A — Mensajes contextuales según hora / racha / día
- Home, mañana (6–11h): "Buenas, [nombre]. ¿Listo para entrenar?"
- Home, tarde (12–18h): "Hola [nombre]"
- Home, noche (19–4h): "Buenas noches, [nombre]"
- Si racha actual ≥ 3: agregar "🔥 [N] semanas seguidas"
- Si última sesión fue hace >7 días: "Hace [N] días sin entrenar. Hoy?"

### B — Empty states con personalidad
En vez de "Sin sesiones todavía" → "Cero sesiones. ¿La primera?"

### C — Toast de motivación tras milestone
- Primera sesión completada: 🎉 "¡Primera sesión! Bien ahí."
- Sesión nº 10, 25, 50, 100: toast especial.
- PR de peso máximo en un ejercicio: toast verde "🏆 PR nuevo en [ejercicio]: [peso]kg".

### D — Loading lockups con copy
En lugar de un spinner genérico, mostrar texto rotativo durante cargas largas:
- "Cargando tu progreso..."
- "Revisando registros..."

### E — Mensajes de error humanos
En vez de "Error" → "Algo no salió. Probá de nuevo." / "Sin internet. Tu sesión queda guardada local."

### Checklist
- [ ] Saludo contextual en Home
- [ ] Empty states reescritos
- [ ] Toast de PR / milestone
- [ ] Toast "X días sin entrenar"
- [ ] Loading messages con copy
- [ ] Errores reescritos en lenguaje humano

---

## 11. 🟢 Accesibilidad de flujo

> La accesibilidad de elementos (aria-*, contraste, roles) está cubierta en `BUGS_OPTIMIZATION.md` sección 8. Esta sección es sobre **flujo de uso**.

### A — Atajos de teclado (desktop)
- `n` en Programas → "nuevo programa" (abre modal)
- `n` en Dias → "nuevo día"
- `n` en EjerciciosDia → abre `<SeleccionarEjercicio />`
- `Esc` cierra modales y sheets (verificar que esto ya funciona)
- En SesionActiva: `Enter` guarda serie · `→` siguiente ejercicio · `←` corregir anterior

Implementar con un hook `useKeyboardShortcut(key, handler, deps)` central que respete `e.target` (no disparar si está tipeando en input).

### B — Foco visible
Después del UI plan ya está el `--ring-focus`. Verificar que **cada elemento interactivo** lo respete: cards de programa (`tabIndex=0` + `onKeyDown` con Enter/Space), chips de filtro, días del calendario.

### C — Orden lógico de tab en formularios
Verificar con `Tab` en SesionActiva: peso → reps → nota → guardar. Hoy probablemente está OK por orden natural del DOM, pero confirmar.

### D — Screen reader-friendly state
Para usuarios con lectores:
- `aria-live="polite"` en el header de SesionActiva: "Ejercicio 3 de 8, Serie 2 de 4".
- `aria-live="assertive"` cuando termina el RestTimer.

### Checklist
- [ ] Hook `useKeyboardShortcut`
- [ ] Shortcut `n` en páginas de listas
- [ ] Shortcut `Enter / ←  → ` en SesionActiva
- [ ] Cards de listas con `tabIndex` y handler `Enter/Space`
- [ ] aria-live en SesionActiva y RestTimer

---

## 12. Checklist global

- [ ] 🔴 Sección 1 — Toast system
- [ ] 🔴 Sección 2 — Undo destructivo
- [ ] 🟠 Sección 3 — Empty states accionables
- [ ] 🟠 Sección 4 — Inputs mobile-first
- [ ] 🔴 Sección 5 — SesionActiva sin fricción
- [ ] 🟠 Sección 6 — RestTimer configurable
- [ ] 🟠 Sección 7 — Smart defaults / última vez
- [ ] 🟡 Sección 8 — Historial filtrable + detalle
- [ ] 🟡 Sección 9 — Onboarding extendido
- [ ] 🟢 Sección 10 — Copy y personalidad
- [ ] 🟢 Sección 11 — Accesibilidad de flujo

---

## Verificación final (tras los tres planes)

1. Crear un usuario nuevo (limpiar localStorage), pasar por todo el flow: onboarding → crear programa → crear día → agregar 3 ejercicios → entrenar → completar sesión → ver progreso. Sin tocar consola del browser, debe ser claro qué hacer en cada paso.
2. Borrar un programa, esperar a Deshacer, confirmar que el toast funciona y que el programa vuelve.
3. Mid-sesión, refrescar la página. Confirmar que la sesión persiste y que el RestTimer recupera el tiempo correcto si estaba corriendo.
4. Probar con `pointer-events: coarse` simulado (DevTools mobile) que los stepper buttons funcionan y los teclados numéricos aparecen.
5. Pasar Lighthouse → score de accesibilidad ≥ 90.
6. Deploy a Firebase Hosting: `npm run build && firebase deploy`.

Después de los tres planes, la app pasa de "MVP funcional" a "app que se siente cuidada".
