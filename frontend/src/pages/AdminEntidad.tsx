import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { Building2, CreditCard, ShieldCheck, Users } from 'lucide-react';
import { useMe } from '../features/tenant/hooks';
import {
  crearInvitacionEntidadFreelance,
  crearInvitacionEntidadSede,
  listarSolicitudesTecnicas,
} from '../features/tenant/api';
import {
  actualizarEntidadBackoffice,
  actualizarVeterinariaBackoffice,
  crearVeterinariaBackoffice,
  listarConsumosBackoffice,
  listarMiembrosBackoffice,
  listarVeterinariasBackoffice,
  obtenerEntidadBackoffice,
  setBloqueoMiembroBackoffice,
  type BackofficeConsumo,
  type BackofficeEntidad,
  type BackofficeMiembro,
  type BackofficeVeterinaria,
} from '../features/backoffice/api';
import { MetricsPanel } from '../features/metricas/MetricsPanel';
import { BusinessOverview } from '../features/saas/BusinessOverview';
import { Badge, Button, Card, EmptyState, InfoTile, SectionHeader } from '../components/ui/Primitives';
import { getErrorMessage } from '../lib/errors';
import { DEMO_ACTION_HINT, isDemoSession } from '../lib/demoSession';

type EntidadForm = {
  nombre: string;
  tipo: BackofficeEntidad['tipo'] | '';
  direccion: string;
  ciudad: string;
  pais: string;
  telefono: string;
  emailContacto: string;
  logoUrl: string;
};

type SedeForm = {
  nombre: string;
  ciudad: string;
  estado: BackofficeVeterinaria['estado'];
};

const entidadTipos: Array<{ value: Exclude<BackofficeEntidad['tipo'], null | undefined>; label: string }> = [
  { value: 'entidad', label: 'Entidad' },
  { value: 'cadena', label: 'Cadena' },
  { value: 'gobierno', label: 'Gobierno' },
  { value: 'ong', label: 'ONG' },
];

const listStyle: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 };
const rowStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 12,
  border: '1px solid var(--border)',
  borderRadius: 10,
};
const fieldStyle: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 };
const inputStyle: React.CSSProperties = { padding: 9, border: '1px solid var(--border)', borderRadius: 8 };
const gridStyle: React.CSSProperties = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' };

function textOrEmpty(value: string | null | undefined): string {
  return value ?? '';
}

function nullableText(value: string): string | null {
  const limpio = value.trim();
  return limpio.length > 0 ? limpio : null;
}

function sumarConsumos(consumos: BackofficeConsumo[]): { usados: number; limite: number | null } {
  const usados = consumos.reduce((acc, c) => acc + c.usados, 0);
  const limites = consumos.map((c) => c.limite).filter((v): v is number => typeof v === 'number');
  return { usados, limite: limites.length > 0 ? limites.reduce((acc, v) => acc + v, 0) : null };
}

function formatoConsumo(consumos: BackofficeConsumo[]): string {
  const total = sumarConsumos(consumos);
  return `${total.usados}${typeof total.limite === 'number' ? `/${total.limite}` : ''}`;
}

function esVeterinario(miembro: BackofficeMiembro): boolean {
  return miembro.role === 'veterinario' || miembro.rol === 'vet';
}

const AdminEntidad: React.FC = () => {
  const { data: me } = useMe();
  const rol = me?.role ?? me?.rol ?? null;
  const demoSession = isDemoSession(me ?? null);
  const scopeKey = me?.entidadId ?? me?.orgId ?? me?.accountId ?? 'sin-scope';
  const entidadId = me?.entidadId ?? null;
  const orgId = me?.orgId ?? null;
  const qc = useQueryClient();

  const [formEntidad, setFormEntidad] = useState<EntidadForm>({
    nombre: '',
    tipo: '',
    direccion: '',
    ciudad: '',
    pais: '',
    telefono: '',
    emailContacto: '',
    logoUrl: '',
  });
  const [nuevaSede, setNuevaSede] = useState({ nombre: '', ciudad: '' });
  const [sedesForm, setSedesForm] = useState<Record<string, SedeForm>>({});
  const [emailsSede, setEmailsSede] = useState<Record<string, string>>({});
  const [emailFreelance, setEmailFreelance] = useState('');
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState('');

  const scopeListo = Boolean(me?.entidadId ?? me?.orgId ?? me?.accountId);
  const entidad = useQuery({
    queryKey: ['backoffice-entidad', scopeKey],
    queryFn: obtenerEntidadBackoffice,
    enabled: scopeListo,
  });
  const veterinarias = useQuery({
    queryKey: ['backoffice-veterinarias', scopeKey],
    queryFn: listarVeterinariasBackoffice,
    enabled: scopeListo,
  });
  const miembros = useQuery({
    queryKey: ['backoffice-miembros', scopeKey],
    queryFn: listarMiembrosBackoffice,
    enabled: scopeListo,
  });
  const consumos = useQuery({
    queryKey: ['backoffice-consumos', scopeKey],
    queryFn: listarConsumosBackoffice,
    enabled: scopeListo,
  });
  const solicitudes = useQuery({
    queryKey: ['solicitudes-tecnicas', scopeKey],
    queryFn: () => listarSolicitudesTecnicas(),
    enabled: scopeListo,
  });

  useEffect(() => {
    if (!entidad.data) return;
    setFormEntidad({
      nombre: entidad.data.nombre,
      tipo: entidad.data.tipo ?? '',
      direccion: textOrEmpty(entidad.data.direccion),
      ciudad: textOrEmpty(entidad.data.ciudad),
      pais: textOrEmpty(entidad.data.pais),
      telefono: textOrEmpty(entidad.data.telefono),
      emailContacto: textOrEmpty(entidad.data.emailContacto),
      logoUrl: textOrEmpty(entidad.data.logoUrl),
    });
  }, [entidad.data]);

  useEffect(() => {
    const next = Object.fromEntries(
      (veterinarias.data ?? []).map((sede) => [
        sede.id,
        {
          nombre: sede.nombre,
          ciudad: textOrEmpty(sede.ciudad),
          estado: sede.estado,
        },
      ]),
    );
    setSedesForm(next);
  }, [veterinarias.data]);

  const veterinarios = useMemo(() => (miembros.data ?? []).filter(esVeterinario), [miembros.data]);
  const administrativos = useMemo(() => (miembros.data ?? []).filter((m) => !esVeterinario(m)), [miembros.data]);
  const freelancers = useMemo(
    () =>
      veterinarios.filter(
        (m) => m.vinculoTipo === 'freelance' || (m.accountType === 'entidad' && !m.veterinariaId),
      ),
    [veterinarios],
  );
  const consumosAll = consumos.data ?? [];
  const consumoMaestroEntidad = consumosAll.filter(
    (c) =>
      entidadId &&
      (c.scopeId === entidadId || c.entidadId === entidadId) &&
      !c.veterinariaId &&
      !c.veterinarioId,
  );
  const consumosDetalle = consumoMaestroEntidad.length > 0 ? consumosAll.filter((c) => !consumoMaestroEntidad.includes(c)) : consumosAll;
  const consumosResumen = consumoMaestroEntidad.length > 0 ? consumoMaestroEntidad : consumosAll;

  const actualizarEntidad = useMutation({
    mutationFn: () =>
      actualizarEntidadBackoffice({
        nombre: formEntidad.nombre.trim(),
        tipo: formEntidad.tipo || null,
        direccion: nullableText(formEntidad.direccion),
        ciudad: nullableText(formEntidad.ciudad),
        pais: nullableText(formEntidad.pais),
        telefono: nullableText(formEntidad.telefono),
        emailContacto: nullableText(formEntidad.emailContacto),
        logoUrl: nullableText(formEntidad.logoUrl),
      }),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['backoffice-entidad', scopeKey] });
    },
    onError: (e) => setError(getErrorMessage(e, 'No se pudo guardar la entidad.')),
  });

  const crearSede = useMutation({
    mutationFn: () =>
      crearVeterinariaBackoffice({
        nombre: nuevaSede.nombre.trim(),
        ciudad: nullableText(nuevaSede.ciudad),
        planOwnerType: 'entidad',
      }),
    onSuccess: () => {
      setNuevaSede({ nombre: '', ciudad: '' });
      setError('');
      qc.invalidateQueries({ queryKey: ['backoffice-veterinarias', scopeKey] });
    },
    onError: (e) => setError(getErrorMessage(e, 'No se pudo crear la sede.')),
  });

  const actualizarSede = useMutation({
    mutationFn: (input: { id: string; payload: SedeForm }) =>
      actualizarVeterinariaBackoffice(input.id, {
        nombre: input.payload.nombre.trim(),
        ciudad: nullableText(input.payload.ciudad),
        estado: input.payload.estado,
      }),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['backoffice-veterinarias', scopeKey] });
    },
    onError: (e) => setError(getErrorMessage(e, 'No se pudo guardar la sede.')),
  });

  const invitarSede = useMutation({
    mutationFn: ({ veterinariaId, email }: { veterinariaId: string; email: string }) => {
      if (!entidadId) throw new Error('La invitacion V2 por sede requiere entidadId.');
      return crearInvitacionEntidadSede({
        email: email.trim(),
        veterinariaId,
        orgId,
        entidadId,
        planOwnerId: entidad.data?.planOwnerId ?? entidadId,
      });
    },
    onSuccess: (res, vars) => {
      setEnlace(`${window.location.origin}/invitacion?token=${res.token}`);
      setEmailsSede((actual) => ({ ...actual, [vars.veterinariaId]: '' }));
      setError('');
    },
    onError: (e) => setError(getErrorMessage(e, 'No se pudo crear la invitacion de sede.')),
  });

  const invitarFreelance = useMutation({
    mutationFn: () => {
      if (!entidadId) throw new Error('La invitacion freelance requiere entidadId.');
      return crearInvitacionEntidadFreelance({ email: emailFreelance.trim(), orgId, entidadId });
    },
    onSuccess: (res) => {
      setEnlace(`${window.location.origin}/invitacion?token=${res.token}`);
      setEmailFreelance('');
      setError('');
    },
    onError: (e) => setError(getErrorMessage(e, 'No se pudo crear la invitacion freelance.')),
  });

  const bloqueo = useMutation({
    mutationFn: (v: { id: string; bloqueado: boolean }) => setBloqueoMiembroBackoffice(v.id, v.bloqueado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backoffice-miembros', scopeKey] }),
    onError: (e) => setError(getErrorMessage(e, 'No se pudo cambiar el estado del usuario.')),
  });

  const sedesTotal = (veterinarias.data ?? []).length;
  const veterinariosTotal = veterinarios.length;
  const consumoEntidadLabel = formatoConsumo(consumosResumen);

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <section className="command-hero p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <span className="inline-flex rounded-full border border-white/15 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">
              Administración
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Vista entidad</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
              Panel ejecutivo para sedes, veterinarios vinculados, freelancers y consumo consolidado.
            </p>
          </div>
          <div className="grid min-w-[min(100%,560px)] grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Sedes', sedesTotal],
              ['Veterinarios', veterinariosTotal],
              ['Freelance', freelancers.length],
              ['Consumo', consumoEntidadLabel],
            ].map(([label, value]) => (
              <div key={String(label)} className="command-panel-dark p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">{label}</p>
                <strong className="mt-1 block text-xl font-black text-white">{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Resumen ejecutivo de entidad" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          label="Sedes activas"
          value={sedesTotal}
          hint="Veterinarias bajo esta entidad"
          icon={<Building2 className="h-5 w-5" />}
          tone="success"
        />
        <InfoTile
          label="Equipo clínico"
          value={veterinariosTotal}
          hint={`${freelancers.length} freelance directos`}
          icon={<Users className="h-5 w-5" />}
          tone="info"
        />
        <InfoTile
          label="Consumo maestro"
          value={consumoEntidadLabel}
          hint="Sedes propias y vínculos directos"
          icon={<CreditCard className="h-5 w-5" />}
          tone="warn"
        />
        <InfoTile
          label="Scope seguro"
          value={entidadId ? 'V2' : 'Legacy'}
          hint={entidadId ? 'Filtrado por entidadId' : 'Fallback controlado por orgId'}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="neutral"
        />
      </section>

      {error && (
        <div role="alert" style={{ color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 10, padding: 12 }}>
          {error}
        </div>
      )}

      {demoSession && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {DEMO_ACTION_HINT}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <BusinessOverview rol={rol} profile={me ?? null} />
        <MetricsPanel rol={rol} />
      </section>

      <Card className="premium-card">
        <SectionHeader
          title="Centro de operación multi-sede"
          description="La entidad se organiza por perfil, sedes, veterinarios, consumo y soporte. Cada bloque conserva su scope V2."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {[
            ['Resumen', 'Plan, métricas y señales operativas.'],
            ['Sedes', 'Veterinarias y equipos vinculados.'],
            ['Veterinarios', 'Por sede o freelance directo.'],
            ['Consumo', 'Consolidado y uso individual.'],
            ['Configuración', 'Perfil administrativo de entidad.'],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-sm font-black text-[var(--text)]">{title}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{copy}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="premium-card" id="perfil-entidad">
        <SectionHeader
          title="Perfil de entidad"
          description="Datos administrativos guardados dentro del scope de la entidad."
          action={entidad.data ? <Badge estado={entidad.data.estado}>{entidad.data.estado}</Badge> : null}
        />
        {entidad.isError && <p role="alert" style={{ color: 'var(--danger)' }}>No se pudo cargar la entidad.</p>}
        {!entidad.isLoading && !entidad.data && !entidad.isError && (
          <div className="mt-4">
            <EmptyState
              variant="controlled"
              titulo="Entidad no configurada"
              mensaje="La cuenta no tiene una entidad activa para editar. La navegación queda cerrada por scope."
            />
          </div>
        )}
        {entidad.data && (
          <form
            style={{ display: 'grid', gap: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              actualizarEntidad.mutate();
            }}
          >
            <div style={gridStyle}>
              <label style={fieldStyle}>
                Nombre de la entidad
                <input
                  aria-label="Nombre de la entidad"
                  value={formEntidad.nombre}
                  onChange={(e) => setFormEntidad((actual) => ({ ...actual, nombre: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                Tipo de entidad
                <select
                  aria-label="Tipo de entidad"
                  value={formEntidad.tipo ?? ''}
                  onChange={(e) =>
                    setFormEntidad((actual) => ({
                      ...actual,
                      tipo: e.target.value as EntidadForm['tipo'],
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Sin clasificar</option>
                  {entidadTipos.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>
                Direccion principal
                <input
                  aria-label="Direccion principal"
                  value={formEntidad.direccion}
                  onChange={(e) => setFormEntidad((actual) => ({ ...actual, direccion: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                Ciudad
                <input
                  aria-label="Ciudad de la entidad"
                  value={formEntidad.ciudad}
                  onChange={(e) => setFormEntidad((actual) => ({ ...actual, ciudad: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                Pais
                <input
                  aria-label="Pais de la entidad"
                  value={formEntidad.pais}
                  onChange={(e) => setFormEntidad((actual) => ({ ...actual, pais: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                Telefono
                <input
                  aria-label="Telefono de la entidad"
                  value={formEntidad.telefono}
                  onChange={(e) => setFormEntidad((actual) => ({ ...actual, telefono: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                Correo de contacto
                <input
                  type="email"
                  aria-label="Correo de contacto"
                  value={formEntidad.emailContacto}
                  onChange={(e) => setFormEntidad((actual) => ({ ...actual, emailContacto: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                Logo URL
                <input
                  aria-label="Logo URL"
                  value={formEntidad.logoUrl}
                  onChange={(e) => setFormEntidad((actual) => ({ ...actual, logoUrl: e.target.value }))}
                  style={inputStyle}
                />
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Button type="submit" disabled={demoSession || !formEntidad.nombre.trim() || actualizarEntidad.isPending} title={demoSession ? DEMO_ACTION_HINT : undefined}>
                Guardar entidad
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="premium-card" id="sedes-entidad">
        <SectionHeader
          title="Sedes y veterinarios"
          description="Veterinarias asociadas a la entidad activa, con equipo clínico y consumo por sede."
          action={<Badge estado="activa">{sedesTotal} sedes</Badge>}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            aria-label="Nombre de nueva sede"
            placeholder="Nueva sede"
            value={nuevaSede.nombre}
            onChange={(e) => setNuevaSede((actual) => ({ ...actual, nombre: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          />
          <input
            aria-label="Ciudad de nueva sede"
            placeholder="Ciudad"
            value={nuevaSede.ciudad}
            onChange={(e) => setNuevaSede((actual) => ({ ...actual, ciudad: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 180 }}
          />
          <Button onClick={() => crearSede.mutate()} disabled={demoSession || !nuevaSede.nombre.trim() || crearSede.isPending} title={demoSession ? DEMO_ACTION_HINT : undefined}>
            Crear sede
          </Button>
        </div>
        {(veterinarias.data ?? []).length === 0 && !veterinarias.isLoading && (
          <EmptyState
            variant="controlled"
            titulo="Sin sedes registradas"
            mensaje="La entidad está lista para crear veterinarias/sedes sin mezclar datos de otros tenants."
          />
        )}
        <ul style={listStyle}>
          {(veterinarias.data ?? []).map((sede) => {
            const draft = sedesForm[sede.id] ?? { nombre: sede.nombre, ciudad: textOrEmpty(sede.ciudad), estado: sede.estado };
            const vetsSede = veterinarios.filter(
              (m) => m.veterinariaId === sede.id || (m.accountType === 'veterinaria' && m.accountId === sede.id),
            );
            const consumoSede = consumosDetalle.filter((c) => c.veterinariaId === sede.id || c.scopeId === sede.id);
            const emailSede = emailsSede[sede.id] ?? '';
            return (
              <li
                key={sede.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_14px_35px_-32px_rgba(15,23,42,0.35)]"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-[var(--text)]">{sede.nombre}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {textOrEmpty(sede.ciudad) || 'Ciudad no definida'} · {vetsSede.length} veterinarios · Consumo {formatoConsumo(consumoSede)}
                    </p>
                  </div>
                  <Badge estado={sede.estado}>{sede.estado}</Badge>
                </div>
                <div style={gridStyle}>
                  <label style={fieldStyle}>
                    Nombre de sede {sede.nombre}
                    <input
                      aria-label={`Nombre de sede ${sede.nombre}`}
                      value={draft.nombre}
                      onChange={(e) =>
                        setSedesForm((actual) => ({
                          ...actual,
                          [sede.id]: { ...draft, nombre: e.target.value },
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldStyle}>
                    Ciudad de sede {sede.nombre}
                    <input
                      aria-label={`Ciudad de sede ${sede.nombre}`}
                      value={draft.ciudad}
                      onChange={(e) =>
                        setSedesForm((actual) => ({
                          ...actual,
                          [sede.id]: { ...draft, ciudad: e.target.value },
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldStyle}>
                    Estado de sede {sede.nombre}
                    <select
                      aria-label={`Estado de sede ${sede.nombre}`}
                      value={draft.estado}
                      onChange={(e) =>
                        setSedesForm((actual) => ({
                          ...actual,
                          [sede.id]: { ...draft, estado: e.target.value as BackofficeVeterinaria['estado'] },
                        }))
                      }
                      style={inputStyle}
                    >
                      <option value="activa">activa</option>
                      <option value="inactiva">inactiva</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>{vetsSede.length} veterinarios</span>
                  <strong className="text-sm text-[var(--text)]">Consumo {formatoConsumo(consumoSede)}</strong>
                  <Button
                    variant="ghost"
                    onClick={() => actualizarSede.mutate({ id: sede.id, payload: draft })}
                    disabled={demoSession || !draft.nombre.trim() || actualizarSede.isPending}
                    title={demoSession ? DEMO_ACTION_HINT : undefined}
                  >
                    Guardar sede {sede.nombre}
                  </Button>
                </div>
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <strong style={{ fontSize: 13 }}>Veterinarios de {sede.nombre}</strong>
                  {vetsSede.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
                      Sin veterinarios vinculados. Usa invitación por sede para sumar equipo.
                    </p>
                  ) : (
                    <ul style={{ ...listStyle, marginTop: 8 }}>
                      {vetsSede.map((vet) => (
                        <li key={vet.id} style={{ ...rowStyle, gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                          <span>
                            {vet.email ?? vet.uid} - <Badge estado={vet.estado ?? (vet.bloqueado ? 'bloqueado' : 'activo')}>
                              {vet.estado ?? (vet.bloqueado ? 'bloqueado' : 'activo')}
                            </Badge>
                          </span>
                          <AccionBloqueo miembro={vet} uidActual={me?.uid} bloqueo={bloqueo} demoSession={demoSession} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <input
                    type="email"
                    aria-label={`Email veterinario para ${sede.nombre}`}
                    placeholder="veterinario@clinica.com"
                    value={emailSede}
                    onChange={(e) => setEmailsSede((actual) => ({ ...actual, [sede.id]: e.target.value }))}
                    style={{ ...inputStyle, flex: 1, minWidth: 240 }}
                  />
                  <Button
                    onClick={() => invitarSede.mutate({ veterinariaId: sede.id, email: emailSede })}
                    disabled={demoSession || !entidadId || !emailSede.trim() || invitarSede.isPending}
                    title={demoSession ? DEMO_ACTION_HINT : !entidadId ? 'La invitación V2 por sede requiere entidadId.' : undefined}
                  >
                    Invitar a sede
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="premium-card">
        <SectionHeader
          title="Freelancers directos"
          description="Veterinarios vinculados directamente a la entidad, sin sede asignada."
          action={<Badge estado={freelancers.length > 0 ? 'activa' : 'readonly'}>{freelancers.length} vinculados</Badge>}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            type="email"
            aria-label="Email freelance"
            placeholder="freelance@entidad.com"
            value={emailFreelance}
            onChange={(e) => setEmailFreelance(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 240 }}
          />
          <Button
            onClick={() => invitarFreelance.mutate()}
            disabled={demoSession || !entidadId || !emailFreelance.trim() || invitarFreelance.isPending}
            title={demoSession ? DEMO_ACTION_HINT : !entidadId ? 'La invitación freelance requiere entidadId.' : undefined}
          >
            Invitar freelance
          </Button>
        </div>
        {freelancers.length === 0 ? (
          <EmptyState
            variant="controlled"
            titulo="Sin freelancers directos"
            mensaje="El espacio queda preparado para vínculos directos cuando el modelo V2 lo soporte de forma segura."
          />
        ) : (
          <ul style={listStyle}>
            {freelancers.map((vet) => (
              <li key={vet.id} style={{ ...rowStyle, gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                <span>
                  {vet.email ?? vet.uid} - <Badge estado={vet.estado ?? (vet.bloqueado ? 'bloqueado' : 'activo')}>
                    {vet.estado ?? (vet.bloqueado ? 'bloqueado' : 'activo')}
                  </Badge>
                </span>
                <AccionBloqueo miembro={vet} uidActual={me?.uid} bloqueo={bloqueo} demoSession={demoSession} />
              </li>
            ))}
          </ul>
        )}
        {enlace && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Enlace de invitación:</p>
            <code style={{ wordBreak: 'break-all', fontSize: 12 }}>{enlace}</code>
          </div>
        )}
      </Card>

      <Card className="premium-card">
        <SectionHeader
          title="Consumo consolidado"
          description="Uso agregado por entidad, sede y veterinario sin doble conteo de consumo maestro."
          action={<Badge estado="activa">{formatoConsumo(consumosResumen)}</Badge>}
        />
        {(consumos.data ?? []).length === 0 && !consumos.isLoading && (
          <EmptyState
            variant="controlled"
            titulo="Sin consumo registrado"
            mensaje="La entidad aún no tiene uso de IA para este periodo. El límite se mostrará cuando exista plan/trial aplicable."
          />
        )}
        {(consumos.data ?? []).length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ ...rowStyle, gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
              <strong>Consolidado entidad</strong>
              <strong>{formatoConsumo(consumosResumen)}</strong>
            </div>
            <div>
              <strong style={{ fontSize: 13 }}>Por veterinario</strong>
              <ul style={{ ...listStyle, marginTop: 8 }}>
                {veterinarios.map((vet) => {
                  const consumoVet = consumosDetalle.filter(
                    (c) => c.veterinarioId === vet.uid || c.scopeId === vet.uid || c.scopeId === `vet_${vet.uid}`,
                  );
                  return (
                    <li key={vet.id} style={{ ...rowStyle, gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                      <span>{vet.email ?? vet.uid}</span>
                      <strong>{formatoConsumo(consumoVet)}</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
      <Card className="premium-card">
        <SectionHeader
          title="Usuarios administrativos"
          description="Cuentas de administración dentro del scope de la entidad."
        />
        {administrativos.length === 0 && !miembros.isLoading && (
          <EmptyState
            variant="controlled"
            titulo="Sin usuarios administrativos"
            mensaje="No hay administradores adicionales vinculados a esta entidad."
          />
        )}
        <ul style={listStyle}>
          {administrativos.map((m) => (
            <li key={m.id} style={{ ...rowStyle, gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
              <span>
                {m.email ?? m.uid} - <strong>{m.role ?? m.rol}</strong> {m.bloqueado && '(bloqueado)'}
              </span>
              <AccionBloqueo miembro={m} uidActual={me?.uid} bloqueo={bloqueo} demoSession={demoSession} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="premium-card">
        <SectionHeader
          title="Solicitudes técnicas"
          description="Seguimiento de vinculaciones con conflicto, sin abrir acciones inseguras."
        />
        {solicitudes.isLoading && <p style={{ color: 'var(--muted)' }}>Cargando...</p>}
        {(solicitudes.data ?? []).length === 0 && !solicitudes.isLoading && (
          <EmptyState
            variant="controlled"
            titulo="Sin solicitudes técnicas"
            mensaje="No hay decisiones pendientes para esta entidad."
          />
        )}
        <ul style={listStyle}>
          {(solicitudes.data ?? []).map((s) => (
            <li key={s.id} style={rowStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{s.emailInvitado}</strong>
                <Badge estado={s.estado}>{s.estado}</Badge>
              </div>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                {s.conflicto ?? s.motivo ?? 'Revisión pendiente.'}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      </section>
    </div>
  );
};

function AccionBloqueo({
  miembro,
  uidActual,
  bloqueo,
  demoSession = false,
}: {
  miembro: BackofficeMiembro;
  uidActual?: string;
  bloqueo: UseMutationResult<{ id: string; uid: string; bloqueado: boolean }, Error, { id: string; bloqueado: boolean }>;
  demoSession?: boolean;
}) {
  const id = miembro.id ?? miembro.uid;
  const esUsuarioActual = miembro.uid === uidActual || id === uidActual;
  return (
    <Button
      variant="ghost"
      onClick={() => bloqueo.mutate({ id, bloqueado: !miembro.bloqueado })}
      disabled={demoSession || bloqueo.isPending || esUsuarioActual}
      title={demoSession ? DEMO_ACTION_HINT : esUsuarioActual ? 'No puedes desactivar tu propia cuenta.' : undefined}
    >
      {esUsuarioActual ? 'Tu cuenta' : miembro.bloqueado ? 'Desbloquear' : 'Bloquear'}
    </Button>
  );
}

export default AdminEntidad;
export { AdminEntidad };
