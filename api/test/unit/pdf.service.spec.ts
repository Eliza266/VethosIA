import { BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';

// pdfkit arrastra fontkit (datos de fuentes) que jest no resuelve; lo mockeamos con un
// PDFDocument minimo que emite 'end' con un buffer. Asi probamos la logica, no el render real.
jest.mock('pdfkit', () => {
  const { EventEmitter } = jest.requireActual<typeof import('events')>('events');
  const chain = () => chainObj;
  const chainObj = {
    fillColor: chain,
    fontSize: chain,
    font: chain,
    text: chain,
    moveDown: chain,
    rect: chain,
    roundedRect: chain,
    circle: chain,
    fill: chain,
    stroke: chain,
    strokeColor: chain,
    lineWidth: chain,
    moveTo: chain,
    lineTo: chain,
    save: chain,
    restore: chain,
    addPage: chain,
    switchToPage: chain,
    heightOfString: () => 12,
    bufferedPageRange: () => ({ start: 0, count: 1 }),
  };
  return class FakePDFDocument extends EventEmitter {
    page = { width: 595, height: 842, margins: { top: 50, bottom: 70, left: 50, right: 50 } };
    fillColor = chain;
    fontSize = chain;
    font = chain;
    text = chain;
    moveDown = chain;
    rect = chain;
    roundedRect = chain;
    circle = chain;
    fill = chain;
    stroke = chain;
    strokeColor = chain;
    lineWidth = chain;
    moveTo = chain;
    lineTo = chain;
    save = chain;
    restore = chain;
    addPage = chain;
    switchToPage = chain;
    heightOfString = () => 12;
    bufferedPageRange = () => ({ start: 0, count: 1 });
    end() {
      setImmediate(() => {
        this.emit('data', Buffer.from('pdf'));
        this.emit('end');
      });
    }
  };
});

import { PdfService } from '../../src/modules/consultas/pdf.service';
import { ConsultasRepository } from '../../src/modules/consultas/consultas.repository';
import { StorageService } from '../../src/modules/storage/storage.service';
import { AuditoriaService } from '../../src/modules/plataforma/auditoria.service';
import { FirebaseService } from '../../src/common/firebase/firebase.service';
import { ConsultaDoc } from '../../src/modules/consultas/consulta.types';
import { AuthUser, AuthUserV2 } from '../../src/common/auth/auth-user.interface';

const user: AuthUser = { uid: 'u1', orgId: 'orgA', rol: 'vet' };
const otro: AuthUser = { uid: 'u2', orgId: 'orgB', rol: 'vet' };
const adminVeterinariaV2: AuthUserV2 = {
  uid: 'admin-vet-a',
  orgId: 'orgA',
  rol: 'admin',
  v: 2,
  role: 'admin_veterinaria',
  accountType: 'veterinaria',
  accountId: 'vetA',
  entidadId: 'entA',
  veterinariaId: 'vetA',
  membershipId: 'm-vet-a',
  planOwnerType: 'entidad',
  planOwnerId: 'entA',
};

const envSnapshot = { ...process.env };

function build(consulta: ConsultaDoc, extraDocs: Record<string, Record<string, unknown>> = {}) {
  const fbDocs: Record<string, Record<string, unknown>> = {
    [`consultas/${consulta.id}`]: {
      ...consulta,
      numeroHC: 'HC000010',
      motivo: 'tos',
      prioridad: 'urgente',
      fechaHora: new Date('2024-06-15T14:30:00.000Z'),
      signosVitales: {
        peso: 12,
        talla: 35,
        temperatura: 38.5,
        frecuenciaCardiaca: 90,
        mucosas: 'Rosadas, TRC < 2 s',
      },
      soap: {
        subjetivo: 'Tos seca desde hace 3 días',
        objetivo: 'Mucosas rosadas, auscultación normal',
        analisis: 'Traqueobronquitis leve',
        plan: 'Antitusígeno y control en 7 días',
        medicamentosSugeridos: [
          {
            nombre: 'Dextrometorfano',
            dosis: '5 mg',
            via: 'VO',
            frecuencia: 'c/12h',
            duracion: '5 días',
            indicacion: 'Tos',
          },
        ],
      },
      transcripcion: 'el perro tose',
      pacienteId: consulta.pacienteId,
    },
    'pacientes/p1': {
      codigo: 'PAC-000001',
      nombre: 'Rex',
      especie: 'Canino',
      raza: 'Mestizo',
      sexo: 'macho',
      estadoReproductivo: 'entero',
      color: 'Dorado',
      chip: '985112000000001',
      fechaNacimiento: '2020-03-15',
      propietario: { nombre: 'Ana', telefono: '300', email: 'ana@test.com' },
    },
    'veterinarios/admin-vet-a': {
      nombre: 'Admin Vet',
      veterinaria: 'VetSol',
      sede: 'Principal',
      ciudad: 'Bogota',
      telefono: '6011234567',
      matriculaProfesional: 'MVZ-ADMIN',
    },
    'veterinarios/u1': {
      nombre: 'Dra. Sol',
      veterinaria: 'VetSol',
      sede: 'Principal',
      ciudad: 'Bogotá',
      telefono: '6011234567',
      matriculaProfesional: 'MVZ-12345',
    },
    'organizaciones/orgA': { nombre: 'Clínica VetSol', ciudad: 'Bogotá' },
    ...extraDocs,
  };
  const query = (col: string, filtros: Array<[string, unknown]> = []) => ({
    where: (campo: string, _op: string, val: unknown) => query(col, [...filtros, [campo, val]]),
    get: async () => {
      const prefix = `${col}/`;
      const docs = Object.entries(fbDocs)
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, data]) => ({ id: path.slice(prefix.length), data: () => data }))
        .filter((doc) => filtros.every(([campo, val]) => doc.data()[campo] === val));
      return { docs };
    },
  });
  const firestore = {
    collection: (col: string) => ({
      doc: (id: string) => ({
        get: async () => ({ data: () => fbDocs[`${col}/${id}`] }),
      }),
      where: (campo: string, op: string, val: unknown) => query(col).where(campo, op, val),
    }),
  };
  const fb = { firestore } as unknown as FirebaseService;
  const repo = { getById: jest.fn(async () => ({ ...consulta })) } as unknown as ConsultasRepository;
  const storage = {
    subirBuffer: jest.fn(async () => undefined),
    signedUrl: jest.fn(async (path: string) => `https://signed/${path}`),
  } as unknown as StorageService;
  const auditoria = { registrar: jest.fn(async () => ({ id: 'log1' })) } as unknown as AuditoriaService;
  const notificaciones = { crear: jest.fn(async () => ({ id: 'n1' })) };
  return { svc: new PdfService(fb, storage, repo, auditoria, notificaciones as never), storage, auditoria, notificaciones };
}

describe('PdfService', () => {
  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it('construirModelo mapea las 16 secciones con datos reales y fallbacks No documentado', () => {
    const { svc } = build({ id: 'c1', estado: 'aprobada', pacienteId: 'p1', orgId: 'orgA' });
    const modelo = svc.construirModelo(
      {
        numeroHC: 'HC1',
        motivo: 'tos',
        prioridad: 'urgente',
        fechaHora: new Date('2024-06-15T14:30:00.000Z'),
        signosVitales: { peso: 12, mucosas: 'Rosadas' },
        soap: {
          subjetivo: 'Tos',
          objetivo: 'Normal',
          analisis: 'Traqueobronquitis',
          plan: 'Reposo',
          medicamentosSugeridos: [{ nombre: 'Jarabe', dosis: '5ml', via: 'VO', frecuencia: 'c/8h', duracion: '3d', indicacion: '' }],
        },
        diagnosticoEstructurado: [
          {
            id: 'd1',
            nombre: 'Traqueobronquitis infecciosa canina',
            tipo: 'principal',
            estado: 'presuntivo',
            sistema: 'respiratorio',
            origen: 'manual',
            creadoEn: '2026-06-18T00:00:00.000Z',
          },
        ],
        transcripcion: 't',
      },
      {
        codigo: 'PAC-1',
        nombre: 'Rex',
        especie: 'Canino',
        propietario: { nombre: 'Ana', telefono: '300' },
      },
      { nombre: 'Dra', matriculaProfesional: 'MVZ-1' },
      { nombre: 'Clínica X', ciudad: 'Medellín' },
    );

    expect(modelo.numeroHC).toBe('HC1');
    expect(modelo.entidad.nombre).toBe('Clínica X');
    expect(modelo.paciente.codigo).toBe('PAC-1');
    expect(modelo.anamnesis).toContain('Motivo de consulta: tos');
    expect(modelo.examenFisico.vitales[0]).toEqual({ label: 'Peso', value: '12 kg' });
    expect(modelo.revisionSistemas).toContain('Mucosas: Rosadas');
    expect(modelo.diagnosticos).toHaveLength(1);
    expect(modelo.diagnostico).toContain('Traqueobronquitis infecciosa canina');
    expect(modelo.diagnostico).toContain('Sistema: respiratorio');
    expect(modelo.medicamentos).toHaveLength(1);

    expect(modelo.examenesComplementarios).toBe('No documentado');
    expect(modelo.evolucion).toBe('No documentado');
  });

  it('construirModelo usa No documentado cuando faltan campos', () => {
    const { svc } = build({ id: 'c1', estado: 'aprobada', pacienteId: 'p1', orgId: 'orgA' });
    const modelo = svc.construirModelo({}, {}, {}, {});
    expect(modelo.propietario.nombre).toBe('No documentado');
    expect(modelo.soap.subjetivo).toBe('No documentado');
    expect(modelo.matricula).toBe('No documentado');
  });

  it('construirModelo usa analisis SOAP como fallback para consultas antiguas', () => {
    const { svc } = build({ id: 'c1', estado: 'aprobada', pacienteId: 'p1', orgId: 'orgA' });
    const modelo = svc.construirModelo(
      { soap: { analisis: 'Otitis externa probable' } },
      {},
      {},
      {},
    );
    expect(modelo.diagnosticos).toEqual([]);
    expect(modelo.diagnostico).toBe('Otitis externa probable');
  });

  it('construirModelo formatea Timestamp Firestore sin perder binding toDate', () => {
    const { svc } = build({ id: 'c1', estado: 'aprobada', pacienteId: 'p1', orgId: 'orgA' });
    const ts = admin.firestore.Timestamp.fromDate(new Date('2024-06-15T14:30:00.000Z'));
    const modelo = svc.construirModelo({ fechaHora: ts }, {}, {}, {});
    expect(modelo.fechaConsulta).not.toBe('No documentado');
    expect(modelo.fechaConsulta).toContain('2024');
  });

  it('construirModelo tolera fecha serializada {_seconds} y fechas ausentes', () => {
    const { svc } = build({ id: 'c1', estado: 'aprobada', pacienteId: 'p1', orgId: 'orgA' });
    const seconds = Math.floor(new Date('2023-01-10T08:00:00.000Z').getTime() / 1000);
    const conSeconds = svc.construirModelo({ creadoEn: { _seconds: seconds, _nanoseconds: 0 } }, {}, {}, {});
    expect(conSeconds.fechaConsulta).not.toBe('No documentado');

    const sinFecha = svc.construirModelo({}, {}, {}, {});
    expect(sinFecha.fechaConsulta).toBe('No documentado');
  });

  it('exporta aprobada en emulador: sube PDF y devuelve URL proxy /pdf/download', async () => {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.PORT = '8081';
    const { svc, storage, auditoria, notificaciones } = build({
      id: 'c1',
      estado: 'aprobada',
      pacienteId: 'p1',
      orgId: 'orgA',
      veterinarioId: 'u1',
    });
    const res = await svc.generar('c1', user);
    expect(res.url).toBe('http://127.0.0.1:8081/v1/consultas/c1/pdf/download');
    expect(storage.subirBuffer).toHaveBeenCalledWith(
      'historiales/orgA/c1.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(storage.signedUrl).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'pdf.exportar', recurso: 'c1' }),
    );
    expect(notificaciones.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'pdf_generado',
        resourceType: 'consulta',
        resourceId: 'c1',
        resourcePath: '/pacientes/p1/consultas/c1',
        pacienteId: 'p1',
        consultaId: 'c1',
        dedupeKey: 'pdf_generado:c1:u1',
      }),
    );
  });

  it('usa el logo/nombre de veterinarias/{id} (backoffice v2) por encima de organizaciones/{orgId} (legacy)', async () => {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const { svc, storage } = build(
        { id: 'c1', estado: 'aprobada', pacienteId: 'p1', orgId: 'orgA', veterinarioId: 'u1', veterinariaId: 'vetA' },
        {
          'veterinarias/vetA': {
            nombre: 'Clínica Demo',
            ciudad: 'Bucaramanga',
            telefono: '+57 3117652435',
            logoUrl: 'https://storage.test/logos-veterinaria/orgA/logo.png',
          },
        },
      );
      await svc.generar('c1', user);
      expect(fetchMock).toHaveBeenCalledWith('https://storage.test/logos-veterinaria/orgA/logo.png');
      expect(storage.subirBuffer).toHaveBeenCalledWith(
        'historiales/orgA/c1.pdf',
        expect.any(Buffer),
        'application/pdf',
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('exporta aprobada sin emulador: sube PDF y devuelve signed URL de Storage', async () => {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    const { svc, storage, auditoria } = build({
      id: 'c1',
      estado: 'aprobada',
      pacienteId: 'p1',
      orgId: 'orgA',
      veterinarioId: 'u1',
    });
    const res = await svc.generar('c1', user);
    expect(res.url).toContain('historiales/orgA/c1.pdf');
    expect(storage.subirBuffer).toHaveBeenCalledWith(
      'historiales/orgA/c1.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(storage.signedUrl).toHaveBeenCalledWith('historiales/orgA/c1.pdf');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'pdf.exportar', recurso: 'c1' }),
    );
  });

  it('historial completo solo incluye consultas aprobadas del scope clinico del paciente', async () => {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    const { svc, storage, auditoria } = build(
      {
        id: 'c-own',
        estado: 'aprobada',
        pacienteId: 'p1',
        orgId: 'orgA',
        veterinarioId: 'vet1',
        accountType: 'veterinaria',
        accountId: 'vetA',
        entidadId: 'entA',
        veterinariaId: 'vetA',
        planOwnerType: 'entidad',
        planOwnerId: 'entA',
      },
      {
        'pacientes/p1': {
          codigo: 'PAC-000001',
          nombre: 'Rex',
          orgId: 'orgA',
          veterinarioId: 'vet1',
          accountType: 'veterinaria',
          accountId: 'vetA',
          entidadId: 'entA',
          veterinariaId: 'vetA',
          planOwnerType: 'entidad',
          planOwnerId: 'entA',
          propietario: { nombre: 'Ana', telefono: '300', email: 'ana@test.com' },
        },
        'consultas/c-other-vet': {
          id: 'c-other-vet',
          estado: 'aprobada',
          pacienteId: 'p1',
          orgId: 'orgA',
          veterinarioId: 'vet2',
          accountType: 'veterinaria',
          accountId: 'vetB',
          entidadId: 'entA',
          veterinariaId: 'vetB',
          planOwnerType: 'entidad',
          planOwnerId: 'entA',
        },
        'consultas/c-draft': {
          id: 'c-draft',
          estado: 'borrador',
          pacienteId: 'p1',
          orgId: 'orgA',
          veterinarioId: 'vet1',
          accountType: 'veterinaria',
          accountId: 'vetA',
          entidadId: 'entA',
          veterinariaId: 'vetA',
        },
        'consultas/c-legacy-org-only': {
          id: 'c-legacy-org-only',
          estado: 'aprobada',
          pacienteId: 'p1',
          orgId: 'orgA',
          veterinarioId: 'vet1',
        },
      },
    );

    const res = await svc.generarHistorialCompleto('p1', adminVeterinariaV2);

    expect(res.url).toContain('historiales/orgA/paciente-p1.pdf');
    expect(storage.subirBuffer).toHaveBeenCalledWith(
      'historiales/orgA/paciente-p1.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'pdf.exportar',
        recurso: 'paciente:p1',
        meta: { historialCompleto: true, consultas: 1 },
      }),
    );
  });

  it('borrador NO es exportable', async () => {
    const { svc } = build({ id: 'c1', estado: 'borrador', pacienteId: 'p1', orgId: 'orgA', veterinarioId: 'u1' });
    await expect(svc.generar('c1', user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cross-tenant: no exporta consulta de otra org', async () => {
    const { svc } = build({ id: 'c1', estado: 'aprobada', pacienteId: 'p1', orgId: 'orgA', veterinarioId: 'u1' });
    await expect(svc.generar('c1', otro)).rejects.toThrow();
  });
});
