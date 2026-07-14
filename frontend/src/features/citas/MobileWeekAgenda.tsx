import React, { useMemo, useState } from 'react';
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale/es';
import { ChevronLeft, ChevronRight, Plus, Stethoscope } from 'lucide-react';
import type { Cita } from './api';

// Vista movil "a mano" (sin react-big-calendar): 7 columnas de semana/mes se leen mal en
// una pantalla angosta, y la libreria no ofrece un formato tipo Apple Calendar (circulos
// de dia + agenda cronologica debajo). Se construye directo con date-fns.

const ESTADO_COLOR: Record<Cita['estado'], string> = {
  programada: 'var(--info)',
  en_atencion: 'var(--warn)',
  realizada: 'var(--success)',
  cancelada: 'var(--muted)',
  no_asistio: 'var(--danger)',
};

const ESTADO_LABEL: Record<Cita['estado'], string> = {
  programada: 'Programada',
  en_atencion: 'En atención',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
};

const fechaCorta = (d: Date): string => format(d, "d 'de' MMMM", { locale: es });
const horaCorta = (iso: string): string => format(new Date(iso), 'HH:mm');

interface Props {
  citas: Cita[];
  onSelectCita: (c: Cita) => void;
  onSelectSlot: (start: Date) => void;
}

const MobileWeekAgenda: React.FC<Props> = ({ citas, onSelectCita, onSelectSlot }) => {
  const [modo, setModo] = useState<'semana' | 'mes'>('semana');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [cursorSemana, setCursorSemana] = useState(() => new Date());
  const [cursorMes, setCursorMes] = useState(() => new Date());

  const citasPorDia = useMemo(() => {
    const map = new Map<string, Cita[]>();
    for (const c of citas) {
      const key = format(new Date(c.fecha), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return map;
  }, [citas]);

  const citasDelDia = citasPorDia.get(format(selectedDate, 'yyyy-MM-dd')) ?? [];

  const diasSemana = useMemo(() => {
    const inicio = startOfWeek(cursorSemana, { weekStartsOn: 1 });
    const fin = endOfWeek(cursorSemana, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: inicio, end: fin });
  }, [cursorSemana]);

  const diasMes = useMemo(() => {
    const inicioMes = startOfMonth(cursorMes);
    const finMes = endOfMonth(cursorMes);
    const inicio = startOfWeek(inicioMes, { weekStartsOn: 1 });
    const fin = endOfWeek(finMes, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: inicio, end: fin });
  }, [cursorMes]);

  const seleccionarDia = (d: Date) => {
    setSelectedDate(d);
    if (modo === 'mes') setCursorMes(d);
    else setCursorSemana(d);
  };

  const irAHoy = () => {
    const hoy = new Date();
    setSelectedDate(hoy);
    setCursorSemana(hoy);
    setCursorMes(hoy);
  };

  return (
    <div className="space-y-3">
      {/* Encabezado: navegacion + toggle Semana/Mes, altura minima. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Periodo anterior"
            onClick={() => (modo === 'mes' ? setCursorMes((d) => subMonths(d, 1)) : setCursorSemana((d) => subWeeks(d, 1)))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-extrabold capitalize text-[var(--text)]">
            {format(modo === 'mes' ? cursorMes : cursorSemana, modo === 'mes' ? 'MMMM yyyy' : "'Sem.' d MMM", { locale: es })}
          </span>
          <button
            type="button"
            aria-label="Periodo siguiente"
            onClick={() => (modo === 'mes' ? setCursorMes((d) => addMonths(d, 1)) : setCursorSemana((d) => addWeeks(d, 1)))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={irAHoy}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-bold text-[var(--text)]"
          >
            Hoy
          </button>
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
            {(['semana', 'mes'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                aria-pressed={modo === m}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                  modo === m ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)]'
                }`}
              >
                {m === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {modo === 'semana' ? (
        /* Vista semana: circulos de dia estilo Apple Calendar, con puntos de eventos. */
        <div className="grid grid-cols-7 gap-1.5">
          {diasSemana.map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            const eventos = citasPorDia.get(key) ?? [];
            const seleccionado = isSameDay(d, selectedDate);
            return (
              <button
                key={key}
                type="button"
                onClick={() => seleccionarDia(d)}
                className="flex flex-col items-center gap-1 rounded-2xl py-2"
                style={{ background: seleccionado ? 'var(--accent-soft)' : undefined }}
              >
                <span className="text-[10px] font-bold uppercase text-[var(--muted)]">{format(d, 'EEEEE', { locale: es })}</span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                    seleccionado ? 'bg-[var(--accent)] text-white' : isToday(d) ? 'text-[var(--accent)]' : 'text-[var(--text)]'
                  }`}
                >
                  {format(d, 'd')}
                </span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {eventos.slice(0, 3).map((ev) => (
                    <span key={ev.id} className="h-1.5 w-1.5 rounded-full" style={{ background: ESTADO_COLOR[ev.estado] }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Vista mes: cuadricula compacta, solo numero + puntos (nunca nombres de eventos). */
        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[var(--muted)]">
            {diasSemana.map((d) => (
              <span key={d.toISOString()}>{format(d, 'EEEEE', { locale: es })}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {diasMes.map((d) => {
              const key = format(d, 'yyyy-MM-dd');
              const eventos = citasPorDia.get(key) ?? [];
              const seleccionado = isSameDay(d, selectedDate);
              const fueraDeMes = !isSameMonth(d, cursorMes);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => seleccionarDia(d)}
                  className="flex flex-col items-center gap-0.5 rounded-xl py-1.5"
                  style={{ background: seleccionado ? 'var(--accent-soft)' : undefined, opacity: fueraDeMes ? 0.35 : 1 }}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      seleccionado ? 'bg-[var(--accent)] text-white' : isToday(d) ? 'text-[var(--accent)]' : 'text-[var(--text)]'
                    }`}
                  >
                    {format(d, 'd')}
                  </span>
                  <span className="flex h-1.5 items-center gap-0.5">
                    {eventos.slice(0, 3).map((ev) => (
                      <span key={ev.id} className="h-1 w-1 rounded-full" style={{ background: ESTADO_COLOR[ev.estado] }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda cronologica del dia seleccionado. */}
      <div className="space-y-2 border-t border-[var(--border)] pt-3">
        <h3 className="text-xs font-extrabold capitalize text-[var(--text)]">{fechaCorta(selectedDate)}</h3>
        {citasDelDia.length === 0 ? (
          <button
            type="button"
            onClick={() => onSelectSlot(selectedDate)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] py-4 text-xs font-bold text-[var(--muted)]"
          >
            <Plus className="h-4 w-4" />
            Sin citas — agregar una
          </button>
        ) : (
          citasDelDia.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCita(c)}
              className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
              style={{ minHeight: 68 }}
            >
              <span className="h-full w-1 shrink-0 self-stretch rounded-full" style={{ background: ESTADO_COLOR[c.estado] }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold text-[var(--text)]">{horaCorta(c.fecha)}</span>
                  <span className="truncate text-sm font-bold text-[var(--text)]">{c.pacienteNombre ?? c.titulo}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  {c.propietarioNombre && <span className="truncate">{c.propietarioNombre}</span>}
                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: `color-mix(in srgb, ${ESTADO_COLOR[c.estado]} 14%, transparent)`, color: ESTADO_COLOR[c.estado] }}>
                    {ESTADO_LABEL[c.estado]}
                  </span>
                </div>
              </div>
              {c.estado === 'programada' && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <Stethoscope className="h-4 w-4" />
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default MobileWeekAgenda;
