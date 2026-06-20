import { ForbiddenException } from '@nestjs/common';
import { ConsultasService } from '../../src/modules/consultas/consultas.service';
import { ConsultasRepository } from '../../src/modules/consultas/consultas.repository';
import { ConsumoService } from '../../src/modules/saas/consumo.service';
import { SuscripcionesService } from '../../src/modules/saas/suscripciones.service';
import { CitasService } from '../../src/modules/citas/citas.service';
import { AuthUser } from '../../src/common/auth/auth-user.interface';
import { ConsultaDoc } from '../../src/modules/consultas/consulta.types';
import { FakeFirestore } from './saas.fakes';
import { FirebaseService } from '../../src/common/firebase/firebase.service';

const user: AuthUser = { uid: 'u1', orgId: 'orgA', rol: 'vet' };

function firebaseSerial(fs: FakeFirestore): FirebaseService {
  return {
    firestore: {
      collection: fs.collection.bind(fs),
      runTransaction: fs.runTransactionSerial.bind(fs),
    },
  } as unknown as FirebaseService;
}

describe('ConsultasService.aprobar concurrencia', () => {
  it('N requests paralelos solo descuentan 1 consumo', async () => {
    const fs = new FakeFirestore();
    const fb = firebaseSerial(fs);
    const consulta: ConsultaDoc = {
      id: 'c1',
      orgId: 'orgA',
      veterinarioId: 'u1',
      pacienteId: 'p1',
      estado: 'borrador',
    };
    fs.store.set('consultas/c1', { ...consulta, signosVitales: {} });
    fs.store.set('pacientes/p1', { orgId: 'orgA' });

    const repo = {
      getById: async () => consulta,
      ref: (id: string) => fs.makeRef(`consultas/${id}`, id),
    } as unknown as ConsultasRepository;

    const consumo = new ConsumoService(fb);
    const subs = { limiteHistoriasMes: async () => 10 } as unknown as SuscripcionesService;
    const citas = {
      cerrarDesdeConsulta: jest.fn(),
      vincularConsulta: jest.fn(),
    } as unknown as CitasService;

    const svc = new ConsultasService(
      fb,
      repo,
      consumo,
      subs,
      { registrar: jest.fn().mockResolvedValue({ id: 'log' }) } as never,
      { crear: jest.fn(), notificarAdminsEntidad: jest.fn() } as never,
      citas,
    );

    const N = 20;
    const resultados = await Promise.all(Array.from({ length: N }, () => svc.aprobar('c1', user)));
    expect(resultados.every((r) => r.estado === 'aprobada')).toBe(true);

    const periodo = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    expect(fs.store.get(`consumos/orgA_${periodo}`)?.usados).toBe(1);
    expect(fs.store.get('consultas/c1')?.estado).toBe('aprobada');
  });
});

describe('SuscripcionesService cross-tenant', () => {
  it('admin de orgA no puede cambiar suscripcion de orgB', async () => {
    const fs = new FakeFirestore();
    const fb = { firestore: fs } as unknown as FirebaseService;
    fs.store.set('suscripciones/subB', { orgId: 'orgB', estado: 'activa', planId: 'p1' });
    const { SuscripcionesService } = await import('../../src/modules/saas/suscripciones.service');
    const svc = new SuscripcionesService(fb, { registrar: jest.fn() } as never);
    const adminA: AuthUser = { uid: 'a1', orgId: 'orgA', rol: 'admin' };
    await expect(svc.cambiarEstado('subB', 'desactivado', adminA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
