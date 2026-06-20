import * as fs from 'fs';
import * as path from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, doc } from 'firebase/firestore';

// Tests de firestore.rules contra el emulador. Cubren: mismo tenant OK, otro tenant DENY,
// sin auth DENY, y permisos por rol (asistente no borra).
//
// REQUISITO: emulador de Firestore corriendo. En CI lo levanta el step de firebase emulators.
// En local: firebase emulators:start --only firestore  (y luego npm run test:rules).
// Si no hay emulador, este suite se salta solo (describe.skip) para no romper el typecheck/build.

const PROJECT_ID = 'vetia-rules-test';
const RULES_PATH = path.resolve(__dirname, '../../../firestore.rules');
const hayEmulador = !!process.env.FIRESTORE_EMULATOR_HOST;

const describeIf = hayEmulador ? describe : describe.skip;

describeIf('firestore.rules - aislamiento por tenant', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: fs.readFileSync(RULES_PATH, 'utf8') },
    });
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    // sembramos una consulta de orgA con datos de admin (Admin SDK se salta reglas).
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'consultas/c-orgA'), {
        orgId: 'orgA',
        veterinarioId: 'vetA',
        pacienteId: 'p1',
        estado: 'borrador',
      });
      await setDoc(doc(db, 'consultas/c-aprobada'), {
        orgId: 'orgA',
        veterinarioId: 'vetA',
        pacienteId: 'p1',
        estado: 'aprobada',
      });
      await setDoc(doc(db, 'pacientes/p-legacy'), {
        veterinarioId: 'vetLegacy',
        nombre: 'Firulais',
      });
      await setDoc(doc(db, 'planes/plan-pro'), { nombre: 'Pro', precioMensual: 99000 });
      await setDoc(doc(db, 'suscripciones/sub-orgA'), { orgId: 'orgA', estado: 'activa' });
      await setDoc(doc(db, 'auditoria/log1'), { orgId: 'orgA', accion: 'login', actorUid: 'vetA' });
      await setDoc(doc(db, 'vacunas/vac-orgA'), { orgId: 'orgA', veterinarioId: 'vetA', nombre: 'Rabia' });
      await setDoc(doc(db, 'citas/cita-orgA'), { orgId: 'orgA', veterinarioId: 'vetA', pacienteId: 'p1', estado: 'programada' });
      await setDoc(doc(db, 'notificaciones/n1'), { orgId: 'orgA', destinatarioUid: 'vetA', leida: false });
      await setDoc(doc(db, 'solicitudesTecnicas/sol-orgA'), {
        orgSolicitante: 'orgA',
        tipo: 'vinculacion_veterinario',
        estado: 'pendiente',
      });
    });
  });

  function ctxOrg(uid: string, orgId: string, rol: string) {
    return testEnv.authenticatedContext(uid, { orgId, rol });
  }

  it('mismo tenant: lee su consulta', async () => {
    const db = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertSucceeds(getDoc(doc(db, 'consultas/c-orgA')));
  });

  it('otro tenant: NO puede leer la consulta', async () => {
    const db = ctxOrg('vetB', 'orgB', 'admin').firestore();
    await assertFails(getDoc(doc(db, 'consultas/c-orgA')));
  });

  it('tenant con claims: create consulta sin orgId DENY', async () => {
    const db = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertFails(
      setDoc(doc(db, 'consultas/c-sin-org'), {
        pacienteId: 'p1',
        veterinarioId: 'vetA',
        estado: 'borrador',
      }),
    );
  });

  it('tenant con claims: create consulta con orgId correcto OK', async () => {
    const db = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'consultas/c-con-org'), {
        orgId: 'orgA',
        pacienteId: 'p1',
        veterinarioId: 'vetA',
        estado: 'borrador',
      }),
    );
  });

  it('sin auth: NO puede leer', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'consultas/c-orgA')));
  });

  it('usuario legacy (sin org) accede a su doc por veterinarioId', async () => {
    const db = testEnv.authenticatedContext('vetLegacy', {}).firestore();
    await assertSucceeds(getDoc(doc(db, 'pacientes/p-legacy')));
  });

  it('el contador HC NO es escribible desde el cliente', async () => {
    const db = ctxOrg('vetA', 'orgA', 'admin').firestore();
    await assertFails(setDoc(doc(db, 'configuracion/contadorHC_orgA'), { ultimo: 999 }));
  });

  it('asistente NO puede borrar una consulta de su org', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    const db = ctxOrg('asisA', 'orgA', 'asistente').firestore();
    await assertFails(deleteDoc(doc(db, 'consultas/c-orgA')));
  });

  it('admin SI puede borrar una consulta de su org', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    const db = ctxOrg('adminA', 'orgA', 'admin').firestore();
    await assertSucceeds(deleteDoc(doc(db, 'consultas/c-orgA')));
  });

  it('admin NO puede borrar consulta aprobada desde cliente: historia clinica inmutable', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    const db = ctxOrg('adminA', 'orgA', 'admin').firestore();
    await assertFails(deleteDoc(doc(db, 'consultas/c-aprobada')));
  });

  it('asistente NO puede borrar vacuna de su org', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    const db = ctxOrg('asisA', 'orgA', 'asistente').firestore();
    await assertFails(deleteDoc(doc(db, 'vacunas/vac-orgA')));
  });

  it('vet NO puede borrar vacuna de su org: historial se conserva por soft-delete API', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    const db = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertFails(deleteDoc(doc(db, 'vacunas/vac-orgA')));
  });

  it('otro tenant NO puede borrar vacuna ajena', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    const db = ctxOrg('vetB', 'orgB', 'admin').firestore();
    await assertFails(deleteDoc(doc(db, 'vacunas/vac-orgA')));
  });

  it('asistente NO puede borrar cita de su org', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    const db = ctxOrg('asisA', 'orgA', 'asistente').firestore();
    await assertFails(deleteDoc(doc(db, 'citas/cita-orgA')));
  });

  it('admin SI puede borrar cita de su org', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    const db = ctxOrg('adminA', 'orgA', 'admin').firestore();
    await assertSucceeds(deleteDoc(doc(db, 'citas/cita-orgA')));
  });

  it('otro tenant NO puede borrar cita ajena', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    const db = ctxOrg('vetB', 'orgB', 'vet').firestore();
    await assertFails(deleteDoc(doc(db, 'citas/cita-orgA')));
  });

  // ── colecciones nuevas del MVP ──
  it('planes: lectura permitida a logueado, escritura denegada al cliente', async () => {
    const db = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertSucceeds(getDoc(doc(db, 'planes/plan-pro')));
    await assertFails(setDoc(doc(db, 'planes/plan-pro'), { precioMensual: 1 }));
  });

  it('suscripciones: lee su org, otro tenant DENY, escritura cliente DENY', async () => {
    const propio = ctxOrg('adminA', 'orgA', 'admin').firestore();
    await assertSucceeds(getDoc(doc(propio, 'suscripciones/sub-orgA')));
    const ajeno = ctxOrg('adminB', 'orgB', 'admin').firestore();
    await assertFails(getDoc(doc(ajeno, 'suscripciones/sub-orgA')));
    await assertFails(setDoc(doc(propio, 'suscripciones/sub-orgA'), { estado: 'activa' }));
  });

  it('auditoria: admin de la org lee, vet NO, escritura cliente DENY', async () => {
    const admin = ctxOrg('adminA', 'orgA', 'admin').firestore();
    await assertSucceeds(getDoc(doc(admin, 'auditoria/log1')));
    const vet = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertFails(getDoc(doc(vet, 'auditoria/log1')));
    await assertFails(setDoc(doc(admin, 'auditoria/x'), { orgId: 'orgA' }));
  });

  it('notificaciones: el destinatario lee la suya; otro usuario NO', async () => {
    const dueno = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertSucceeds(getDoc(doc(dueno, 'notificaciones/n1')));
    const otro = ctxOrg('vetX', 'orgA', 'vet').firestore();
    await assertFails(getDoc(doc(otro, 'notificaciones/n1')));
  });

  it('solicitudesTecnicas: cliente no lee ni escribe; solo API/Admin SDK', async () => {
    const db = ctxOrg('adminA', 'orgA', 'admin').firestore();
    await assertFails(getDoc(doc(db, 'solicitudesTecnicas/sol-orgA')));
    await assertFails(
      setDoc(doc(db, 'solicitudesTecnicas/sol-nueva'), {
        orgSolicitante: 'orgA',
        estado: 'pendiente',
      }),
    );
  });

  it('usuario sin rol NO puede leer consultas', async () => {
    const db = testEnv.authenticatedContext('vetA', { orgId: 'orgA' }).firestore();
    await assertFails(getDoc(doc(db, 'consultas/c-orgA')));
  });

  it('cliente NO puede aprobar consulta cambiando estado a aprobada', async () => {
    const db = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertFails(
      setDoc(
        doc(db, 'consultas/c-orgA'),
        { orgId: 'orgA', veterinarioId: 'vetA', pacienteId: 'p1', estado: 'aprobada' },
        { merge: true },
      ),
    );
  });

  it('cliente NO puede editar consulta aprobada aunque conserve el estado', async () => {
    const db = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertFails(
      setDoc(
        doc(db, 'consultas/c-aprobada'),
        { motivo: 'edicion no permitida', estado: 'aprobada' },
        { merge: true },
      ),
    );
  });

  it('asistente NO puede aprobar consulta cambiando estado a aprobada', async () => {
    const db = ctxOrg('asisA', 'orgA', 'asistente').firestore();
    await assertFails(
      setDoc(
        doc(db, 'consultas/c-orgA'),
        { orgId: 'orgA', veterinarioId: 'asisA', pacienteId: 'p1', estado: 'aprobada' },
        { merge: true },
      ),
    );
  });

  it('veterinarios: otro usuario NO lee perfil ajeno', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'veterinarios/vetA'), { nombre: 'Vet A' });
    });
    const ajeno = ctxOrg('vetX', 'orgA', 'vet').firestore();
    await assertFails(getDoc(doc(ajeno, 'veterinarios/vetA')));
  });

  it('configuracion: vet NO puede leer contador HC', async () => {
    const db = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertFails(getDoc(doc(db, 'configuracion/contadorHC_orgA')));
  });

  it('notificaciones: update solo permite marcar leida', async () => {
    const db = ctxOrg('vetA', 'orgA', 'vet').firestore();
    await assertSucceeds(setDoc(doc(db, 'notificaciones/n1'), { leida: true }, { merge: true }));
    await assertFails(
      setDoc(doc(db, 'notificaciones/n1'), { titulo: 'hack' }, { merge: true }),
    );
  });

  it('superadmin lee recursos de cualquier tenant', async () => {
    const su = testEnv.authenticatedContext('root', { rol: 'superadmin' }).firestore();
    await assertSucceeds(getDoc(doc(su, 'consultas/c-orgA')));
    await assertSucceeds(getDoc(doc(su, 'suscripciones/sub-orgA')));
  });
});
