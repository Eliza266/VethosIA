/**
 * Genera PDFs de prueba local (sin Firebase).
 * Uso:
 *   node api/scripts/generate-sample-pdf.mjs
 *   node api/scripts/generate-sample-pdf.mjs --fixture=hc000002-real
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

function parseFixtureArg() {
  const arg = process.argv.find((a) => a.startsWith('--fixture='));
  return arg?.split('=')[1] ?? 'sample';
}

function sampleRawDocs() {
  return {
    consulta: {
      numeroHC: 'HC-SAMPLE-001',
      motivo: 'Vómito y anorexia de 48 horas',
      prioridad: 'urgente',
      fechaHora: new Date('2024-11-20T10:00:00.000Z'),
      signosVitales: {
        peso: 8.5,
        talla: 32,
        temperatura: 39.2,
        frecuenciaCardiaca: 110,
        frecuenciaRespiratoria: 28,
        condicionCorporal: 4,
        mucosas: 'Pálidas, TRC 3 s',
        deshidratacion: 'Leve (5%)',
      },
      soap: {
        subjetivo:
          'Propietario refiere vómito en 4 ocasiones en las últimas 48 h, anorexia completa y letargia. No diarrea. Vacunas al día.',
        objetivo:
          'Paciente alerta pero decaído. Mucosas pálidas. Abdomen tenso en cuadrante craneal. Auscultación cardiopulmonar sin soplos.',
        analisis: 'Gastroenteritis aguda vs. cuerpo extraño. Deshidratación leve.',
        plan: 'Fluidoterapia SC, dieta blanda, omeprazol 1 mg/kg c/24h por 5 días. Control en 48 h.',
        medicamentosSugeridos: [
          {
            nombre: 'Omeprazol',
            dosis: '8.5 mg',
            via: 'VO',
            frecuencia: 'c/24h',
            duracion: '5 días',
            indicacion: 'Protección gástrica',
          },
        ],
      },
      transcripcion: 'El perro vomitó cuatro veces ayer y hoy no quiere comer nada.',
    },
    paciente: {
      codigo: 'PAC-000256',
      nombre: 'Max',
      especie: 'Canino',
      raza: 'Golden Retriever',
      sexo: 'macho',
      estadoReproductivo: 'castrado',
      fechaNacimiento: '2019-05-10',
      color: 'Dorado',
      chip: '985112000000042',
      propietario: {
        nombre: 'María González',
        telefono: '+57 300 555 1234',
        email: 'maria@email.com',
        whatsapp: '+57 300 555 1234',
      },
    },
    vet: {
      nombre: 'Dra. Carolina Ruiz',
      veterinaria: 'Vethosia Clínica Veterinaria',
      sede: 'Sede Chapinero',
      ciudad: 'Bogotá D.C.',
      telefono: '+57 601 555 0100',
      matriculaProfesional: 'MVZ-45678',
    },
    entidad: { nombre: 'Vethosia Clínica Veterinaria', ciudad: 'Bogotá D.C.' },
  };
}

function hc000002RealRawDocs() {
  const fixturePath = join(__dirname, '..', 'test', 'fixtures', 'hc000002-firulais.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  return {
    consulta: {
      ...fixture.consulta,
      fechaHora: new Date(fixture.consulta.fechaHora),
    },
    paciente: fixture.paciente,
    vet: fixture.vet,
    entidad: fixture.entidad,
  };
}

const FIXTURES = {
  sample: {
    outFile: 'HC_sample_redesign.pdf',
    build: sampleRawDocs,
  },
  'hc000002-real': {
    outFile: 'HC_HC000002_real_redesign.pdf',
    build: hc000002RealRawDocs,
  },
};

async function main() {
  const fixtureKey = parseFixtureArg();
  const fixture = FIXTURES[fixtureKey];
  if (!fixture) {
    console.error(`Fixture desconocido: ${fixtureKey}. Usa: sample | hc000002-real`);
    process.exit(1);
  }

  const outDir = join(__dirname, '..', '..', 'tmp');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, fixture.outFile);

  try {
    const { PdfService, countPdfPages } = require('../dist/modules/consultas/pdf.service');
    const svc = new PdfService({}, {}, {}, {});
    const { consulta, paciente, vet, entidad } = fixture.build();
    const modelo = svc.construirModelo(consulta, paciente, vet, entidad);
    const buffer = await svc['render'](modelo);
    writeFileSync(outPath, buffer);
    const pages = countPdfPages(buffer);
    console.log(`PDF generado: ${outPath} (${buffer.length} bytes, ${pages} páginas)`);
  } catch (err) {
    console.error('Ejecuta primero: cd api && npm run build');
    console.error(err);
    process.exit(1);
  }
}

main();
