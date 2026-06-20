# Maquinas de estado y disparadores V2

Fuente funcional: PDF `Funcionalidades x rol.pdf`, paginas 5-8, 14-15, 23, 26-29.  
Fuente repo: `api/src/modules/citas/cita.types.ts`, `api/src/modules/consultas/consulta.types.ts`, `api/src/modules/consultas/consultas.service.ts`, `api/src/modules/saas/suscripcion.state.ts`, `api/src/modules/tenant/invitaciones.service.ts`, `api/src/modules/vacunas/vacuna.types.ts`, `api/src/modules/brigadas/brigada.types.ts`, `functions/index.js`.

## Limitacion de lectura del PDF

El PDF no tiene texto extraible por `pypdf`/`pdfplumber`; se renderizaron sus 29 paginas con `pypdfium2` y se revisaron visualmente. Las referencias de pagina son visuales.

## Cita

Estados PDF y repo:

| Estado PDF | Estado repo | Descripcion | Terminal |
|---|---|---|---|
| Programada | `programada` | Estado inicial. | No |
| En atencion | `en_atencion` | Se pulsa Atender y se crea/vincula consulta. | No |
| Realizada | `realizada` | Al aprobar SOAP se genera historia y cierra cita. | Si |
| Cancelada | `cancelada` | No se borra; queda en historial. | Si |
| No asistio | `no_asistio` | Afecta asistencia/no-show. | Si |

Transiciones permitidas actuales:

- `programada -> en_atencion | realizada | cancelada | no_asistio`
- `en_atencion -> realizada | cancelada | no_asistio`
- finales sin salida

Brecha: el PDF pide duracion de cita, recordatorio dia anterior y alerta dashboard proximas 2 horas. El repo valida estados y vinculo consulta, pero no evidencia scheduler de recordatorios.

## Consulta / SOAP

Estados PDF:

| Estado PDF | Estado repo | Descripcion |
|---|---|---|
| Captura audio | previo a consulta/procesamiento | El vet graba audio y signos vitales. |
| Procesando IA | `procesando` | Audio subido/inline, job IA en cola. |
| Borrador | `borrador` | Editable, no descuenta plan. |
| Error | `error` | IA fallo; audio se conserva para reintento. |
| Aprobado | `aprobada` | Inmutable, descuenta plan, genera historia. |
| Enmienda | doc `enmiendas` | Nueva consulta vinculada o correccion trazable. |
| PDF/envio | accion sobre aprobada | Exporta/descarga/envia; debe auditar canal. |

Reglas actuales:

- `prepararProcesamiento` bloquea IA si consumo llego al limite y audita `soap.inicio`.
- `IaService.encolarProcesamiento` marca `procesando`.
- Worker deja `borrador` si termina o `error` si falla.
- `aprobar` solo acepta `borrador`, descuenta consumo, audita `historia.aprobar`, propaga peso/talla y cierra cita.
- `actualizar` rechaza `estado: aprobada`; aprobadas son inmutables.
- `crearEnmienda` exige historia aprobada y audita.
- `PdfService` exige `estado === 'aprobada'`.

Brechas:

- Falta diagnostico estructurado normalizado de Fase 1.
- Falta auditoria diferenciada por canal de PDF: descarga, WhatsApp, correo.
- Falta registrar/consultar transiciones completas con `before/after`.

## Suscripcion

Estados PDF:

- Trial activo
- Activa
- Por vencer
- Vencida
- Bloqueada por mora

Estados repo:

- `trial_activa`
- `activa`
- `por_vencer`
- `vencida`
- `bloqueada_mora`
- `bloqueado_fin_trial`
- `desactivado`
- `cancelada`

Transiciones repo validas:

- `trial_activa -> activa | vencida | bloqueada_mora | bloqueado_fin_trial | desactivado | cancelada`
- `activa -> por_vencer | vencida | bloqueada_mora | desactivado | cancelada`
- `por_vencer -> activa | vencida | bloqueada_mora | desactivado | cancelada`
- `vencida -> activa | bloqueada_mora | desactivado | cancelada`
- `bloqueada_mora -> activa | desactivado | cancelada`
- `bloqueado_fin_trial -> activa | trial_activa | desactivado | cancelada`
- `desactivado -> activa | cancelada`
- `cancelada -> terminal`

Brechas:

- No hay evidencia de job temporal que marque "por vencer", "vencida", "bloqueada por mora" o "fin trial" segun fechas.
- Bloqueo por mora debe definir modulos en solo lectura y gates backend uniformes.
- Falta recibo y cartera de Fase 1.

## Invitacion / vinculo veterinario

Estados PDF:

- Invitacion activa/enviada
- Aceptada
- Cancelada
- Expirada
- Vinculado
- En evaluacion area tecnica
- Rechazada

Estado repo:

- Invitacion persistida con `exp`, `usadaEn`, `revocadaEn`.
- Aceptar asigna miembro y setea claims.
- Revocar cancela.
- Expirada se rechaza por validacion de fecha.

Brecha:

- Falta `en_evaluacion` y `rechazada` para correo ya existente/conflicto de plan.
- Falta distinguir vinculo a veterinaria vs entidad/freelance.
- Falta liberar asiento/desactivar con efecto documentado sobre pacientes e historias.

## Vacuna

Estados PDF y repo:

| Estado PDF | Estado repo | Regla |
|---|---|---|
| Al dia | `al_dia` | Sin proxima dosis o fecha mayor a ventana. |
| Proxima a vencer | `proxima` | Proxima dosis dentro de 30 dias. |
| Vencida | `vencida` | Proxima dosis pasada. |

Brechas:

- Falta catalogo base por especie con intervalo de revacunacion sugerido.
- Falta extension por cuenta.
- Falta job/resumen semanal de vacunas y badge de modulo.
- Falta marcar aplicada desde listado generando proxima dosis automaticamente.

## Brigada

Estados PDF y repo:

- `planificada`
- `en_curso`
- `finalizada`

Brechas:

- No se evidencia maquina de transiciones formal ni validacion de `planificada -> en_curso -> finalizada`.
- Falta registrar atenciones/consultas de la brigada para metricas de cobertura.
- Falta consolidado territorial/censo animal.

## Tabla de disparadores automaticos

| Evento | Efecto esperado PDF | Estado repo | Notificacion | Metricas | Auditoria | Consumo/plan | Riesgo legacy |
|---|---|---|---|---|---|---|---|
| Crear cita con paciente | `programada`, copia datos paciente/dueno, programa recordatorio. | Parcial en `CitasService.crear`; sin scheduler. | Falta | Citas | Falta evento cita | No | Firestore legacy podria crear sin nuevos campos. |
| Pulsar Atender | Crea consulta vinculada, cita `en_atencion`. | Existe en `Agenda.tsx` + `CitasService.vincularConsulta`. | No | Actividad | Falta evento especifico | No | Bajo |
| Cancelar/no asistio | Estado final, afecta asistencia. | Parcial, estados existen. | Opcional | No-show | Falta evento cita | No | Bajo |
| Finalizar grabacion | Sube audio, `procesando`, encola IA. | Existe via `/procesar` y `IaService`. | No | Tiempo IA futuro | `soap.inicio` | Gate antes de IA | Audio legacy puede subir directo. |
| IA termina/falla | `borrador` o `error`, audio guardado. | Existe. | Falta aviso error | SOAP/error | Falta evento error detallado | No descuento | Bajo |
| Guardar borrador | No descuenta, asociado al paciente. | Existe parcial. | No | Borradores | Falta `historia.editar_borrador` en algunas rutas | No | Firestore legacy puede editar. |
| Aprobar SOAP | Descuenta 1, genera HC, cierra cita, metricas, auditoria, revisa consumo. | Existe parcial. | 80/100% existe | Parcial | Existe `historia.aprobar` | Descuenta | Function legacy HC global. |
| Crear enmienda | Nueva vinculada; original no se edita. | Existe. | No | Historial | Existe | No | Bajo |
| Exportar/enviar PDF | PDF con logo/firma/matricula, registra canal. | Parcial. | Email puede enviar | Export count no | `pdf.exportar`, `email.historial` | No | Function email legacy. |
| Consumo 80% | Notifica vet y admins cadena. | Parcial al aprobar. | Existe para vet/admins org | Consumo | Falta evento propio | No | No cadena jerarquica. |
| Consumo 100% | Bloquea IA del vet/cuenta. | Parcial por `puedeGenerar`. | Existe | Consumo | Falta `cuenta.bloquear` por consumo | Bloquea IA | No cadena jerarquica. |
| Dia 1 del mes | Reinicia contador SOAP. | Existe por docId periodo, no job. | No | Consumo | No | Reinicio implicito | Documentar para soporte. |
| Webhook pago confirmado | Activa suscripcion, notifica, genera recibo. | Parcial, activa y notifica; no recibo. | Existe | Ingresos parcial | Falta pago detallado | Reactiva | No |
| Faltan 5 dias para vencer | Estado `por_vencer`, notifica. | Falta scheduler. | Falta | SaaS | Falta | Puede bloquear despues | No |
| Corte sin pago | `vencida`. | Falta scheduler. | Falta | SaaS | Falta | Restringe | No |
| 5 dias mora | `bloqueada`, solo lectura. | Falta scheduler/gate general. | Parcial si manual | SaaS | Parcial | Bloquea | Alto |
| Trial agotado sin contratar | Bloqueada fin trial. | Estado existe; scheduler falta. | Falta | SaaS | Parcial | Bloquea | Alto |
| Pago estando vencida/bloqueada | Reactiva cuenta. | Existe parcial por Wompi. | Existe | Ingresos | Falta pago completo | Desbloquea | Medio |
| Superadmin desactiva entidad | Bloquea veterinarios. | Parcial `setBloqueoMiembro`; no entidad completa. | Falta | Cuentas | Parcial | Bloquea | Alto |
| Crear/editar/eliminar paciente | Auditoria; eliminar soft delete. | Existe para API pacientes. | No | Pacientes | Existe | No | Firestore legacy puede variar. |
| Vacuna aplicada | Calcula proxima dosis por catalogo. | Parcial, estado por fecha; sin catalogo. | Falta | Vacunacion | Falta | No | Medio |
| Proxima/vencida | Resumen lunes, contador. | Falta scheduler. | Falta | Vacunacion | Falta | No | Medio |
| Invitar vet | Invitacion 48h o area tecnica. | Parcial, invitacion 48h; no area tecnica. | Invitacion aceptada | Asientos | Crear/aceptar/revocar | Ocupa asiento | Medio |
| Login/logout/inactividad | Auditoria y cierre sesion. | Inactividad front existe; auditoria login/logout falta. | No | Seguridad | Falta | No | Medio |
| Brigada inicia/finaliza | En curso/finalizada y consolida atenciones. | Parcial. | No | Cobertura | Falta | No | Bajo |

## Eventos que podrian duplicarse entre API y Functions legacy

| Flujo | API nueva | Function legacy | Riesgo |
|---|---|---|---|
| Numeracion HC | `POST /v1/consultas/:id/hc`, `contadorHC_{tenant}` | `generarNumeroHC`, `configuracion/contadorHC` global | Numeros no consecutivos por institucion si ambos caminos se usan. |
| Email historial | `POST /v1/consultas/:id/email` con PDF server-side | `enviarHistorialEmail` callable | Doble envio sin auditoria/canal uniforme. |
| PDF/docs | `PdfService` server-side y signed URL | Cliente/jsPDF legacy + Storage | PDF no oficial o sin tenant path. |
| CRUD clinico | `/v1` con Admin SDK + `assertAcceso` | Firestore directo por reglas | Reglas pueden permitir flujos legacy no auditados. |

## Reglas de implementacion

1. Toda transicion sensible debe vivir en un metodo de dominio testeado, no solo en UI.
2. Todo job automatico debe ser idempotente con clave de evento/periodo.
3. Todo bloqueo/desbloqueo debe registrar auditoria con actor `sistema` o `superadmin`.
4. Todo evento que afecte plan debe ser transaccional.
5. Toda notificacion debe incluir `resourceType` y `resourceId` para navegar al recurso.
