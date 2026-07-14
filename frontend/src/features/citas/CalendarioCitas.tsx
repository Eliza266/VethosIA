import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, dateFnsLocalizer, Views, type View, type ViewsProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { Cita } from './api';
import MobileWeekAgenda from './MobileWeekAgenda';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendario.css';

const locales = {
  es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const messages = {
  today: 'Hoy',
  previous: 'Anterior',
  next: 'Siguiente',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Cita',
  noEventsInRange: 'Sin citas en este rango',
};

const VIEW_LABELS: Record<string, string> = {
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
};

interface RbcToolbarProps {
  label: string;
  view: View;
  views: ViewsProps<CalendarEvent, object>;
  onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void;
  onView: (view: View) => void;
}

interface ToolbarExtras {
  panelOpen: boolean;
  onTogglePanel: () => void;
  citasHoyCount: number;
}

/** Toolbar propia (reemplaza la de react-big-calendar) para unificar navegación de
 * fecha, selector de vista y el acceso al panel de citas de hoy en una sola franja. */
const CustomToolbar: React.FC<RbcToolbarProps & ToolbarExtras> = ({
  label,
  view,
  views,
  onNavigate,
  onView,
  panelOpen,
  onTogglePanel,
  citasHoyCount,
}) => {
  const viewList: View[] = Array.isArray(views) ? views : (Object.keys(views) as View[]);
  return (
  <div className="mb-3 flex flex-col gap-3 border-b border-[var(--border)] pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={() => onNavigate('TODAY')}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--text)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
      >
        Hoy
      </button>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Periodo anterior"
          onClick={() => onNavigate('PREV')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Periodo siguiente"
          onClick={() => onNavigate('NEXT')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <span className="truncate text-base font-extrabold capitalize text-[var(--text)]">{label}</span>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onTogglePanel}
        aria-pressed={panelOpen}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--text)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
      >
        {panelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">Citas de hoy</span>
        <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
          {citasHoyCount}
        </span>
      </button>

      <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
        {viewList.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            aria-pressed={view === v}
            className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${
              view === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {VIEW_LABELS[v] ?? v}
          </button>
        ))}
      </div>
    </div>
  </div>
  );
};

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Cita;
}

interface CalendarioCitasProps {
  citas: Cita[];
  onSelectCita: (c: Cita) => void;
  onSelectSlot: (start: Date) => void;
  citasHoyCount: number;
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export const CalendarioCitas: React.FC<CalendarioCitasProps> = ({
  citas,
  onSelectCita,
  onSelectSlot,
  citasHoyCount,
  panelOpen,
  onTogglePanel,
}) => {
  // Debajo de este ancho se usa MobileWeekAgenda (vista propia), no react-big-calendar:
  // 7 columnas de semana/mes no dan una experiencia usable en pantalla angosta.
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [view, setView] = useState<View>(Views.MONTH);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const availableViews = [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA];

  const ToolbarWithPanel = useCallback(
    (toolbarProps: RbcToolbarProps) => (
      <CustomToolbar {...toolbarProps} panelOpen={panelOpen} onTogglePanel={onTogglePanel} citasHoyCount={citasHoyCount} />
    ),
    [panelOpen, onTogglePanel, citasHoyCount]
  );

  const events: CalendarEvent[] = citas.map((cita) => {
    const startDate = new Date(cita.fecha);
    return {
      id: cita.id,
      title: cita.pacienteNombre ?? cita.titulo,
      start: startDate,
      end: new Date(startDate.getTime() + 30 * 60 * 1000), // +30 minutos
      resource: cita,
    };
  });

  const eventPropGetter = (event: CalendarEvent) => {
    const estado = event.resource.estado;
    // Color por estado desde tokens semánticos (coherente con los Badge de estado).
    let backgroundColor = 'var(--info)'; // programada
    switch (estado) {
      case 'programada':
        backgroundColor = 'var(--info)';
        break;
      case 'en_atencion':
        backgroundColor = 'var(--warn)';
        break;
      case 'realizada':
        backgroundColor = 'var(--success)';
        break;
      case 'cancelada':
        backgroundColor = 'var(--muted)';
        break;
      case 'no_asistio':
        backgroundColor = 'var(--danger)';
        break;
    }

    return {
      style: {
        backgroundColor,
        color: '#ffffff',
        borderRadius: 'var(--radius-xs)',
        border: 'none',
        display: 'block',
      },
    };
  };

  // En movil se reemplaza react-big-calendar por completo: 7 columnas (incluso solo Dia)
  // no dan una experiencia tipo Apple Calendar. MobileWeekAgenda es una vista propia con
  // circulos de dia + agenda cronologica, mas fiel a lo pedido para pantallas angostas.
  if (isNarrow) {
    return (
      <div
        className="p-3"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <MobileWeekAgenda citas={citas} onSelectCita={onSelectCita} onSelectSlot={onSelectSlot} />
      </div>
    );
  }

  return (
    <div
      className="p-3 sm:p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="overflow-x-auto">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '72vh', minWidth: 640 }}
          views={availableViews}
          view={view}
          onView={setView}
          messages={messages}
          culture="es"
          selectable={true}
          onSelectEvent={(event) => onSelectCita(event.resource)}
          onSelectSlot={(slotInfo) => onSelectSlot(slotInfo.start)}
          eventPropGetter={eventPropGetter}
          components={{ toolbar: ToolbarWithPanel }}
        />
      </div>
    </div>
  );
};

export default CalendarioCitas;
