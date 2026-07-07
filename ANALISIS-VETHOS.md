# Análisis del proyecto Vethos AI — a hoy (2026-06-26)

> **Nota (2026-07-06):** esta es una foto histórica del 2026-06-26; varios datos ya
> cambiaron desde entonces — bloques de grabación ahora de **20 min** (no 15), el
> rediseño de UI terminó en **paleta navy/cian** (no la "dirección C" verde que describe
> este documento), y hay clínicas nuevas (Animalike, EmiVt). Ver `ALCANCES-VETHOS.md`
> para el estado vigente de funcionalidades.

## 🚦 Resumen en una línea
**MVP funcional, desplegado y con su primer cliente real en pruebas.** Pasó de "demo" a
"producto temprano" en pocos días. Base sólida; el riesgo ya no es si funciona, sino
**operarlo y escalarlo con cuidado**.

## ✅ Lo que ya funciona (el corazón)
- **Flujo estrella completo:** grabar (por bloques de 15 min) → transcribir → SOAP → editar →
  aprobar → PDF → enviar. Probado con consultas reales de 16+ min.
- **Multi-tenant con roles:** super admin, admin entidad, admin veterinaria, veterinario —
  cada quien ve solo lo suyo.
- **Módulos:** pacientes, consultas/HC, agenda (calendario tipo Google), vacunas + catálogo,
  brigadas, métricas.
- **Onboarding real:** alta de veterinarios **con credenciales** (sin depender de invitación),
  cambio de contraseña por perfil, whitelist de acceso.

## 🆕 Avances recientes (desde el demo)
| Avance | Impacto |
|---|---|
| Rediseño de UI (dirección C: sidebar, design system, tokens) | El producto se ve más pro y consistente |
| Alta de vets con credenciales (endpoint backoffice + UI + tests) | Onboarding sin fricción — clave para vender |
| Veterinaria "Perros y Gatos" (cliente, plan propio, IA activa) | **Primer cliente real** |
| Reproductor multi-bloque de audio | Cierra el pendiente del audio largo |
| Quitar auto-registro · castrado Sí/No · perfil (país, ver contraseña) | Pulido de producto |

## 🔧 Salud técnica
- ✅ Compila limpio (API + frontend), arquitectura modular y escalable (~131 archivos API, ~226 frontend).
- ✅ Cobertura de pruebas amplia (≈453 backend + 343 frontend) + matriz de QA + harness de audio.
- ✅ Patrón Strangler Fig + multi-tenant V2 + IA con proveedores intercambiables (Gemini/OpenAI/Claude).

## ⚠️ Riesgos y pendientes
| Prioridad | Tema |
|---|---|
| ✅ Hecho | **API redesplegada** (rev. `vetia-api-00015`, 27-jun): fix de `max_tokens` 8192 del SOAP YA está en producción (consulta de 30 min OK). |
| 🟠 Pronto | Subir los commits locales a GitHub (respaldo). |
| 🟠 Pronto | **Rotar las API keys** (estuvieron en chats). |
| 🟡 Escala | Cola de IA **en memoria** → migrar a **Cloud Tasks** para varios vets simultáneos. |
| 🟡 Operación | Reauth de ADC recurrente (política de la org). |
| 🟡 Negocio | **Costo de IA** por consulta (STT + LLM) — vigilarlo al crecer clientes. |
| 🔵 Marketing | Conectar el **dominio propio** `vethosia.com`. |

## 🎯 Veredicto
**Va muy bien.** Ya hay un producto que un veterinario real usa de punta a punta, con el
primer cliente probándolo. Lo que sigue es menos "construir features" y más **endurecer para
producción**: redeploy de la API, respaldo en GitHub, plan de Cloud Tasks + monitoreo de costo
de IA, y rotar llaves.

---
*Generado el 2026-06-26 como foto del estado del proyecto.*
