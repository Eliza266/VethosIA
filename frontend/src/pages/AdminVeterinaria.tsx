import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CreditCard, Stethoscope, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe } from '../features/tenant/hooks';
import { crearInvitacionVeterinaria, listarSolicitudesTecnicas } from '../features/tenant/api';
import {
  actualizarVeterinariaBackoffice,
  listarConsumosBackoffice,
  listarVeterinariosBackoffice,
  obtenerVeterinariaBackoffice,
  setBloqueoMiembroBackoffice,
} from '../features/backoffice/api';
import { MetricsPanel } from '../features/metricas/MetricsPanel';
import { BusinessOverview } from '../features/saas/BusinessOverview';
import { Button, Card, EmptyState, SectionHeader } from '../components/ui/Primitives';
import { puedeVerSuscripcion, rolLabel } from '../lib/rbac';
import { getErrorMessage } from '../lib/errors';
import { DEMO_ACTION_HINT, isDemoSession } from '../lib/demoSession';

const acciones = [
  {
    titulo: 'Pacientes de la veterinaria',
    descripcion: 'Historias, propietarios y seguimiento clínico de la sede.',
    to: '/pacientes',
    icon: Users,
  },
  {
    titulo: 'Agenda operativa',
    descripcion: 'Citas, estados y atenciones programadas del equipo.',
    to: '/agenda',
    icon: Calendar,
  },
  {
    titulo: 'Equipo clínico',
    descripcion: 'Gestión de miembros vinculados a la veterinaria.',
    to: '/veterinaria',
    icon: Stethoscope,
  },
  {
    titulo: 'Consumo y plan',
    descripcion: 'Uso de IA, cupos y estado de la suscripción heredada o propia.',
    to: '/suscripcion',
    icon: CreditCard,
  },
];

const veterinariaFormInicial = {
  nombre: '',
  direccion: '',
  ciudad: '',
  pais: '',
  telefono: '',
  emailContacto: '',
  logoUrl: '',
};

const AdminVeterinaria: React.FC = () => {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const accionesVisibles = acciones.filter((accion) => accion.to !== '/suscripcion' || puedeVerSuscripcion(me ?? null));
  const rol = me?.role ?? me?.rol ?? null;
  const demoSession = isDemoSession(me ?? null);
  const [email, setEmail] = useState('');
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState('');
  const [formVeterinaria, setFormVeterinaria] = useState(veterinariaFormInicial);
  const scopeListo = Boolean(me?.orgId || me?.veterinariaId || me?.accountId);

  const veterinaria = useQuery({
    queryKey: ['backoffice-veterinaria', me?.veterinariaId ?? me?.accountId],
    queryFn: obtenerVeterinariaBackoffice,
    enabled: scopeListo,
  });
  const veterinarios = useQuery({
    queryKey: ['backoffice-veterinarios', me?.veterinariaId ?? me?.accountId],
    queryFn: listarVeterinariosBackoffice,
    enabled: scopeListo,
  });
  const consumos = useQuery({
    queryKey: ['backoffice-consumos', me?.veterinariaId ?? me?.accountId],
    queryFn: listarConsumosBackoffice,
    enabled: scopeListo,
  });
  const solicitudes = useQuery({
    queryKey: ['solicitudes-tecnicas', me?.orgId, me?.veterinariaId],
    queryFn: () => listarSolicitudesTecnicas(),
    enabled: !!me?.orgId,
  });

  React.useEffect(() => {
    const data = veterinaria.data;
    if (!data) return;
    setFormVeterinaria({
      nombre: data.nombre ?? '',
      direccion: data.direccion ?? '',
      ciudad: data.ciudad ?? '',
      pais: data.pais ?? '',
      telefono: data.telefono ?? '',
      emailContacto: data.emailContacto ?? '',
      logoUrl: data.logoUrl ?? '',
    });
  }, [veterinaria.data]);

  const consumoItems = consumos.data ?? [];
  const consumoIndividualItems = consumoItems.filter(esConsumoIndividual);
  const consumoConsolidadoItems = consumoItems.filter((item) => !esConsumoIndividual(item));
  const consumoResumenItems =
    consumoConsolidadoItems.length > 0
      ? consumoConsolidadoItems
      : consumoIndividualItems.length > 0
        ? consumoIndividualItems
        : consumoItems;
  const consumoListadoItems = consumoIndividualItems.length > 0 ? consumoIndividualItems : consumoItems;
  const consumoUsadoTotal = consumoResumenItems.reduce((total, item) => total + item.usados, 0);
  const consumoLimiteTotal = consumoResumenItems.reduce(
    (total, item) => total + (typeof item.limite === 'number' ? item.limite : 0),
    0,
  );
  const equipoTotal = (veterinarios.data ?? []).length;

  const actualizarVeterinaria = useMutation({
    mutationFn: () => {
      if (!veterinaria.data?.id) {
        throw new Error('No hay veterinaria activa para actualizar.');
      }
      return actualizarVeterinariaBackoffice(veterinaria.data.id, {
        nombre: formVeterinaria.nombre.trim(),
        direccion: campoOpcional(formVeterinaria.direccion),
        ciudad: campoOpcional(formVeterinaria.ciudad),
        pais: campoOpcional(formVeterinaria.pais),
        telefono: campoOpcional(formVeterinaria.telefono),
        emailContacto: campoOpcional(formVeterinaria.emailContacto),
        logoUrl: campoOpcional(formVeterinaria.logoUrl),
      });
    },
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['backoffice-veterinaria'] });
    },
    onError: (e) => setError(getErrorMessage(e, 'No se pudo actualizar la veterinaria.')),
  });

  const bloqueo = useMutation({
    mutationFn: (v: { id: string; bloqueado: boolean }) => setBloqueoMiembroBackoffice(v.id, v.bloqueado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backoffice-veterinarios'] }),
    onError: (e) => setError(getErrorMessage(e, 'No se pudo cambiar el estado del miembro.')),
  });

  const invitarVeterinario = useMutation({
    mutationFn: () => {
      if (!me?.veterinariaId) {
        throw new Error('Tu perfil no tiene veterinariaId asignado.');
      }
      return crearInvitacionVeterinaria({
        email,
        veterinariaId: me.veterinariaId,
        orgId: me.orgId,
        entidadId: me.entidadId,
        planOwnerType: me.planOwnerType === 'entidad' || me.planOwnerType === 'veterinaria' ? me.planOwnerType : null,
        planOwnerId: me.planOwnerId,
      });
    },
    onSuccess: (res) => {
      setEnlace(`${window.location.origin}/invitacion?token=${res.token}`);
      setEmail('');
      setError('');
    },
    onError: (e) => setError(getErrorMessage(e, 'No se pudo crear la invitación.')),
  });

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <section className="command-hero p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <span className="inline-flex rounded-full border border-white/15 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">
              {rolLabel(rol) ?? 'Admin veterinaria'}
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Mi veterinaria</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
              Gestiona sede, equipo clínico, consumo IA y flujo operativo diario desde una consola ejecutiva.
            </p>
          </div>
          <div className="grid min-w-[min(100%,520px)] grid-cols-3 gap-3">
            <div className="command-panel-dark p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Equipo</p>
              <strong className="mt-1 block text-2xl font-black text-white">{equipoTotal}</strong>
            </div>
            <div className="command-panel-dark p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Consumo</p>
              <strong className="mt-1 block text-2xl font-black text-white">
                {consumoUsadoTotal}{consumoLimiteTotal > 0 ? `/${consumoLimiteTotal}` : ''}
              </strong>
            </div>
            <div className="command-panel-dark p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Solicitudes</p>
              <strong className="mt-1 block text-2xl font-black text-white">{(solicitudes.data ?? []).length}</strong>
            </div>
          </div>
        </div>
      </section>

      {demoSession && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {DEMO_ACTION_HINT}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <MetricsPanel rol={rol} />
        <BusinessOverview rol={rol} profile={me ?? null} />
      </section>

      <Card className="premium-card">
        <SectionHeader
          title="Operación de clínica"
          description="Ficha, equipo, consumo e invitaciones quedan separados para administrar la sede sin mezclar acciones."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ['Ficha', 'Datos públicos y contacto.'],
            ['Equipo', 'Veterinarios vinculados.'],
            ['Consumo', 'Uso IA por veterinario.'],
            ['Solicitudes', 'Revisión técnica controlada.'],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-sm font-black text-[var(--text)]">{title}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{copy}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="premium-card">
        <SectionHeader
          title="Datos de clínica"
          description="Información básica de la veterinaria asociada a tu cuenta."
          action={veterinaria.data ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{veterinaria.data.estado}</span> : null}
        />
        {veterinaria.isError && (
          <p role="alert" className="mt-2 text-sm text-red-600">No se pudo cargar la veterinaria.</p>
        )}
        {!veterinaria.isLoading && !veterinaria.data && !veterinaria.isError && (
          <div className="mt-4">
            <EmptyState
              variant="controlled"
              titulo="Veterinaria no configurada"
              mensaje="La cuenta no tiene una sede activa para editar. El acceso queda cerrado por scope."
            />
          </div>
        )}
        {veterinaria.data && (
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <CampoClinica
                label="Nombre de la clínica"
                ariaLabel="Nombre de la clinica"
                value={formVeterinaria.nombre}
                onChange={(value) => setFormVeterinaria((prev) => ({ ...prev, nombre: value }))}
                required
              />
              <CampoClinica
                label="Correo de contacto"
                type="email"
                value={formVeterinaria.emailContacto}
                onChange={(value) => setFormVeterinaria((prev) => ({ ...prev, emailContacto: value }))}
              />
              <CampoClinica
                label="Dirección"
                value={formVeterinaria.direccion}
                onChange={(value) => setFormVeterinaria((prev) => ({ ...prev, direccion: value }))}
              />
              <CampoClinica
                label="Ciudad"
                value={formVeterinaria.ciudad}
                onChange={(value) => setFormVeterinaria((prev) => ({ ...prev, ciudad: value }))}
              />
              <CampoClinica
                label="País"
                value={formVeterinaria.pais}
                onChange={(value) => setFormVeterinaria((prev) => ({ ...prev, pais: value }))}
              />
              <CampoClinica
                label="Teléfono"
                value={formVeterinaria.telefono}
                onChange={(value) => setFormVeterinaria((prev) => ({ ...prev, telefono: value }))}
              />
              <CampoClinica
                label="Logo (URL)"
                value={formVeterinaria.logoUrl}
                onChange={(value) => setFormVeterinaria((prev) => ({ ...prev, logoUrl: value }))}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-500">Estado operativo protegido por scope de veterinaria.</span>
              <Button
                onClick={() => actualizarVeterinaria.mutate()}
                disabled={demoSession || !formVeterinaria.nombre.trim() || actualizarVeterinaria.isPending}
                title={demoSession ? DEMO_ACTION_HINT : undefined}
              >
                Guardar
              </Button>
            </div>
          </div>
        )}
      </Card>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="premium-card">
        <SectionHeader
          title="Invitar veterinario a la clínica"
          description="Genera un enlace temporal para vincular un veterinario operativo solo a esta veterinaria."
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            aria-label="Email del veterinario"
            placeholder="veterinario@clinica.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15"
          />
          <Button
            aria-label="Generar invitacion"
            onClick={() => invitarVeterinario.mutate()}
            disabled={demoSession || !email || !me?.veterinariaId || invitarVeterinario.isPending}
            title={demoSession ? DEMO_ACTION_HINT : undefined}
          >
            Generar invitación
          </Button>
        </div>
        {!me?.veterinariaId && (
          <p className="mt-2 text-sm text-amber-700">
            Esta cuenta aún no tiene veterinariaId V2. Crea el scope local/emulado antes de invitar.
          </p>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        {enlace && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enlace temporal</p>
            <code className="mt-1 block break-all text-xs text-slate-700">{enlace}</code>
          </div>
        )}
      </Card>

      <Card className="premium-card">
        <SectionHeader
          title="Equipo clínico"
          description="Miembros visibles dentro de esta veterinaria y acciones seguras de activación."
          action={<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{equipoTotal} miembros</span>}
        />
        {veterinarios.isLoading && <p className="mt-3 text-sm text-slate-500">Cargando...</p>}
        {(veterinarios.data ?? []).length === 0 && !veterinarios.isLoading && (
          <EmptyState
            variant="controlled"
            titulo="Sin veterinarios vinculados"
            mensaje="Invita profesionales de la sede para habilitar operación clínica y consumo individual."
          />
        )}
        <ul className="mt-3 grid gap-2">
          {(veterinarios.data ?? []).map((m) => {
            const id = m.id ?? m.uid;
            const esUsuarioActual = m.uid === me?.uid || id === me?.uid;
            const estado = estadoVeterinario(m.estado, m.bloqueado);
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0">
                  <span className="block truncate text-sm text-slate-700">
                    {m.email ?? m.uid} - <strong>{m.role ?? m.rol}</strong>
                  </span>
                  <span className={estado.className}>{estado.label}</span>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => bloqueo.mutate({ id, bloqueado: !m.bloqueado })}
                  disabled={demoSession || bloqueo.isPending || esUsuarioActual}
                  title={demoSession ? DEMO_ACTION_HINT : esUsuarioActual ? 'No puedes desactivar tu propia cuenta.' : undefined}
                >
                  {esUsuarioActual ? 'Tu cuenta' : m.bloqueado ? 'Activar' : 'Desactivar'}
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
      <Card className="premium-card">
        <SectionHeader
          title="Consumo por veterinario"
          description="Uso de IA dentro del alcance de esta veterinaria."
          action={<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{consumoUsadoTotal}{consumoLimiteTotal > 0 ? `/${consumoLimiteTotal}` : ''}</span>}
        />
        {consumoItems.length > 0 && (
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0F6E56]">
              Consolidado clínica
            </p>
            <strong className="mt-1 block text-lg text-slate-900">
              {consumoUsadoTotal}{consumoLimiteTotal > 0 ? `/${consumoLimiteTotal}` : ''}
            </strong>
          </div>
        )}
        {consumoItems.length === 0 && !consumos.isLoading && (
          <EmptyState
            variant="controlled"
            titulo="Sin consumo registrado"
            mensaje="La clínica aún no registra uso de IA para este periodo."
          />
        )}
        <ul className="mt-3 grid gap-2">
          {consumoListadoItems.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
              <span className="text-sm text-slate-700">{c.veterinarioId ?? c.scopeId ?? c.id} - {c.periodo}</span>
              <strong className={c.bloqueado ? 'text-red-700' : 'text-slate-900'}>
                {c.usados}{typeof c.limite === 'number' ? `/${c.limite}` : ''}
              </strong>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="premium-card">
        <SectionHeader
          title="Solicitudes técnicas"
          description="Vinculaciones con conflicto quedan visibles para seguimiento mientras Área Técnica las resuelve."
        />
        <div className="mt-3 grid gap-2">
          {solicitudes.isLoading && <p className="text-sm text-slate-500">Cargando...</p>}
          {(solicitudes.data ?? []).length === 0 && !solicitudes.isLoading && (
            <EmptyState
              variant="controlled"
              titulo="Sin solicitudes técnicas"
              mensaje="No hay conflictos pendientes de vinculación para esta veterinaria."
            />
          )}
          {(solicitudes.data ?? []).map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm text-slate-900">{s.emailInvitado}</strong>
                <span className={s.estado === 'pendiente' ? 'text-sm font-bold text-amber-700' : 'text-sm font-bold text-slate-500'}>
                  {s.estado}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{s.conflicto ?? s.motivo ?? 'Revisión pendiente.'}</p>
            </div>
          ))}
        </div>
      </Card>
      </section>

      <section aria-label="Gestión de veterinaria" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {accionesVisibles.map((accion) => {
          const Icon = accion.icon;
          return (
            <Link key={accion.titulo} to={accion.to} className="group">
              <Card className="h-full shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)] transition-all group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_45px_-32px_rgba(15,110,86,0.55)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F6E56]/10 text-[#0F6E56]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-[#0F6E56]">
                      {accion.titulo}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{accion.descripcion}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
};

export default AdminVeterinaria;
export { AdminVeterinaria };

function campoOpcional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function esConsumoIndividual(item: { veterinarioId?: string | null; scopeId?: string }): boolean {
  return Boolean(item.veterinarioId || item.scopeId?.startsWith('vet_'));
}

function estadoVeterinario(
  estado: 'activo' | 'inactivo' | 'bloqueado' | undefined,
  bloqueado: boolean,
): { label: string; className: string } {
  const normalizado = bloqueado ? 'bloqueado' : estado ?? 'activo';
  const base = 'mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-bold';
  if (normalizado === 'activo') {
    return { label: 'Activo', className: `${base} bg-emerald-50 text-emerald-700` };
  }
  if (normalizado === 'inactivo') {
    return { label: 'Inactivo', className: `${base} bg-slate-100 text-slate-600` };
  }
  return { label: 'Bloqueado', className: `${base} bg-red-50 text-red-700` };
}

function CampoClinica({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  ariaLabel,
}: {
  label: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <input
        type={type}
        aria-label={ariaLabel ?? label}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15"
      />
    </label>
  );
}
