# UI_IMPROVEMENTS.md — Plan visual para reps.io

> Documento de ejecución para `claude-code`. La app de hoy se siente "plana": fondo negro + bloques de color saturados sin transición entre ellos. La meta es **dark theme con profundidad**: bordes sutiles, sombras coloridas suaves, micro-animaciones de feedback y consistencia visual entre páginas. Mantener el mood actual y la paleta — sumar, no reemplazar.

**Stack visual:** React 19 + motion v12 + tokens CSS en `src/index.css` + componentes compartidos en `src/components/ui.jsx`.

**Reglas de oro:**
1. **Nunca** usar `box-shadow` sin un `border` que la "ancle".
2. Animaciones de interacción ≤ 250ms. Animaciones de entrada ≤ 400ms.
3. Siempre usar tokens (`var(--bg-card)`, `var(--border)`, etc). Cero hex inline nuevos.
4. `prefers-reduced-motion`: si está activo, desactivar transiciones no esenciales.

---

## 0. Plan de ejecución (orden sugerido)

1. **Sección 1** — Extender tokens en `src/index.css`.
2. **Sección 2** — Clases utilitarias `.input`, `.btn-*`, `.card`.
3. **Sección 3** — Refactor de `Modal` + `BottomNav` + tabs de `Progreso`.
4. **Sección 4** — Theming de gráficos Recharts.
5. **Sección 5** — Transiciones de página direccionales.
6. **Sección 6** — Micro-animaciones por página.
7. **Sección 7** — Skeletons adicionales + `<ErrorState />`.
8. **Sección 8** — Tipografía sistematizada.

Commitear cada sección por separado (`style(tokens): ...`, `feat(ui): ...`).

---

## 1. Extender tokens en `src/index.css`

Agregar dentro de `:root { ... }` (debajo de los tokens existentes, antes del cierre):

```css
/* === Bordes de acento (para cards con color) === */
--border-green:  rgba(93, 202, 165, 0.22);
--border-orange: rgba(240, 153, 123, 0.22);
--border-blue:   rgba(133, 183, 235, 0.22);

/* === Sombras internas (top highlight) === */
--shadow-inner: inset 0 1px 0 rgba(255, 255, 255, 0.06);
--shadow-focus-blue:   0 0 0 3px rgba(133, 183, 235, 0.18);
--shadow-focus-orange: 0 0 0 3px rgba(240, 153, 123, 0.20);
--shadow-focus-green:  0 0 0 3px rgba(93, 202, 165, 0.18);

/* === Transiciones reusables === */
--transition-base:   180ms cubic-bezier(0.2, 0.8, 0.2, 1);
--transition-slow:   320ms cubic-bezier(0.2, 0.8, 0.2, 1);
--transition-bounce: 240ms cubic-bezier(0.34, 1.56, 0.64, 1);

/* === Focus ring uniforme === */
--ring-focus: 0 0 0 2px rgba(133, 183, 235, 0.45);
```

### Respetar reduced-motion
Sumar al final del archivo:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Checklist
- [ ] Tokens agregados en `:root`
- [ ] Bloque `prefers-reduced-motion` al final del archivo

---

## 2. Clases utilitarias: inputs, botones, cards

Agregar a `src/index.css`. Estas clases reemplazan estilos inline scattered en cada página.

### `.input` — campos de texto/número

```css
.input {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-top-color: var(--highlight);
  border-radius: var(--r-md);
  padding: 12px 14px;
  color: var(--text);
  font-size: 16px;
  font-weight: 500;
  box-shadow: var(--shadow-inner);
  transition: border-color var(--transition-base),
              box-shadow var(--transition-base),
              background var(--transition-base);
  outline: none;
}
.input::placeholder { color: var(--text-dim); }
.input:focus {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-inner), var(--ring-focus);
  background: var(--bg-card-hover);
}
.input.num { font-variant-numeric: tabular-nums; text-align: center; font-size: 22px; font-weight: 600; }
```

Aplicar reemplazando inline styles en:
- `src/pages/SesionActiva.jsx` — inputs de peso y reps (usar `.input.num`)
- `src/pages/ResumenSesion.jsx` — inputs de edición
- `src/pages/Login.jsx` — PIN dots (parcial: el contenedor mantiene su estilo, pero el dot activo usa `--ring-focus`)
- `src/components/ui.jsx` — Modal inputs
- `src/components/SeleccionarEjercicio.jsx` — input de búsqueda

### `.btn` — sistema de botones

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--r-md);
  padding: 12px 18px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: transform var(--transition-base),
              box-shadow var(--transition-base),
              background var(--transition-base),
              border-color var(--transition-base);
  white-space: nowrap;
}
.btn:active { transform: scale(0.97); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
  background: var(--orange-grad);
  color: #fff;
  box-shadow: var(--shadow-orange), var(--shadow-inner);
  border-top-color: var(--highlight);
}
.btn-primary:hover { box-shadow: var(--shadow-orange), var(--shadow-md); transform: translateY(-1px); }

.btn-primary-blue  { background: var(--blue-grad);  color: #fff; box-shadow: var(--shadow-blue),  var(--shadow-inner); border-top-color: var(--highlight); }
.btn-primary-green { background: var(--green-grad); color: #fff; box-shadow: var(--shadow-green), var(--shadow-inner); border-top-color: var(--highlight); }

.btn-secondary {
  background: var(--bg-card);
  color: var(--text);
  border-color: var(--border);
  border-top-color: var(--highlight);
  box-shadow: var(--shadow-inner);
}
.btn-secondary:hover { background: var(--bg-card-hover); border-color: var(--border-strong); }

.btn-ghost {
  background: transparent;
  color: var(--text-mute);
}
.btn-ghost:hover { background: var(--bg-card); color: var(--text); }

.btn-danger {
  background: var(--danger-bg);
  color: var(--danger);
  border-color: rgba(255, 107, 107, 0.3);
}
.btn-danger:hover { background: rgba(255, 107, 107, 0.18); }
```

Reemplazar todos los `<button style={{...}}>` repetidos en:
- `Entrenar.jsx` (botón Empezar → `.btn .btn-primary`)
- `Programas.jsx`, `Dias.jsx`, `EjerciciosDia.jsx` (botones de acciones)
- `Login.jsx` (botones de PIN: mantienen su estilo redondo, pero usan tokens)
- `ResumenSesion.jsx` (guardar nota, terminar)
- `ui.jsx` (cancel/save de Modal pasan a `.btn-ghost` y `.btn-primary`)

### `.card-elevated` — variante de `.card` (ya existe `.card` base)

```css
.card-elevated {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-top-color: var(--highlight);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm), var(--shadow-inner);
  transition: transform var(--transition-base),
              box-shadow var(--transition-base),
              border-color var(--transition-base);
}
.card-elevated:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md), var(--shadow-inner);
  border-color: var(--border-strong);
}
```

Aplicar a las cards de:
- `Programas.jsx` — cada programa
- `Dias.jsx` — cada día
- `EjerciciosDia.jsx` — cada ejercicio
- `ResumenSesion.jsx` — cards por ejercicio (hoy planas)
- `Progreso.jsx` — cards de stats en Volumen/Rachas/Peso

> Las cards de acento (Home secciones, banner sesión activa) ya tienen estilos custom; **no tocarlas con `.card-elevated`**.

### Checklist
- [ ] `.input` y `.input.num` agregadas y aplicadas
- [ ] `.btn` + variantes agregadas y aplicadas
- [ ] `.card-elevated` agregada y aplicada en listas de programas/días/ejercicios/resumen/progreso

---

## 3. Modal, BottomNav y tabs de Progreso

### `src/components/ui.jsx` — Modal bottom-sheet con grip

Hoy hace `y: '100%' → y: 0` con backdrop blur. Sumar:

1. **Drag handle visual** en la parte superior:
   ```jsx
   <div style={{
     width: 40, height: 4,
     borderRadius: 999,
     background: 'var(--border-strong)',
     margin: '8px auto 16px',
   }} />
   ```
2. **Cierre por swipe-down** con motion:
   ```jsx
   <motion.div
     drag="y"
     dragConstraints={{ top: 0, bottom: 0 }}
     dragElastic={{ top: 0, bottom: 0.4 }}
     onDragEnd={(_, info) => { if (info.offset.y > 80) onClose() }}
     ...
   >
   ```
3. **Sombra superior** del sheet para que se vea "levantado": agregar `box-shadow: 0 -12px 32px rgba(0,0,0,0.5), var(--shadow-inner)` al contenedor.

### `src/components/BottomNav.jsx`

Ya tiene pill animado con `layoutId`. Sumar:
- **Color del icono con transición:**
  ```jsx
  style={{ color: activo ? 'var(--orange)' : 'var(--text-mute)',
           transition: 'color var(--transition-base)' }}
  ```
- **Glow del tab activo:** un `motion.div` posicionado encima del icono con `boxShadow: '0 0 16px rgba(240,153,123,0.4)'` y `opacity: activo ? 0.6 : 0`.
- **Borde superior del nav** subirlo a `border-strong` para definir mejor el límite.

### `src/pages/Progreso.jsx` — tabs con underline animado

Hoy son 5 tabs (Historial / Gráfico / Volumen / Rachas / Peso) sin indicador. Implementar:

```jsx
{tabs.map(t => (
  <button
    key={t.id}
    onClick={() => setTab(t.id)}
    style={{ position: 'relative', ... }}
  >
    {t.label}
    {tab === t.id && (
      <motion.div
        layoutId="progresoTabUnderline"
        style={{
          position: 'absolute', bottom: -1, left: 0, right: 0, height: 2,
          background: 'var(--orange-grad)',
          borderRadius: 2,
          boxShadow: '0 0 8px rgba(240,153,123,0.5)',
        }}
      />
    )}
  </button>
))}
```

El `layoutId` hace que motion anime el underline entre tabs.

### Checklist
- [ ] Modal con drag handle + swipe-to-close
- [ ] BottomNav con transición de color + glow
- [ ] Progreso con underline animado

---

## 4. Theming de Recharts (Progreso.jsx)

Hoy los gráficos usan los defaults de recharts: ejes blancos, grid blanco, tooltip blanco con sombra → choca con el dark theme.

### Tooltip custom

Crear archivo nuevo `src/components/ChartTooltip.jsx`:

```jsx
export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-strong)',
      borderTopColor: 'var(--highlight)',
      borderRadius: 'var(--r-md)',
      padding: '10px 14px',
      boxShadow: 'var(--shadow-md), var(--shadow-inner)',
      fontSize: 13,
    }}>
      <div style={{ color: 'var(--text-mute)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {formatter ? formatter(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}
```

### Aplicar a cada chart

En `Progreso.jsx`, en cada `<BarChart>` / `<LineChart>`:

```jsx
<CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
<XAxis tick={{ fill: 'var(--text-mute)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} />
<YAxis tick={{ fill: 'var(--text-mute)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} />
<Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
<Bar fill="url(#orangeGrad)" ... />
```

Y declarar gradientes SVG al inicio de cada chart:

```jsx
<defs>
  <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#f0997b" stopOpacity={0.9} />
    <stop offset="100%" stopColor="#8e3618" stopOpacity={0.6} />
  </linearGradient>
</defs>
```

### Checklist
- [ ] `ChartTooltip` creado
- [ ] Aplicado a BarChart de frecuencia semanal
- [ ] Aplicado a LineChart de progreso por ejercicio
- [ ] Aplicado a chart de volumen
- [ ] Aplicado a chart de peso
- [ ] Bars/Lines usan gradientes SVG en lugar de colores planos

---

## 5. Transiciones de página direccionales

### `src/App.jsx`

Hoy `AnimatePresence mode="wait"` con `opacity + y: 8`. Mejorar a slide direccional:

```jsx
const [prevPath, setPrevPath] = useState(location.pathname)
const [direction, setDirection] = useState(1) // 1=forward, -1=back

useEffect(() => {
  // Heurística: más profundo en URL = forward
  setDirection(location.pathname.length >= prevPath.length ? 1 : -1)
  setPrevPath(location.pathname)
}, [location.pathname])

<AnimatePresence mode="wait" custom={direction}>
  <motion.div
    key={location.pathname}
    custom={direction}
    initial={d => ({ x: d > 0 ? 40 : -40, opacity: 0 })}
    animate={{ x: 0, opacity: 1 }}
    exit={d => ({ x: d > 0 ? -40 : 40, opacity: 0 })}
    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

> Mantener `PageWrapper` con drag-back actual; este cambio sólo afecta el wrapper de `AnimatePresence` en App.jsx.

### Checklist
- [ ] App.jsx con dirección de transición
- [ ] Probar navegación Home → Programas → Días → Ejercicios → atrás

---

## 6. Micro-animaciones por página

### `src/components/Calendario.jsx`
- Días sin sesión hoy son completamente planos. Agregar:
  ```jsx
  style={{ ..., border: '1px solid var(--border)', borderRadius: 8 }}
  whileHover={{ scale: 1.05, borderColor: 'var(--border-strong)' }}
  ```
- Día "hoy" (con o sin sesión): sumar `animation: pulse-soft 1.6s ease-in-out infinite`.

### `src/pages/Login.jsx`
- Botones de PIN: agregar `whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}` con `transition={{ type: 'spring', stiffness: 400, damping: 17 }}`.
- Al ingresar PIN correcto: ya hay animación de pop; sumar leve flash verde antes del fade-out: `boxShadow: 'var(--shadow-green)'`.
- Al ingresar PIN incorrecto: shake ya existe; sumar `borderColor: 'var(--danger)'` por 600ms.

### `src/pages/SesionActiva.jsx`
- Al guardar serie: micro-confetti con la keyframe `burst` que ya está en `index.css` pero sub-utilizada. Renderizar 6-8 puntitos posicionados aleatoriamente alrededor del botón guardar, con `animation: burst 600ms ease-out forwards` y colores del gradiente naranja.
- Counter de series: cuando incremente, escala 1 → 1.15 → 1 con spring.
- Progress bar (la altura dinámica que ya existe): sumarle un glow `boxShadow: 'var(--shadow-orange)'` cuando se llena.

### `src/components/ui.jsx` — `<EmptyState />`
- Icono con floating gentle:
  ```jsx
  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
    {icon}
  </motion.div>
  ```

### `src/pages/Entrenar.jsx`
- `opcionBtn` cuando no está activo: sumar borde `var(--border)` y `box-shadow: var(--shadow-inner)`. Al hover: `border-color: var(--border-strong)`.
- Al elegir programa/día: micro-bounce con `transition: { type: 'spring', stiffness: 500, damping: 25 }`.

### Checklist
- [ ] Calendario: días sin sesión con borde + hover; hoy pulsa
- [ ] Login: PIN con tap/hover spring; flash en correcto/incorrecto
- [ ] SesionActiva: confetti al guardar + counter spring + glow en progress bar
- [ ] EmptyState: icono flotante
- [ ] Entrenar: opcionBtn con borde + bounce al elegir

---

## 7. Skeletons + `<ErrorState />`

### Crear `<CardSkeleton />` en `src/components/ui.jsx`

```jsx
export function CardSkeleton({ lines = 2 }) {
  return (
    <div className="card-elevated" style={{ padding: 16 }}>
      <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 12, width: `${90 - i * 15}%`, marginBottom: 8 }} />
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return <div className="skeleton" style={{ height: 220, width: '100%', borderRadius: 'var(--r-lg)' }} />
}
```

Aplicar en `Progreso.jsx` mientras cargan datos, en `Programas.jsx` y `Dias.jsx` mientras se hace el initial fetch.

### `<ErrorState />` simétrico a `<EmptyState />`

```jsx
export function ErrorState({ titulo = 'Algo salió mal', mensaje, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 32 }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'var(--danger-bg)',
        border: '1px solid rgba(255,107,107,0.3)',
        display: 'grid', placeItems: 'center',
      }}>
        <AlertCircle color="var(--danger)" />
      </div>
      <h3 style={{ color: 'var(--text)' }}>{titulo}</h3>
      {mensaje && <p style={{ color: 'var(--text-mute)', textAlign: 'center' }}>{mensaje}</p>}
      {onRetry && <button className="btn btn-secondary" onClick={onRetry}>Reintentar</button>}
    </motion.div>
  )
}
```

Reemplazar `console.error` silentes en:
- `src/pages/Progreso.jsx` (alrededor de líneas 49–65 del fetch)
- `src/pages/Entrenar.jsx` (carga de días)
- `src/pages/Home.jsx` (recargar)

### Checklist
- [ ] `<CardSkeleton />` y `<ChartSkeleton />` creados
- [ ] Skeletons aplicados en Progreso, Programas, Dias
- [ ] `<ErrorState />` creado
- [ ] Catch + ErrorState en lugares con `console.error` silenciados

---

## 8. Tipografía sistematizada

En `src/index.css`:

```css
.h1 { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; }
.h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.25; }
.h3 { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; }
.body    { font-size: 15px; font-weight: 400; line-height: 1.5; }
.caption { font-size: 13px; font-weight: 500; color: var(--text-mute); letter-spacing: 0.01em; }
.label   { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-mute); }
```

Reemplazar `<h1 style={{ fontSize: 32, ... }}>` y `<p style={{ fontSize: 13, color: ... }}>` por las clases en todas las pages. Ayuda a mantener consistencia y reducir noise visual.

### Checklist
- [ ] Clases `.h1` / `.h2` / `.h3` / `.body` / `.caption` / `.label` agregadas
- [ ] Aplicadas en `Home.jsx`, `Programas.jsx`, `Dias.jsx`, `EjerciciosDia.jsx`, `Entrenar.jsx`, `SesionActiva.jsx`, `ResumenSesion.jsx`, `Progreso.jsx`, `Login.jsx`

---

## 9. Cards de acento (Home) — ajuste fino

`src/pages/Home.jsx` ya tiene cards con glow + noise + gradient + top highlight (bien). Único cambio:

- Subir opacidad del borde de las cards de acento de `0.10` a `~0.20` para que se note el límite:
  ```js
  border: '1px solid var(--border-orange)',  // antes: rgba(255,255,255,0.1)
  ```
  (Usar `--border-green`, `--border-orange`, `--border-blue` según el color de la sección.)

- En el banner de "Entrenamiento en curso": ya tiene doble sombra (queda muy bien). Sumar un `motion.div` interno con `animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}` como overlay-glow que pulsa.

### Checklist
- [ ] Bordes de cards de acento usan tokens `--border-*`
- [ ] Banner de sesión activa con overlay pulsante

---

## 10. Checklist global

- [ ] Sección 1 — Tokens extendidos
- [ ] Sección 2 — `.input`, `.btn`, `.card-elevated` aplicadas
- [ ] Sección 3 — Modal + BottomNav + tabs de Progreso
- [ ] Sección 4 — Recharts theming
- [ ] Sección 5 — Transiciones direccionales
- [ ] Sección 6 — Micro-animaciones por página
- [ ] Sección 7 — Skeletons + ErrorState
- [ ] Sección 8 — Tipografía sistematizada
- [ ] Sección 9 — Ajustes finos en cards de acento

**Antes del commit final:**
1. `npm run dev` y revisar cada pantalla en mobile (DevTools 390×844) y desktop.
2. Probar con `prefers-reduced-motion: reduce` activado en DevTools → no debe haber animaciones largas.
3. `npm run build` sin warnings.
4. Deploy con `npm run build && firebase deploy`.
