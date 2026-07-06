# Vethos AI — Alcances Generales

**Fecha de corte:** 2026-07-06 · **Ambiente:** `vethosia-5895b` (pruebas/producción)

> Documento de alcances del producto a hoy: qué es Vethos AI, qué hace, qué módulos cubre,
> quién lo usa y en qué estado está. Pensado para alinear equipo, socios y decisiones.

---

## 1. Qué es Vethos AI

Plataforma clínica veterinaria con **inteligencia artificial** que convierte una consulta
hablada en una **historia clínica estructurada (SOAP)**, lista para revisar, aprobar, generar
en **PDF** y **enviar** al propietario. El objetivo: que el veterinario **dedique su tiempo al
paciente, no a escribir**, sin perder rigor ni trazabilidad clínica.

**Problema que resuelve:** la documentación clínica es lenta, inconsistente y se hace "después"
(o no se hace). Vethos la genera **mientras** se atiende, con calidad clínica y de forma uniforme.

---

## 2. El flujo estrella: consulta con IA

```
🔊 Antes de grabar, se informa (en voz) el aviso de consentimiento de datos
        ↓
🎙️ El vet graba la consulta (por voz, en bloques de hasta 20 min, con alerta sonora cerca del corte)
        ↓
🧠 La IA transcribe el audio a texto
        ↓
📋 La IA estructura la historia clínica en formato SOAP:
     Subjetivo · Objetivo · Análisis · Plan
     + signos vitales · diagnósticos · medicamentos sugeridos
     + datos de mascota/dueño detectados (si la consulta empezó sin elegir paciente)
        ↓
✏️ El vet revisa y edita (la IA propone, el profesional decide)
        ↓
✅ Aprueba la historia clínica
        ↓
📄 Genera el PDF  →  📧 lo envía por correo (PDF adjunto)  /  📱 lo comparte por WhatsApp
```

Consultas de cualquier duración (20–60+ min) gracias a la **grabación por bloques**: avisa
cerca del minuto 20, cierra el bloque, y une todas las transcripciones en una sola historia.
Incluso con la consulta ya aprobada en borrador, se pueden **agregar bloques de audio
adicionales** y la IA rehace el SOAP con todo el contenido.

**Consulta rápida (sin elegir paciente antes):** el vet puede empezar a grabar de una vez,
sin buscar primero la ficha de la mascota. La IA detecta en el audio el nombre de la mascota
y del propietario; si coincide con un paciente ya registrado, se ofrece vincular la consulta
a esa ficha (evita duplicados); si es una mascota nueva, se confirman los datos detectados
para crear la ficha definitiva.

---

## 3. Módulos y funcionalidades (a hoy)

| Módulo | Qué cubre |
|--------|-----------|
| **Pacientes** | Registro y ficha de mascotas (especie, raza, propietario con teléfono e indicativo de país por autocompletado), listado y métricas. |
| **Consultas / Historia Clínica** | Grabación por voz con consentimiento hablado y alerta sonora de cierre de bloque, SOAP automático, signos vitales, diagnóstico estructurado editable, medicamentos sugeridos, **exámenes complementarios en PDF con resumen por IA**, **consulta rápida sin paciente preseleccionado**, aprobación, PDF (adjunto en el correo) y envío. Historial por paciente. |
| **Agenda** | **Calendario tipo Google** (vistas mes / semana / día, navegable, adaptado a pantallas de celular). Crear citas, vincular paciente, atender (abre la consulta), marcar realizada / cancelar. Métricas de agenda. |
| **Vacunas** | Carnet de vacunación por paciente, próximas dosis y estado. **Catálogo de vacunas** gestionable por cada veterinaria + desplegable para registrar rápido. Archivar vacunas. |
| **Brigadas** | Jornadas de atención en campo; las consultas hechas durante el día se **asocian a la brigada** activa. Consolidado de atenciones por brigada. |
| **Tablero / Métricas** | Indicadores por rol (consultas, pacientes, agenda, consumo de plan). |
| **Administración** | Gestión de entidades, veterinarias, planes y usuarios según el rol. |
| **Perfil** | Datos del profesional, foto, y configuración por rol. |
| **Guías de uso** | Recorrido guiado ("¿Cómo funciona?") por cada pantalla del rol veterinario, se muestra automáticamente una vez y puede volver a abrirse con el botón de ayuda fijo en la esquina superior. |

---

## 4. Inteligencia artificial — qué hace hoy

- **Transcripción (voz → texto):** motor primario **Gemini** (maneja audios largos), respaldo **OpenAI**. Conmutables.
- **Estructuración SOAP (texto → historia):** motor primario **Claude (Anthropic)**, respaldo Gemini.
- **Extrae automáticamente:** signos vitales numéricos (peso, temperatura, FC, FR, condición corporal), **diagnósticos** (principal y diferenciales), **medicamentos** con dosis/vía/frecuencia, y **datos de mascota/dueño** cuando la consulta arrancó sin paciente preseleccionado.
- **Audio largo:** grabación en calidad de voz + **bloques de 20 min** (con alerta sonora previa al corte) unidos en una sola historia; se pueden agregar bloques nuevos incluso después de generado el primer SOAP.
- **Resumen de exámenes:** la IA lee un PDF de resultados de laboratorio/imágenes subido a la consulta y genera un resumen clínico.
- **La IA propone, el profesional valida:** todo es editable antes de aprobar. No reemplaza el criterio clínico.

---

## 5. Roles y modelo multi-organización

Vethos es **multi-tenant**: varias entidades y veterinarias conviven aisladas (cada quien ve
solo lo suyo). Control de acceso por roles:

| Rol | Alcance |
|-----|---------|
| **Super Admin** | Visión y administración global de la plataforma (entidades, veterinarias, planes, usuarios). |
| **Admin Entidad** | Administra su entidad y las veterinarias que dependen de ella. |
| **Admin Veterinaria** | Administra su veterinaria: usuarios, catálogo de vacunas, configuración. |
| **Veterinario** | Atiende: pacientes, consultas, agenda, vacunas, brigadas. |

- **Sin auto-registro:** los usuarios los provisiona un administrador (no hay "crear cuenta" abierto).
- **Whitelist de acceso:** solo los correos autorizados pueden iniciar sesión (candado adicional).
- **Aislamiento por veterinaria:** una clínica nunca ve los datos clínicos de otra.

---

## 6. Documentos y comunicación

- **PDF clínico** generado en el servidor (historia limpia, sin la transcripción cruda).
- **Envío por correo** (Gmail corporativo de la clínica), con el **PDF adjunto directamente**
  (no solo un enlace).
- **Compartir por WhatsApp** (enlace al documento).
- **Consentimiento de datos**: aviso hablado al iniciar cada grabación.

---

## 7. Infraestructura y escalabilidad

- **Firebase**: autenticación, base de datos (Firestore) y almacenamiento (audios, fotos, PDFs).
- **API en Cloud Run** (NestJS): escala según demanda; las claves de IA viven seguras en el servidor (nunca en el navegador).
- **Frontend** React + Vite (PWA, instalable, funciona en móvil).
- **Diseñado para crecer**: arquitectura por módulos, multi-tenant, planes y control de consumo de IA.

---

## 8. Estado de madurez a hoy

✅ **Funciona end-to-end** (probado): grabar → transcribir (IA real) → SOAP → editar → aprobar → PDF → enviar por correo.
✅ Calendario (incl. vista móvil), catálogo de vacunas, brigadas, signos vitales y diagnóstico estructurado **operativos**.
✅ Consulta rápida sin paciente preseleccionado, exámenes en PDF con resumen de IA y agregar bloques de audio a un borrador **operativos**.
✅ Guías de uso guiadas para el rol veterinario y marca visual **Vethos AI** (paleta e identidad propia) **aplicadas**.
✅ Multi-rol y aislamiento por veterinaria **verificados** (incl. pruebas automáticas).
✅ Desplegable a producción en el ambiente propio de Vethos (`vethosia-5895b`).

> Madurez: **MVP funcional y demostrable**, en fase de pruebas con veterinarios reales.

---

## 9. Alcances futuros / próximos pasos

- **Cola de IA robusta** (Cloud Tasks) para alto volumen simultáneo.
- **Plan de pagos parametrizable** (moneda base COP + USD para otros países), cobro desde la
  web y/o la app.
- **Dominio propio** `vethosia.com` conectado al sitio.
- **Catálogo clínico ampliado** (más vacunas/medicamentos por especie).
- **Versión oscura** de la interfaz (hoy en claro).
- **Reportería e indicadores** ampliados por entidad/veterinaria.
- **App móvil** dedicada (hoy PWA instalable).

---

*Vethos AI — historias clínicas veterinarias con IA: el vet habla, la plataforma documenta.*
