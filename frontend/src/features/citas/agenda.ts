// Logica pura de la agenda (vistas Dia/Semana/Mes). Separada de la UI para testear el
// agrupamiento sin montar el calendario.
export type VistaAgenda = 'dia' | 'semana' | 'mes';

export interface CitaLike {
  id: string;
  fecha: string; // ISO
  estado?: string;
}

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Inicio de semana (lunes) para la fecha dada.
export function inicioSemana(d: Date): Date {
  const date = new Date(d);
  const dia = (date.getDay() + 6) % 7; // 0 = lunes
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - dia);
  return date;
}

// Filtra las citas que caen dentro de la vista (dia/semana/mes) respecto a 'referencia'.
// Generico para preservar el tipo completo de la cita (titulo, etc.).
export function citasEnVista<T extends CitaLike>(citas: T[], vista: VistaAgenda, referencia: Date): T[] {
  return citas.filter((c) => {
    const f = new Date(c.fecha);
    if (Number.isNaN(f.getTime())) return false;
    if (vista === 'dia') return sameDay(f, referencia);
    if (vista === 'mes') {
      return f.getFullYear() === referencia.getFullYear() && f.getMonth() === referencia.getMonth();
    }
    // semana: [inicioSemana, +7d)
    const ini = inicioSemana(referencia);
    const fin = new Date(ini);
    fin.setDate(ini.getDate() + 7);
    return f >= ini && f < fin;
  });
}

// Agrupa por dia (clave YYYY-MM-DD) para pintar columnas/filas del calendario.
export function agruparPorDia<T extends CitaLike>(citas: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const c of citas) {
    const f = new Date(c.fecha);
    if (Number.isNaN(f.getTime())) continue;
    const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
    (out[clave] ??= []).push(c);
  }
  return out;
}
