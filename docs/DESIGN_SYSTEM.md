# Sistema de diseño — Vethos AI (VetIA)

> **Actualizado 2026-07-06:** el rediseño de marca ya se ejecutó y cambió de dirección —
> la marca actual es **navy (`#072040`) + cian (`#07c7f2`) + lima (`#9ccf3f`)**, no el verde
> `#0f6e56` que describía este documento originalmente (ese plan quedó registrado como
> histórico en `docs/design/REDISENO_C_TAREAS.md`). La sección 2 de abajo ya refleja los
> tokens reales vigentes en `frontend/src/index.css`. Ver también
> `Vethos - Negocio/Vethos-Diseño-Frontend-Contexto.md` para el brief completo de marca
> usado por el agente de frontend/diseño.
>
> Tema: **claro** (el dark queda preparado en tokens pero inactivo).
> La navegación ya es **sidebar** (no navbar superior); el resto de principios de este
> documento (aire, jerarquía, accesibilidad) siguen vigentes.
> Idioma de la UI y docs: español; identificadores de código en inglés.

Este documento es la fuente de verdad visual. Los mockups IA de referencia están en
[docs/design/mockups/](design/mockups/) (esos mockups son del plan de color viejo — ya
no representan la paleta actual).

---

## 1. Principios

1. **Plano antes que glass.** Menos gradientes/orbes/blur; superficies sólidas, bordes 1px
   sutiles, sombras discretas. (Hoy `index.css` abusa de `--gradient-command`, `.brand-orb`,
   `backdrop-filter`; eso es lo que se siente recargado.)
2. **Aire y jerarquía.** Espaciado generoso, una sola familia de encabezados, tipografía clara.
3. **El verde es acento, no fondo.** Marca `#0f6e56` solo en estado activo, foco y acción
   primaria. El resto es neutro.
4. **Un componente, un estilo.** Todo color/spacing sale de tokens CSS; nada de `#0F6E56` ni
   `slate-*` hardcodeados en componentes (regla `10-frontend`).
5. **Estados siempre.** Cada vista con loading / empty / error.
6. **Accesible AA.** Contraste suficiente, foco visible, navegación por teclado, landmarks.

---

## 2. Tokens

### 2.1 Estructura (ya existe en `frontend/src/index.css`)
Se conservan los nombres de variables actuales para no romper consumidores:
`--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-secondary`, `--muted`,
`--accent`, `--accent-strong`, `--accent-soft`, semánticos (`--success`, `--warn`, `--danger`,
`--info`, `--whatsapp`), radios `--radius-*`, sombras `--shadow-*`, espaciado `--space-*`,
motion `--transition-*`.

### 2.2 Marca vigente (ejecutada 2026-07-06)
La unificación de marca ya se hizo, pero con otra paleta a la planeada originalmente:

```css
--accent: #072040;        /* navy — color primario */
--accent-strong: #072540; /* hover/estado fuerte */
--accent-soft: #e5f0fa;
--clinical-cyan: #07c7f2; /* acento secundario vibrante */
--clinical-lime: #9ccf3f; /* acento terciario, uso moderado */
--gradient-hero: linear-gradient(135deg, #072040 0%, #072540 55%, #07c7f2 100%);
```

No debe quedar ningún `#0F6E56`/`#0f6e56` hardcodeado en componentes — todo sale de
`var(--accent)` y los tokens de arriba (regla `10-frontend`, ya vigente).

### 2.3 Escala de neutros (nueva, para superficies planas)
Añadir una rampa neutra explícita para reemplazar `slate-*` sueltos:

```css
--neutral-0:  #ffffff;
--neutral-50: #f7f8f7;
--neutral-100:#eef1f0;
--neutral-200:#e3e8e6;
--neutral-300:#cdd5d2;
--neutral-500:#697571;
--neutral-700:#3a4541;
--neutral-900:#101613;
```

### 2.4 Tipografía
Stack actual `system-ui` está bien para empezar. Escala recomendada (rem):
`display 1.875` · `h1 1.5` · `h2 1.25` · `h3 1.125` · `body 0.95` · `small 0.8` · `caption 0.7`.
Line-height 1.5 cuerpo, 1.2 títulos. Pesos 400/500/600/700.

### 2.5 Diferencias por dirección
Lo único que cambia entre A/B/C son densidad, radios, sombras y saturación del color.

| Aspecto | A — Notion | B — Linear (claro) | C — Calendar |
|---------|-----------|--------------------|--------------|
| Fondo app | `--neutral-0/50` plano | `--neutral-0` con hairlines | `--neutral-50` con cards blancas |
| Radio base | 8px (`--radius-sm` bajado) | 6px (`--radius-xs`) | 16px (`--radius`) |
| Sombra | casi nula (`--shadow-xs`) | hairline + `--shadow-xs` | difusa suave (`--shadow-sm/md`) |
| Densidad | media-alta, mucho aire | alta, compacto | media, aireado |
| Color | verde mínimo, neutros | preciso, dots de estado | estados muy visibles (tintes) |
| Borde | 1px `--border` | 1px hairline `--neutral-200` | 1px + cards redondeadas |

---

## 3. Sidebar (reemplaza la navbar)

### 3.1 Anatomía
```
┌─────────────┐
│ Logo VetIA  │  marca (link a inicio)
│ [Buscar ⌘K] │  (B/C) acceso a CommandPalette
│ + Nueva...  │  (C) acción primaria destacada
│             │
│ NAV         │  items por rol (reusa getNavbarItemsForProfile)
│  Inicio     │
│  Pacientes  │
│  Agenda     │
│  Vacunas    │
│  Brigadas   │
│             │
│ (mini-cal)  │  (C) widget de mes opcional
│ Perfil/org  │  usuario + switcher al fondo
└─────────────┘
```

### 3.2 Reglas
- **Ancho**: 248px expandida; 64px colapsada (solo iconos + tooltip). Persistir preferencia.
- **Item**: icono lucide 18–20px + label; alto 36–40px; radio `--radius-sm`.
- **Activo**: pill suave `--accent-soft` + texto `--accent-strong` + (opcional) barra izquierda 2px.
- **Hover**: fondo `--neutral-100`.
- **Foco**: `--focus-ring`.
- **Móvil (<1024px)**: sidebar se oculta; top-bar mínima con hamburguesa que abre un **drawer**
  (mismo contenido) con overlay. `aria-expanded`/`aria-controls` obligatorios.
- **Reusar data**: `getNavbarItemsForProfile`, `VET_NAVIGATION` (niveles 2 y 3 del vet:
  subtabs `?tab=` y contexto de paciente vía `window.__currentPaciente`), y la detección de
  sección de superadmin. No se reescribe la lógica, solo el render.
- **Navegación contextual (nivel 2/3 del vet)**: se renderiza como **subnav dentro del
  contenido** (no en la sidebar), debajo del `PageHeader`, como tabs.

---

## 4. PageHeader único

Hoy conviven `PageHeader`, headers inline y `command-hero`. **Unificar en un solo `PageHeader`**:

```
[migaja opcional]
Título (h1)            [acciones: botones secundarios + primario]
Descripción (muted)
[tabs de subnav opcionales]
```
- Sin hero con gradiente para páginas internas (reservar un banner suave solo para Login).
- Acciones alineadas a la derecha; en móvil pasan debajo.

---

## 5. Componentes (Primitives)

Existen: `Card`, `Badge`, `Button`, `Skeleton`, `EmptyState`, `InfoTile`, `KpiCard`,
`SectionHeader`, `PageHeader`, `ActionBar`, `Toast`, `Confirm`.

**Faltan y se deben crear** (escalabilidad, hoy se repiten strings de Tailwind):
- `Input`, `Textarea`, `Select`, `FormField` (label + hint + error).
- `Modal` (unificar con `PdfPreviewModal`).
- `Tabs` (para subnav de nivel 2/3).
- `Sidebar` + `SidebarItem`.

Reglas: estilos por tokens, variantes por prop (no clases sueltas), foco/teclado correctos.

---

## 6. Color de estados

Consultas/citas y badges usan los semánticos (`estadoBadgeVariant`). Mapa recomendado:

| Estado | Token | Uso |
|--------|-------|-----|
| Programada / borrador | `--info` / `--muted` | azul / gris |
| En progreso / en atención | `--warn` | ámbar |
| Completada / realizada / aprobada | `--success` | verde |
| Cancelada / error | `--danger` | rojo |
| WhatsApp | `--whatsapp` | acción compartir |

En la agenda (react-big-calendar) el color del bloque = estado; usar versiones `*-soft` para
fondo y el sólido para barra/borde. Actualizar `features/citas/calendario.css` a tokens.

---

## 7. Accesibilidad (cerrar gaps actuales)

- `nav` con `aria-label`; botón de menú móvil con `aria-expanded`/`aria-controls`.
- Items de navegación como `<a>`/`<button>` reales (hoy hay `div` clicable en el perfil).
- Contraste: evitar `--muted` sobre blanco para texto pequeño esencial; mínimo AA (4.5:1).
- Foco visible en todo control (`:focus-visible` ya global).
- Reposicionar overlays sin tapar la sidebar: `CommandPalette` (centrado superior),
  `NotificationBell` (anclado al header), `OfflineIndicator` (abajo, fuera de la sidebar).

---

## 8. Mockups de referencia

| Dirección | Dashboard | Consulta (SOAP) | Agenda |
|-----------|-----------|------------------|--------|
| A — Notion | `design/mockups/dirA-notion-dashboard.png` | `dirA-notion-consulta.png` | `dirA-notion-agenda.png` |
| B — Linear | `design/mockups/dirB-linear-dashboard.png` | `dirB-linear-consulta.png` | `dirB-linear-agenda.png` |
| C — Calendar | `design/mockups/dirC-calendar-dashboard.png` | `dirC-calendar-consulta.png` | `dirC-calendar-agenda.png` |

---

## 9. No romper

- La navegación está desacoplada de lo visual; el rediseño toca solo el "chrome"
  (`Layout.tsx`, nuevo `Sidebar.tsx`) y la capa de estilos.
- Orden seguro: **tokens → sidebar shell → overlays → primitivos → page header → calendario →
  tests**. Cada paso deja `lint + typecheck + test:run` en verde (regla `00-global`).
- `.veth-sticky-actions` asume `top: 4rem` (navbar); recalibrar al layout con sidebar.
