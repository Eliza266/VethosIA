# Rediseño UI — Dirección C (Clinical Calendar) — Plan de micro-tareas

> ⚠️ **SUPERADO (2026-07-06):** el rediseño finalmente ejecutado usó otra paleta
> (navy `#072040` + cian `#07c7f2`), no la unificación en verde `#0f6e56` que planea este
> documento. Se conserva como registro histórico de cómo se pensó la Fase 2 en su momento;
> no representa la marca ni los tokens actuales. Ver `docs/DESIGN_SYSTEM.md` §2.2 para lo
> vigente.

> Dirección elegida: **C — Clinical Calendar** (claro, aireado, color de estados protagonista,
> agenda tipo Google Calendar, cards redondeadas con sombra suave).
> Alcance: **toda la Fase 2**, segmentada en micro-tareas con QA en cada paso.
> Restricciones: **sin deploy**, sin claves en cliente, no romper la lógica de navegación/RBAC.
> Cada micro-tarea deja `typecheck + lint + test:run` en verde (regla `00-global`).
> Validación local con Vitest + Playwright (E2E) cuando aplique.

## Línea base (2026-06-25)
- `npm run typecheck` (frontend): OK.
- `npm run test:run` (frontend): 78 archivos / 344 tests OK.
- `npm run lint`: 4 errores PREEXISTENTES (`src/pages/Agenda.test.tsx`, `no-explicit-any`) + 5 warnings. Se corrigen en la fase de Agenda.
- Backend `api`: no se toca; se corre `npm run test:unit` para regresión multi-tenant.

## Convenciones
- ID `Txxx`. Estado: pendiente / en curso / hecho.
- "QA" = verificación concreta (test unitario, render, a11y, e2e, o check manual descrito).
- DoD (Definition of Done) por tarea: build verde + su QA pasa + sin `#0F6E56`/`slate-*` nuevos.

---

## FASE A — Tokens y fundaciones (dirección C)
- **T001** Añadir rampa de neutros (`--neutral-0..900`) en `index.css`. QA: typecheck + visual humo.
- **T002** Unificar marca: `--accent: #0f6e56`, recalcular `--accent-strong/-soft/-glow`. QA: snapshot de tokens (test que lee variables).
- **T003** Tokens de superficie C: `--bg` = neutral-50, `--surface` blanco, `--surface-2`. QA: visual.
- **T004** Tokens de radios C (base 16px) y sombras suaves (`--shadow-sm/md` difusas). QA: visual.
- **T005** Revisar semánticos (`--info/warn/success/danger/whatsapp` + `-soft`) para contraste AA. QA: test de contraste (utilidad) sobre pares texto/fondo.
- **T006** Tokens de sidebar: `--sidebar-bg`, `--sidebar-width` (248px), `--sidebar-width-collapsed` (64px), `--sidebar-item-active-bg/-fg`. QA: typecheck.
- **T007** Tokens de calendario por tipo: `--cal-consulta`, `--cal-vacuna`, `--cal-cirugia`, `--cal-brigada` (+ `-soft`). QA: typecheck.
- **T008** Crear test guard `src/test/noHardcodedBrand.test.ts`: falla si aparece `#0F6E56`/`#0f6e56` literal en `src/**` (excepto tokens). QA: el test pasa tras barrido (se habilita al final de Fase B).
- **T009** Mapear inventario de archivos con `#0F6E56` y `slate-*` (lista en este doc). QA: grep documentado.
- **T010** Definir helper `cn()` (clsx-like mínimo) en `lib/cn.ts` para componer clases. QA: test unitario de `cn`.

## FASE B — Aplanar utilidades glass/gradiente a estilo C
- **T011** `.veth-page-shell`: quitar grid overlay + radiales; fondo plano `--bg`. QA: render Layout.
- **T012** `.premium-card` → card plana blanca, radio 16px, `--shadow-sm`. QA: visual dashboards.
- **T013** `.command-panel` → panel plano (sin blur). QA: visual.
- **T014** `.metric-tile` → KPI card C (tinte suave opcional). QA: visual.
- **T015** `.command-hero` → banner suave; restringir uso a Login. QA: visual Login.
- **T016** `.brand-orb` → marca plana (logo). QA: visual.
- **T017** `.nav-rail`/`.nav-pill-active`/`.command-nav` → marcar deprecadas (se sustituyen por sidebar). QA: build.
- **T018** `.clinical-chip`/`.soap-intelligence-card` → versión C. QA: visual consulta.
- **T019** Barrido `#0F6E56` → `var(--accent)` en componentes `components/*` (lote 1). QA: tests verdes.
- **T020** Barrido `#0F6E56` en `pages/*` (lote 2). QA: tests verdes.
- **T021** Barrido `#0F6E56` en `features/*` (lote 3). QA: tests verdes.
- **T022** Barrido `#0F6E56` en `pages/dashboards/*` y `pages/superadmin/*` (lote 4). QA: tests verdes.
- **T023** Reemplazar `slate-*` críticos por neutros/tokens en chrome (lote 1: Layout/Navbar base). QA: visual.
- **T024** Habilitar `noHardcodedBrand.test.ts` (T008) y dejarlo verde. QA: test pasa.

## FASE C — Primitivos nuevos (escalabilidad)
- **T025** `FormField` (label + hint + error + htmlFor). QA: test render + a11y.
- **T026** `Input` (variantes, error, disabled, icon slot). QA: test.
- **T027** `Textarea` (autosize opcional). QA: test.
- **T028** `Select` (nativo estilizado + a11y). QA: test.
- **T029** `Modal` (focus trap, Escape, overlay, `role=dialog`). QA: test teclado/a11y.
- **T030** Refactor `PdfPreviewModal` para usar `Modal`. QA: tests existentes verdes.
- **T031** `Tabs` (roving tabindex, `role=tablist`, teclado). QA: test a11y/teclado.
- **T032** `SidebarItem` (icono+label, activo, colapsado con tooltip, `aria-current`). QA: test.
- **T033** Export barrel en `components/ui` + tipos. QA: typecheck.
- **T034** Migrar `inputClasses` ad-hoc de Agenda a `Input/Select`. QA: Agenda tests verdes.
- **T035** Migrar inputs ad-hoc de `NuevaConsulta`/`Pacientes` a primitivos. QA: tests verdes.
- **T036** Tests de a11y de primitivos (`primitives.a11y.test.tsx`). QA: pasa.

## FASE D — Shell con sidebar
- **T037** `Sidebar.tsx`: estructura base (header marca, nav, footer). QA: render.
- **T038** Acción primaria C: botón "+ Nueva consulta/cita" según rol/ruta. QA: render por rol.
- **T039** Render de items reusando `getNavbarItemsForProfile(me)`. QA: test items por rol.
- **T040** Estado activo por ruta (`useLocation`) + `aria-current`. QA: test.
- **T041** Caso **superadmin**: lista de secciones (reusar la actual del Navbar). QA: test superadmin.
- **T042** Caso **veterinario** nivel 1 en sidebar; niveles 2/3 como `Tabs` en contenido. QA: test.
- **T043** Contrato `window.__currentPaciente` + evento `current-paciente-changed` intacto. QA: test detalle paciente.
- **T044** Colapsable (toggle) + persistencia `localStorage`. QA: test toggle/persistencia.
- **T045** Mini-calendario (widget C) en sidebar (solo decorativo/navegable a Agenda). QA: render.
- **T046** "Mis calendarios" (tipos de cita con checkbox de color) en sidebar. QA: render.
- **T047** Footer sidebar: usuario + rol + switcher de org/clínica. QA: render.
- **T048** Refactor `Layout.tsx` a `flex-row` (sidebar fija + main scroll). QA: render rutas.
- **T049** Top-bar móvil mínima (logo + hamburguesa + bell). QA: render móvil.
- **T050** Drawer móvil (overlay, cierre por Escape/click fuera, focus trap). QA: test a11y móvil.
- **T051** `aria-label` en `nav`, `aria-expanded`/`aria-controls` en hamburguesa. QA: a11y test.
- **T052** Reemplazar `div` clicable de perfil por control real. QA: a11y test.
- **T053** Mantener `Navbar.tsx` solo para compat o eliminar usos; ajustar imports. QA: typecheck.
- **T054** Test `Sidebar.test.tsx`: render por los 4 roles + activo + colapsado. QA: pasa.
- **T055** Test e2e visual del shell (Playwright) por rol. QA: pasa local.

## FASE E — Overlays y offsets
- **T056** `CommandPalette`: reposicionar (centrado superior tipo Linear/Notion). QA: test toggle ⌘K.
- **T057** `CommandPalette`: integrar acceso desde sidebar (búsqueda). QA: render.
- **T058** `NotificationBell`: reanclar panel al nuevo header/top-bar. QA: test apertura.
- **T059** `OfflineIndicator`: reposicionar para no solapar sidebar. QA: visual.
- **T060** `.veth-sticky-actions`: recalibrar `top` al layout con sidebar. QA: visual consulta.
- **T061** Revisar z-index stack (sidebar, drawer, palette, toast, confirm). QA: visual.
- **T062** Test de no-solape/regresión de overlays. QA: pasa.

## FASE F — PageHeader unificado
- **T063** Ampliar `PageHeader`: migaja + slot de `Tabs` + acciones. QA: test.
- **T064** Migrar `Pacientes.tsx` a `PageHeader`. QA: test página.
- **T065** Migrar `DetalleConsulta.tsx` (quitar `command-hero`). QA: test.
- **T066** Migrar `Agenda.tsx`. QA: test.
- **T067** Migrar `Vacunas.tsx`. QA: test.
- **T068** Migrar `Brigadas.tsx`. QA: test.
- **T069** Migrar `DetallePaciente.tsx`. QA: test.
- **T070** Migrar `Perfil.tsx` y `Notificaciones.tsx`. QA: test.
- **T071** Migrar dashboards (Veterinario/AdminVet/AdminEntidad/SuperAdmin). QA: tests.
- **T072** Migrar páginas superadmin (`pages/superadmin/*`). QA: tests.
- **T073** Eliminar/retirar sistemas de header duplicados. QA: typecheck + grep.

## FASE G — Agenda estilo Google Calendar (núcleo dirección C)
- **T074** Reescribir `features/citas/calendario.css` con tokens (sin `#0F6E56` ni `!important` salvo necesario). QA: visual.
- **T075** Colores de evento por tipo (consulta/vacuna/cirugía/brigada) desde tokens `--cal-*`. QA: test mapeo.
- **T076** "Hoy" resaltado (círculo) en header de día. QA: visual.
- **T077** Línea de tiempo actual (current-time indicator). QA: visual.
- **T078** Toolbar Día/Semana/Mes (segmented) + navegación + "Hoy". QA: test interacción.
- **T079** Conectar mini-calendario de sidebar con la vista de Agenda. QA: test navegación.
- **T080** Panel "Mis calendarios" filtra tipos visibles. QA: test filtro.
- **T081** Estados loading/empty/error de Agenda con primitivos. QA: test.
- **T082** Corregir 4 errores lint `Agenda.test.tsx` (`no-explicit-any`). QA: lint verde.
- **T083** Tests de Agenda (vista, filtros, colores, navegación). QA: pasa.

## FASE H — Aplicar estética C a pantallas
- **T084** Dashboard Veterinario: KPI tintadas + "Agenda de hoy" (timeline) + recientes. QA: test.
- **T085** Dashboard Admin Veterinaria. QA: test.
- **T086** Dashboard Admin Entidad. QA: test.
- **T087** Dashboard SuperAdmin (overview + charts recharts con tokens). QA: test.
- **T088** `Pacientes` lista + `PacienteCard` (cards redondeadas, avatar, chips). QA: test.
- **T089** `DetallePaciente` (evolución clínica, charts con tokens). QA: test.
- **T090** `DetalleConsulta`/`SoapViewer`: secciones S/O/A/P con icono de color + cards C. QA: test.
- **T091** Paneles consulta: `Signos vitales`, `Diagnostico` (chips), `Medicamentos`. QA: test.
- **T092** `Vacunas` + `VacunasPanel` (catálogo, estados con color). QA: test.
- **T093** `Brigadas` (KPIs, tabs, consolidado). QA: test.
- **T094** `Login` (banner suave C, inputs con primitivos). QA: test.
- **T095** `ComoFunciona`/`Invitacion`/`Suscripcion` estética C. QA: test.
- **T096** Revisión de `Badge`/estados en todas las listas. QA: visual.

## FASE I — QA multi-tenant y RBAC (frontend)
- **T097** Test: `veterinario` NO ve items de admin/entidad/superadmin en sidebar. QA: pasa.
- **T098** Test: `admin_veterinaria` ve su scope, no `entidad`. QA: pasa.
- **T099** Test: `admin_entidad` ve entidad/sedes, no superadmin. QA: pasa.
- **T100** Test: `superadmin` ve secciones de plataforma. QA: pasa.
- **T101** Test: guards de ruta (`ClinicalRoute`/`RoleRoute`/`SubscriptionRoute`) intactos con nuevo shell. QA: pasa.
- **T102** Test: acción primaria de sidebar varía correctamente por rol. QA: pasa.
- **T103** Test: aislamiento de navegación contextual del vet (paciente A vs B). QA: pasa.
- **T104** Test a11y global del shell (`a11y.test.tsx` ampliado). QA: pasa.

## FASE J — E2E local (Playwright)
- **T105** Ajustar selectores e2e al nuevo shell (`e2e/roles-principales.spec.ts`). QA: pasa local.
- **T106** `e2e/flujo-principal.spec.ts` (crear paciente → consulta → SOAP mock). QA: pasa.
- **T107** `e2e/visual-refresh.spec.ts` y `visual-auth-refresh.spec.ts` actualizados. QA: pasa.
- **T108** E2E nuevo: navegación por sidebar (colapsar, móvil drawer). QA: pasa.
- **T109** E2E nuevo: agenda (cambiar vista, filtrar tipos). QA: pasa.
- **T110** Ejecutar suite e2e completa local y estabilizar flaky. QA: verde.

## FASE K — Regresión backend (no romper multi-tenant)
- **T111** Correr `api` `npm run test:unit` (incluye aislamiento por tenant). QA: verde.
- **T112** Confirmar que el frontend no introdujo llamadas fuera de `/v1` ni claves (`noClientAiKeys`). QA: pasa.
- **T113** `verify-prod-build.mjs` tras `build` (sin deploy). QA: pasa.

## FASE L — Cierre y documentación
- **T114** `npm run typecheck` frontend verde. QA: OK.
- **T115** `npm run lint` frontend verde (0 errores). QA: OK.
- **T116** `npm run test:run` frontend verde. QA: OK.
- **T117** Actualizar `docs/qa/matriz.md` con filas del rediseño (sidebar, RBAC nav, agenda, a11y). QA: filas verdes.
- **T118** Actualizar `DESIGN_SYSTEM.md` con lo realmente implementado (capturas opcionales). QA: revisado.
- **T119** Actualizar `Navbar.test.tsx`/`a11y.test.tsx` al nuevo shell o retirarlos. QA: verde.
- **T120** Repaso final: `theme_color` PWA `#0f6e56` en `vite.config.ts` + smoke build. QA: build OK.

---

## Seguimiento
El avance se refleja en la lista de TODOs de la sesión (agrupada por fase A–L). Este documento
es la referencia detallada de las 120 micro-tareas.
