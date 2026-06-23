import React from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale/es';
import type { Cita } from './api';

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
}

export const CalendarioCitas: React.FC<CalendarioCitasProps> = ({
  citas,
  onSelectCita,
  onSelectSlot,
}) => {
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
    let backgroundColor = '#2563eb'; // programada
    switch (estado) {
      case 'programada':
        backgroundColor = '#2563eb';
        break;
      case 'en_atencion':
        backgroundColor = '#d97706';
        break;
      case 'realizada':
        backgroundColor = '#059669';
        break;
      case 'cancelada':
        backgroundColor = '#64748b';
        break;
      case 'no_asistio':
        backgroundColor = '#dc2626';
        break;
    }

    return {
      style: {
        backgroundColor,
        color: '#ffffff',
        borderRadius: '6px',
        border: 'none',
        display: 'block',
      },
    };
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '72vh' }}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        defaultView={Views.WEEK}
        messages={messages}
        culture="es"
        selectable={true}
        onSelectEvent={(event) => onSelectCita(event.resource)}
        onSelectSlot={(slotInfo) => onSelectSlot(slotInfo.start)}
        eventPropGetter={eventPropGetter}
      />
    </div>
  );
};

export default CalendarioCitas;
