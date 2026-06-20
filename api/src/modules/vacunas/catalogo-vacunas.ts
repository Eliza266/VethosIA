export type EspecieCatalogoVacuna = 'perro' | 'gato' | 'ave' | 'reptil' | 'otro';

export interface VacunaCatalogoBase {
  codigo: string;
  especie: EspecieCatalogoVacuna;
  nombre: string;
  intervaloDias?: number;
  descripcion: string;
}

export const CATALOGO_VACUNAS_BASE: VacunaCatalogoBase[] = [
  {
    codigo: 'perro-rabia',
    especie: 'perro',
    nombre: 'Rabia',
    intervaloDias: 365,
    descripcion: 'Refuerzo anual segun criterio medico y normativa local.',
  },
  {
    codigo: 'perro-polivalente',
    especie: 'perro',
    nombre: 'Polivalente canina',
    intervaloDias: 365,
    descripcion: 'Moquillo, parvovirus, adenovirus, parainfluenza y leptospira segun protocolo.',
  },
  {
    codigo: 'perro-tos-perreras',
    especie: 'perro',
    nombre: 'Tos de las perreras',
    intervaloDias: 365,
    descripcion: 'Bordetella/parainfluenza en pacientes con exposicion social.',
  },
  {
    codigo: 'perro-leptospirosis',
    especie: 'perro',
    nombre: 'Leptospirosis',
    intervaloDias: 365,
    descripcion: 'Refuerzo segun riesgo epidemiologico y criterio medico.',
  },
  {
    codigo: 'gato-rabia',
    especie: 'gato',
    nombre: 'Rabia',
    intervaloDias: 365,
    descripcion: 'Refuerzo anual segun criterio medico y normativa local.',
  },
  {
    codigo: 'gato-triple-felina',
    especie: 'gato',
    nombre: 'Triple felina',
    intervaloDias: 365,
    descripcion: 'Rinotraqueitis, calicivirus y panleucopenia.',
  },
  {
    codigo: 'gato-leucemia-felina',
    especie: 'gato',
    nombre: 'Leucemia felina',
    intervaloDias: 365,
    descripcion: 'Segun riesgo, test previo y criterio medico.',
  },
  {
    codigo: 'ave-newcastle',
    especie: 'ave',
    nombre: 'Newcastle',
    descripcion: 'Uso segun especie, zona, riesgo epidemiologico y normativa local.',
  },
  {
    codigo: 'reptil-no-rutina',
    especie: 'reptil',
    nombre: 'Sin esquema rutinario base',
    descripcion: 'No hay esquema universal; registrar solo indicaciones especificas.',
  },
];

export function buscarVacunaCatalogo(codigo?: string): VacunaCatalogoBase | undefined {
  if (!codigo) return undefined;
  return CATALOGO_VACUNAS_BASE.find((item) => item.codigo === codigo);
}

export function vacunasCatalogoPorEspecie(especie?: string): VacunaCatalogoBase[] {
  if (!especie || especie === 'otro') return [];
  return CATALOGO_VACUNAS_BASE.filter((item) => item.especie === especie);
}
