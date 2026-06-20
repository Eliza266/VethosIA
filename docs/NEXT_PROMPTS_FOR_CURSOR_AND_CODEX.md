# Prompts siguientes para Cursor y Codex

Usar estos prompts despues de revisar `docs/SCOPE_V2_GAP_ANALYSIS.md`, `docs/RBAC_TENANT_MODEL_V2.md`, `docs/STATE_MACHINES_AND_TRIGGERS_V2.md` y `docs/IMPLEMENTATION_ROADMAP_V2.md`.

## Prompts para Codex/GPT alto razonamiento

### Prompt 1 - ADR RBAC y tenant jerarquico V2

Objetivo: definir el modelo tecnico para entidad, veterinaria, veterinario freelance e independiente sin implementar codigo.

Archivos objetivo:

- `docs/ADR/ADR-0006-rbac-tenant-v2.md`
- `docs/DATA-MODEL.md`
- `docs/qa/matriz.md`

Limites:

- No modificar codigo de aplicacion.
- No tocar `.env`.
- No cambiar reglas aun.

Verificacion esperada:

- El ADR responde como migrar desde `organizaciones/{orgId}` plano.
- Incluye roles, claims, colecciones, indices, reglas y rollback.
- Incluye matriz de casos cross-tenant.

Comandos a correr:

```powershell
git diff -- docs
```

Resultado esperado:

- Documentos listos para implementar Fase 0.

Riesgo: Alto.  
Agente recomendado: Codex.

### Prompt 2 - Migracion y tests RBAC V2

Objetivo: implementar la base de roles/scope V2 con tests negativos antes de UI.

Archivos objetivo:

- `api/src/common/auth/access.ts`
- `api/src/common/auth/auth-user.interface.ts`
- `firestore.rules`
- `api/test/unit/access.spec.ts`
- `api/test/rules/firestore.rules.spec.ts`
- `docs/qa/matriz.md`

Limites:

- No cambiar UI salvo tipos minimos si compila.
- No retirar fallback legacy sin inventario.
- No modificar secretos.

Verificacion esperada:

- Admin Veterinaria no ve sedes hermanas.
- Admin Entidad ve consolidado de su entidad.
- Vet freelance no ve clinicas no vinculadas.
- Superadmin solo cruza tenants en endpoints declarados.

Comandos a correr:

```powershell
cd api ; npm run test:unit -- access --runInBand
cd api ; npm run test:rules -- --runInBand
cd api ; npm run build
```

Resultado esperado:

- Tests nuevos fallan antes de implementar y pasan despues.

Riesgo: Alto.  
Agente recomendado: Codex.

### Prompt 3 - Catalogo base de vacunas

Objetivo: implementar catalogo base por especie, extensible por cuenta, y calculo de proxima dosis.

Archivos objetivo:

- `api/src/modules/vacunas/*`
- `api/src/common/firebase/collections.ts`
- `api/test/unit/vacunas.service.spec.ts`
- `frontend/src/features/vacunas/*`
- `docs/qa/matriz.md`

Limites:

- No implementar recordatorios al propietario.
- No cambiar el modelo de pacientes salvo referencia necesaria.
- No crear claves en frontend.

Verificacion esperada:

- Al registrar vacuna desde catalogo se sugiere proxima dosis.
- Catalogo base no es editable por vet; extensiones por cuenta si.
- Estado `al_dia/proxima/vencida` sigue calculado.

Comandos a correr:

```powershell
cd api ; npm run test:unit -- vacunas --runInBand
cd frontend ; npm run test:run -- vacunas
cd frontend ; npm run typecheck
```

Resultado esperado:

- Vacunas Fase 1 listas con tests.

Riesgo: Medio.  
Agente recomendado: Codex.

### Prompt 4 - Cobros livianos Fase 1

Objetivo: agregar cartera por antiguedad y recibo sobre la base Wompi existente.

Archivos objetivo:

- `api/src/modules/saas/*`
- `api/test/unit/wompi.service.spec.ts`
- `api/test/unit/suscripciones.service.spec.ts`
- `frontend/src/pages/Suscripcion.tsx`
- `frontend/src/features/saas/api.ts`
- `docs/qa/matriz.md`

Limites:

- No implementar DIAN.
- No implementar MRR/dunning automatico.
- El monto lo calcula siempre backend.

Verificacion esperada:

- Webhook aprobado activa suscripcion y genera recibo.
- Firma invalida no cambia estado.
- Idempotencia evita recibo duplicado.
- Cartera clasifica al dia, 1-30, 31-60, +60.

Comandos a correr:

```powershell
cd api ; npm run test:unit -- wompi --runInBand
cd api ; npm run test:unit -- suscripciones --runInBand
cd frontend ; npm run typecheck
```

Resultado esperado:

- Cobros livianos de Fase 1 operables.

Riesgo: Alto.  
Agente recomendado: Codex.

### Prompt 5 - Jobs de Sistema idempotentes

Objetivo: implementar procesos automaticos de suscripcion, citas y vacunas sin duplicar eventos.

Archivos objetivo:

- `api/src/modules/plataforma/*`
- `api/src/modules/saas/*`
- `api/src/modules/citas/*`
- `api/src/modules/vacunas/*`
- `api/test/unit/*`
- `docs/qa/matriz.md`

Limites:

- No enviar WhatsApp/SMS automaticos en Fase 1.
- No depender de cron sin idempotencia.
- No bloquear descarga de historicos salvo decision documentada.

Verificacion esperada:

- Por vencer/vencida/bloqueada se calculan por fecha.
- Recordatorio cita dia anterior y proximas 2h no duplica.
- Resumen lunes de vacunas proximas/vencidas no duplica.

Comandos a correr:

```powershell
cd api ; npm run test:unit -- --runInBand
cd api ; npm run build
```

Resultado esperado:

- Sistema cubre automatismos Fase 1 internos.

Riesgo: Alto.  
Agente recomendado: Codex.

## Prompts para Cursor Composer 2.5 Fast

### Prompt 6 - Fix contrato checkout frontend

Objetivo: corregir la pantalla de suscripcion para llamar `/v1/pagos/checkout` con `{ planId, ciclo }`, no con `{ reference, amountInCents }`.

Archivos objetivo:

- `frontend/src/features/saas/api.ts`
- `frontend/src/pages/Suscripcion.tsx`
- `frontend/src/features/saas/api.test.ts` si existe o crear test cercano.

Limites:

- No tocar backend.
- No calcular monto en cliente.
- No implementar widget Wompi real si no existe script cargado.

Verificacion esperada:

- Typecheck pasa.
- Test confirma payload `{ planId, ciclo }`.
- UI permite elegir plan/ciclo solo con planes del backend.

Comandos a correr:

```powershell
cd frontend ; npm run typecheck
cd frontend ; npm run test:run -- saas
```

Resultado esperado:

- Pantalla lista para usar el checkout seguro del backend.

Riesgo: Medio.  
Agente recomendado: Cursor.

### Prompt 7 - Perfil via `/v1/me`

Objetivo: migrar `Perfil.tsx` para no escribir Firestore directo cuando `VITE_USE_API_CRUD=true`.

Archivos objetivo:

- `frontend/src/pages/Perfil.tsx`
- `frontend/src/features/tenant/api.ts`
- `frontend/src/features/tenant/hooks.ts`
- tests relacionados.

Limites:

- No tocar reglas ni backend salvo tipos minimos ya existentes.
- No editar email.
- No cambiar auth flow.

Verificacion esperada:

- Perfil lee y actualiza por `/v1/me`.
- Email se muestra como no editable.
- Matricula profesional alimenta PDF.

Comandos a correr:

```powershell
cd frontend ; npm run test:run -- tenant
cd frontend ; npm run typecheck
```

Resultado esperado:

- Perfil alineado con regla frontend solo `/v1`.

Riesgo: Medio.  
Agente recomendado: Cursor.

### Prompt 8 - UI evolucion del paciente

Objetivo: mostrar evolucion basica del paciente con peso/talla/constantes ya persistidas.

Archivos objetivo:

- `frontend/src/pages/DetallePaciente.tsx`
- `frontend/src/features/consultas/*`
- `frontend/src/components/*` si aplica.

Limites:

- No implementar resumen IA.
- No cambiar backend si los datos ya estan disponibles.
- No inventar datos faltantes.

Verificacion esperada:

- La ficha muestra ultimo peso/talla y tendencia si hay varias consultas.
- Empty state profesional si no hay constantes.

Comandos a correr:

```powershell
cd frontend ; npm run test:run -- DetallePaciente
cd frontend ; npm run typecheck
```

Resultado esperado:

- Fase 1 cubre evolucion visible sin IA.

Riesgo: Bajo.  
Agente recomendado: Cursor.

### Prompt 9 - Auditoria UI Super Admin

Objetivo: crear una vista simple de logs de auditoria con filtros basicos.

Archivos objetivo:

- `frontend/src/pages/SuperAdmin.tsx`
- `frontend/src/features/auditoria/api.ts` nuevo si aplica.
- `api/src/modules/plataforma/plataforma.controller.ts` solo si faltan query params en tarea Codex previa.

Limites:

- No permitir editar/borrar logs.
- No mostrar datos cross-tenant a roles no superadmin/admin.
- No cambiar schema de auditoria en esta tarea si no esta pedido.

Verificacion esperada:

- Tabla solo lectura.
- Filtros por accion/usuario/rango si backend ya lo soporta; si no, dejar UI preparada y documentar pendiente.

Comandos a correr:

```powershell
cd frontend ; npm run test:run -- SuperAdmin
cd frontend ; npm run typecheck
```

Resultado esperado:

- Super Admin puede inspeccionar auditoria basica.

Riesgo: Medio.  
Agente recomendado: Cursor.

### Prompt 10 - Dashboard widgets por rol

Objetivo: completar widgets faltantes usando endpoints existentes o mocks MSW.

Archivos objetivo:

- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/features/metricas/*`
- `frontend/src/features/notificaciones/*`
- tests del dashboard.

Limites:

- No crear metricas backend nuevas.
- No leer Firestore directo.
- No implementar mapas ni MRR.

Verificacion esperada:

- Vet ve consumo, vacunas pendientes, citas hoy/proximas 2h, ultimas SOAP.
- Admin ve widgets consolidados que el endpoint permita.
- Empty/loading/error states.

Comandos a correr:

```powershell
cd frontend ; npm run test:run -- Dashboard
cd frontend ; npm run typecheck
```

Resultado esperado:

- Dashboard mas alineado con PDF sin tocar dominio.

Riesgo: Bajo.  
Agente recomendado: Cursor.
