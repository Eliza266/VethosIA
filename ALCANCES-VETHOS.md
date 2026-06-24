# Vethos AI — Alcances Generales

**Fecha de corte:** 2026-06-23 · **Ambiente:** `vethosia-5895b` (pruebas/producción)

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
🎙️ El vet graba la consulta (por voz, en bloques de hasta 15 min)
        ↓
🧠 La IA transcribe el audio a texto
        ↓
📋 La IA estructura la historia clínica en formato SOAP:
     Subjetivo · Objetivo · Análisis · Plan
     + signos vitales · diagnósticos · medicamentos sugeridos
        ↓
✏️ El vet revisa y edita (la IA propone, el profesional decide)
        ↓
✅ Aprueba la historia clínica
        ↓
📄 Genera el PDF  →  📧 lo envía por correo  /  📱 lo comparte por WhatsApp
```

Consultas de cualquier duración (20–45+ min) gracias a la **grabación por bloques**: avisa al
minuto 12, cierra el bloque al 15, y une todas las transcripciones en una sola historia.

---

## 3. Módulos y funcionalidades (a hoy)

| Módulo | Qué cubre |
|--------|-----------|
| **Pacientes** | Registro y ficha de mascotas (especie, raza, propietario), listado y métricas. |
| **Consultas / Historia Clínica** | Grabación por voz, SOAP automático, signos vitales, diagnóstico estructurado editable, medicamentos sugeridos, aprobación, PDF y envío. Historial por paciente. |
| **Agenda** | **Calendario tipo Google** (vistas mes / semana / día, navegable). Crear citas, vincular paciente, atender (abre la consulta), marcar realizada / cancelar. Métricas de agenda. |
| **Vacunas** | Carnet de vacunación por paciente, próximas dosis y estado. **Catálogo de vacunas** gestionable por cada veterinaria + desplegable para registrar rápido. Archivar vacunas. |
| **Brigadas** | Jornadas de atención en campo; las consultas hechas durante el día se **asocian a la brigada** activa. Consolidado de atenciones por brigada. |
| **Tablero / Métricas** | Indicadores por rol (consultas, pacientes, agenda, consumo de plan). |
| **Administración** | Gestión de entidades, veterinarias, planes y usuarios según el rol. |
| **Perfil** | Datos del profesional, foto, y configuración por rol. |

---

## 4. Inteligencia artificial — qué hace hoy

- **Transcripción (voz → texto):** motor primario **Gemini** (maneja audios largos), respaldo **OpenAI**. Conmutables.
- **Estructuración SOAP (texto → historia):** motor primario **Claude (Anthropic)**, respaldo Gemini.
- **Extrae automáticamente:** signos vitales numéricos (peso, temperatura, FC, FR, condición corporal), **diagnósticos** (principal y diferenciales) y **medicamentos** con dosis/vía/frecuencia.
- **Audio largo:** grabación en calidad de voz + **bloques de 15 min** unidos en una sola historia.
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
- **Envío por correo** (Gmail corporativo de la clínica).
- **Compartir por WhatsApp** (enlace al documento).

---

## 7. Infraestructura y escalabilidad

- **Firebase**: autenticación, base de datos (Firestore) y almacenamiento (audios, fotos, PDFs).
- **API en Cloud Run** (NestJS): escala según demanda; las claves de IA viven seguras en el servidor (nunca en el navegador).
- **Frontend** React + Vite (PWA, instalable, funciona en móvil).
- **Diseñado para crecer**: arquitectura por módulos, multi-tenant, planes y control de consumo de IA.

---

## 8. Estado de madurez a hoy

✅ **Funciona end-to-end** (probado): grabar → transcribir (IA real) → SOAP → editar → aprobar → PDF → enviar por correo.
✅ Calendario, catálogo de vacunas, brigadas, signos vitales y diagnóstico estructurado **operativos**.
✅ Multi-rol y aislamiento por veterinaria **verificados** (incl. pruebas automáticas).
✅ Desplegable a producción en el ambiente propio de Vethos (`vethosia-5895b`).

> Madurez: **MVP funcional y demostrable**, en fase de pruebas con veterinarios reales.

---

## 9. Alcances futuros / próximos pasos

- **Cola de IA robusta** (Cloud Tasks) para alto volumen simultáneo.
- **Reproductor multi-bloque** del audio de la consulta.
- **Dominio propio** `vethosia.com` conectado al sitio.
- **Catálogo clínico ampliado** (más vacunas/medicamentos por especie).
- **Versión oscura** de la interfaz (hoy en claro).
- **Reportería e indicadores** ampliados por entidad/veterinaria.
- **App móvil** dedicada (hoy PWA instalable).

---

*Vethos AI — historias clínicas veterinarias con IA: el vet habla, la plataforma documenta.*
