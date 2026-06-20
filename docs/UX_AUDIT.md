# Auditoría visual VetIA — fase inicial

> **Fecha:** 2026-06-15  
> **Alcance:** diagnóstico only; **sin cambios de diseño implementados**.  
> **Fuentes:** capturas E2E locales (`frontend/e2e-screenshots/`) + revisión de componentes (`Login`, `Navbar`, `DetalleConsulta`, dashboard).

## Capturas de referencia

| Pantalla | Archivo |
|----------|---------|
| Login desktop | `e2e-screenshots/ux-login-desktop.png` |
| Login mobile | `e2e-screenshots/ux-login-mobile.png` |
| Dashboard | `e2e-screenshots/00-dashboard.png` |
| Paciente (detalle) | `e2e-screenshots/01-paciente-creado.png` |
| Consulta + SOAP (borrador) | `e2e-screenshots/02-consulta-soap.png` |
| Consulta aprobada + acciones | `e2e-screenshots/04-email-mock.png`, `05-whatsapp-pdf.png` |
| Mobile (parcial) | `ux-dashboard-mobile.png`, `ux-pacientes-mobile.png` |

**Nota:** las capturas mobile post-login quedaron en estado *«Cargando sesión…»* (auth aún resolviendo). La auditoría mobile se basa en código (`Navbar` hamburger) + inferencia desde desktop. Repetir capturas con `waitFor` al contenido antes de la fase de diseño.

---

## Resumen ejecutivo

La app es **funcional y coherente en color** (verde `#0F6E56`), pero se percibe **MVP clínico**: mucho espacio vacío, jerarquía irregular entre acciones, layout denso en consulta y **mobile poco validado**. El flujo SOAP → aprobar → compartir PDF funciona; la presentación de botones Email/WhatsApp/PDF puede ser más clara y profesional.

---

## Por pantalla

### 1. Login

**Fortalezas:** split hero + form en desktop transmite propuesta de valor; CTA principal visible; badge SSL da confianza.

**Problemas**

| Tipo | Detalle |
|------|---------|
| Responsive | En mobile desaparece el panel verde (beneficios); solo queda formulario genérico. |
| Spacing | Links «Crear cuenta» / «¿Olvidaste…?» muy pegados al botón principal. |
| Texto | Subtítulo gris claro; contraste borderline en pantallas brillantes. |
| Profesionalismo | Spinner «Cargando sesión…» sin logo ni mensaje de marca tras login mobile. |

**Oportunidades:** hero compacto colapsable en mobile; ilustración o 1 bullet de valor bajo el logo; skeleton branded en carga de sesión.

---

### 2. Dashboard

**Fortalezas:** banner de bienvenida claro; KPIs legibles; secciones citas / consultas / pacientes recientes bien nombradas.

**Problemas**

| Tipo | Detalle |
|------|---------|
| Densidad | Banner hero ocupa ~30% viewport; KPIs debajo se ven pequeños y delgados. |
| Spacing | «Próximas citas hoy» con empty state enorme (mucho blanco). |
| Redundancia | «+ Nuevo Paciente» en nav y en banner. |
| Lista | Consultas recientes repetidas (mismo paciente/hora) — en E2E es seed; en prod sugieren falta de diversidad visual o agrupación. |
| UX | Icono ▶ en filas de consulta: significado ambiguo (¿abrir? ¿audio?). |
| FAB | Micrófono flotante abajo-derecha compite con footer y puede tapar contenido en mobile. |

**Oportunidades:** KPIs más prominentes; empty states más compactos con ilustración; un solo CTA primario «Nueva consulta»; aclarar iconografía de filas.

---

### 3. Pacientes — detalle expediente

**Fortalezas:** header con avatar especie; datos propietario con iconos; CTA «Nueva Consulta» visible.

**Problemas**

| Tipo | Detalle |
|------|---------|
| Simplicidad | Dos bloques empty state grandes («Evolución clínica», «Historial») dominan la vista en expediente nuevo. |
| Spacing | Columna izquierda estrecha vs derecha vacía; desbalance horizontal. |
| Ubicación | Formulario de vacunas arriba del todo compite con identidad del paciente. |
| Texto | «Edad: No registrada» sin invitar a completar; «Otros Pacientes» muestra duplicados. |
| Profesionalismo | Cards muy planas (borde gris + blanco); poca jerarquía tipográfica entre secciones. |

**Oportunidades:** onboarding inline («Completa edad y vacunas»); mover vacunas a pestaña/sección; grid responsive 1-col en mobile.

---

### 4. Detalle consulta — SOAP (borrador)

**Fortalezas:** SOAP en grid 2×2 con color por sección (S/O/A/P) facilita escaneo; banner IA en medicamentos; prioridad segmentada.

**Problemas**

| Tipo | Detalle |
|------|---------|
| Botones | Header apretado: Eliminar + Guardar + Aprobar; «Aprobar» compite con acciones secundarias. |
| Spacing | Columna izquierda muy larga (motivo, prioridad, signos, audio, transcripción); scroll excesivo. |
| Contraste | Inputs de signos vitales vacíos casi invisibles (placeholder gris sobre blanco). |
| Consistencia | Reproductor `<audio>` nativo del navegador rompe el sistema visual. |
| Redundancia | Transcripción original repite gran parte del SOAP visible. |
| Texto | «Editar Nota» pequeño respecto a la importancia de revisar IA. |
| Tabla | Medicamentos: columna ACCIÓN con icono minúsculo; headers uppercase muy tenues. |

**Oportunidades:** sticky bar de acciones; colapsar transcripción; reproductor custom; resaltar flujo «Revisar → Aprobar».

---

### 5. Consulta aprobada — PDF / Email / WhatsApp

**Fortalezas:** tres acciones de compartir visibles tras aprobar; iconos WhatsApp/email reconocibles; PDF server-side integrado.

**Problemas**

| Tipo | Detalle |
|------|---------|
| Jerarquía | «Descargar PDF» sólido verde domina; compartir (WhatsApp/email) parecen secundarios (outline). |
| Ubicación | Botones en header lejos del contenido SOAP; en scroll largo quedan fuera de vista. |
| Responsive | Tres botones inline probablemente desbordan en ≤390px (no capturado por carga de sesión). |
| Texto | «Enviar WhatsApp» vs «Enviar por Email» — paralelismo OK; falta feedback toast tras email (solo `alert`). |
| Profesionalismo | Mezcla de estilos outline (WA verde, email índigo) sin sistema de variantes documentado. |

**Oportunidades:** barra fija «Compartir historial» post-aprobación; botón primario «Compartir» con menú; toasts en lugar de `alert`.

---

### 6. Mobile (390×844)

**Observado:** login mobile usable; post-login capturas incompletas (spinner auth).

**Problemas inferidos (código + partial capture)**

| Tipo | Detalle |
|------|---------|
| Nav | Solo hamburger; sin bottom navigation para acciones frecuentes (pacientes, nueva consulta). |
| Consulta | Layout 2-col desktop no apto para pantalla estrecha sin refactor (sidebar + SOAP apilados con mucho scroll). |
| FAB mic | Puede solaparse con botones de compartir o footer. |
| Touch | Botones header consulta pueden quedar &lt;44px alto efectivo en algunos breakpoints. |

**Oportunidades:** bottom nav 4 ítems; acciones compartir en sheet inferior; capturas mobile completas en fase diseño.

---

## Problemas transversales

1. **Sistema de diseño implícito** — colores SOAP y botones no siguen tokens documentados; muchas clases Tailwind inline duplicadas.
2. **Empty states genéricos** — icono + texto gris; no guían al siguiente paso con CTA integrado.
3. **Feedback de acciones** — `alert()` nativo (email, teléfono faltante) rompe experiencia app-like.
4. **Tipografía** — mezcla de pesos (`font-bold`, `font-extrabold`) sin escala clara h1/h2/body/caption.
5. **Accesibilidad** — placeholders como única etiqueta en algunos inputs; contraste secundario bajo.
6. **Datos de demo** — nombres repetidos «Max E2E» restan credibilidad en demos visuales.

---

## Plan de mejoras (sin implementar aún)

### Fase A — Quick wins (1–2 días)

- [ ] Toasts/snackbars reemplazando `alert()` en consulta y compartir.
- [ ] Sticky action bar en `DetalleConsulta` (aprobar / compartir).
- [ ] Ajustar jerarquía botones post-aprobación (compartir primario, descargar secundario).
- [ ] Empty states más compactos + CTA único.
- [ ] Capturas mobile completas (wait auth + consulta aprobada).

### Fase B — Layout & responsive (3–5 días)

- [ ] Consulta: stack mobile (metadata → SOAP → medicamentos → acciones).
- [ ] Dashboard: reducir hero; KPIs 2×2 en mobile.
- [ ] Bottom navigation mobile opcional.
- [ ] Reproductor audio custom ligero.

### Fase C — Polish profesional (1 semana)

- [ ] Tokens de color/tipo/espaciado en `docs/` o theme Tailwind.
- [ ] Ilustraciones empty state (SVG inline).
- [ ] Login mobile con mini-hero o carrusel de beneficios.
- [ ] Revisión copy (COMPLETADO vs Aprobada, microcopy IA).
- [ ] Matriz visual en `docs/qa/matriz.md` fila R49+ cuando se implemente.

---

## Criterios de éxito para la fase visual siguiente

- Consulta aprobada: compartir PDF/WhatsApp/email usable en **390px** sin overflow horizontal.
- Flujo login → dashboard → consulta → compartir reconocible en **≤3 scrolls** en mobile.
- Ningún `alert()` nativo en flujos principales.
- Lighthouse Accessibility ≥ 90 en login y detalle consulta (objetivo).

---

## Próxima acción recomendada

Priorizar **Fase A**: sticky actions + toasts + capturas mobile completas, luego validar con Playwright viewport mobile en consulta aprobada.
