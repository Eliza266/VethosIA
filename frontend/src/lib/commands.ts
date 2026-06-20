// Command palette (Cmd/Ctrl+K): lista de comandos + filtro difuso simple. Puro y testeable.
export interface Comando {
  id: string;
  titulo: string;
  atajo?: string;
  ruta?: string;
  keywords?: string[];
}

const normaliza = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function filtrarComandos(comandos: Comando[], consulta: string): Comando[] {
  const q = normaliza(consulta.trim());
  if (!q) return comandos;
  return comandos.filter((c) => {
    const heno = normaliza([c.titulo, ...(c.keywords ?? [])].join(' '));
    // todas las palabras de la consulta deben aparecer (AND), en cualquier orden.
    return q.split(/\s+/).every((palabra) => heno.includes(palabra));
  });
}

export const COMANDOS_BASE: Comando[] = [
  { id: 'nuevo-paciente', titulo: 'Nuevo paciente', ruta: '/pacientes/nuevo', keywords: ['crear', 'mascota'] },
  { id: 'pacientes', titulo: 'Ver pacientes', ruta: '/pacientes', keywords: ['lista'] },
  { id: 'agenda', titulo: 'Ir a la agenda', ruta: '/agenda', keywords: ['citas', 'calendario'] },
  { id: 'dashboard', titulo: 'Ir al panel', ruta: '/', keywords: ['inicio', 'home'] },
  { id: 'como-funciona', titulo: 'Cómo funciona', ruta: '/como-funciona', keywords: ['ayuda', 'tour'] },
];
