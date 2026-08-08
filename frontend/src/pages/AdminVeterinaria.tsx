import React, { useState } from 'react';
import { useTourGuide } from '../hooks/useTourGuide';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Syringe, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { buildVeterinariaLogoStoragePath } from '../lib/veterinariaLogoStorage';
import { useMe } from '../features/tenant/hooks';
import { crearInvitacionVeterinaria } from '../features/tenant/api';
import {
  actualizarVeterinariaBackoffice,
  crearVeterinarioCredencialesBackoffice,
  listarConsumosBackoffice,
  listarVeterinariosBackoffice,
  obtenerVeterinariaBackoffice,
  setBloqueoMiembroBackoffice,
} from '../features/backoffice/api';
import { Button, Card, EmptyState, SectionHeader } from '../components/ui/Primitives';
import { rolLabel } from '../lib/rbac';
import { getErrorMessage } from '../lib/errors';
import { DEMO_ACTION_HINT, isDemoSession } from '../lib/demoSession';
import {
  listarCatalogo,
  crearCatalogo,
  actualizarCatalogo,
  eliminarCatalogo,
  type VacunaCatalogoItem,
} from '../features/vacunas/api';

interface ConfigCard {
  tab: string;
  titulo: string;
  descripcion: string;
  icon: LucideIcon;
}

const CONFIG_CARDS: ConfigCard[] = [
  {
    tab: 'ficha',
    titulo: 'Datos de la clínica',
    descripcion: 'Nombre, dirección, ciudad, contacto y logo de tu sede.',
    icon: Building2,
  },
  {
    tab: 'equipo',
    titulo: 'Equipo clínico',
    descripcion: 'Veterinarios vinculados, altas nuevas y consumo de IA.',
    icon: Users,
  },
  {
    tab: 'catalogo',
    titulo: 'Catálogo de vacunas',
    descripcion: 'Vacunas propias de tu clínica, además de las del sistema.',
    icon: Syringe,
  },
];

const TOUR_STEPS_ADMIN_VETERINARIA = [
  {
    element: '[data-tour="admin-vet-panel"]',
    popover: {
      title: 'Configuración',
      description:
        'Aquí administras la ficha de tu veterinaria, el equipo clínico y el catálogo de vacunas, cada uno en su propia vista.',
    },
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
  useTourGuide('admin-vet-mi-veterinaria', TOUR_STEPS_ADMIN_VETERINARIA);
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const rol = me?.role ?? me?.rol ?? null;
  const demoSession = isDemoSession(me ?? null);
  const [email, setEmail] = useState('');
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState('');
  const [nuevoVetNombre, setNuevoVetNombre] = useState('');
  const [nuevoVetEmail, setNuevoVetEmail] = useState('');
  const [nuevoVetPassword, setNuevoVetPassword] = useState('');
  const [credCreado, setCredCreado] = useState('');
  const [formVeterinaria, setFormVeterinaria] = useState(veterinariaFormInicial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };
  const scopeListo = Boolean(me?.orgId || me?.veterinariaId || me?.accountId);
  const puedeGestionarCatalogo = rol === 'admin_veterinaria' || rol === 'admin_entidad' || rol === 'veterinario' || rol === 'admin' || rol === 'vet' || rol === 'superadmin';

  // Catalog queries and mutations
  const catalogoQuery = useQuery({
    queryKey: ['catalogoVacunas'],
    queryFn: () => listarCatalogo(),
    enabled: scopeListo,
  });

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaEspecie, setNuevaEspecie] = useState('perro');
  const [nuevoIntervalo, setNuevoIntervalo] = useState<number | undefined>();
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');

  const [editCatalogoId, setEditCatalogoId] = useState<string | null>(null);
  const [editCatalogoNombre, setEditCatalogoNombre] = useState('');
  const [editCatalogoEspecie, setEditCatalogoEspecie] = useState('perro');
  const [editCatalogoIntervalo, setEditCatalogoIntervalo] = useState<number | undefined>();
  const [editCatalogoDescripcion, setEditCatalogoDescripcion] = useState('');

  const crearCatalogoMut = useMutation({
    mutationFn: () =>
      crearCatalogo({
        nombre: nuevoNombre,
        especie: nuevaEspecie,
        intervaloDias: nuevoIntervalo,
        descripcion: nuevaDescripcion || undefined,
      }),
    onSuccess: () => {
      setNuevoNombre('');
      setNuevoIntervalo(undefined);
      setNuevaDescripcion('');
      qc.invalidateQueries({ queryKey: ['catalogoVacunas'] });
    },
  });

  const actualizarCatalogoMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VacunaCatalogoItem> }) =>
      actualizarCatalogo(id, data),
    onSuccess: () => {
      setEditCatalogoId(null);
      qc.invalidateQueries({ queryKey: ['catalogoVacunas'] });
    },
  });

  const eliminarCatalogoMut = useMutation({
    mutationFn: (id: string) => eliminarCatalogo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogoVacunas'] });
    },
  });

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
    mutationFn: async () => {
      if (!veterinaria.data?.id) {
        throw new Error('No hay veterinaria activa para actualizar.');
      }
      let logoUrl = formVeterinaria.logoUrl;
      if (logoFile) {
        if (!me?.orgId) {
          throw new Error('No se pudo subir el logo: tu cuenta no tiene organización asignada.');
        }
        const logoPath = buildVeterinariaLogoStoragePath(me.orgId, logoFile);
        const storageRef = ref(storage, logoPath);
        const uploadResult = await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(uploadResult.ref);
      }
      return actualizarVeterinariaBackoffice(veterinaria.data.id, {
        nombre: formVeterinaria.nombre.trim(),
        direccion: campoOpcional(formVeterinaria.direccion),
        ciudad: campoOpcional(formVeterinaria.ciudad),
        pais: campoOpcional(formVeterinaria.pais),
        telefono: campoOpcional(formVeterinaria.telefono),
        emailContacto: campoOpcional(formVeterinaria.emailContacto),
        logoUrl: campoOpcional(logoUrl),
      });
    },
    onSuccess: () => {
      setError('');
      setLogoFile(null);
      setLogoPreview(null);
      qc.invalidateQueries({ queryKey: ['backoffice-veterinaria'] });
    },
    onError: (e) => setError(getErrorMessage(e, 'No se pudo actualizar la veterinaria.')),
  });

  const bloqueo = useMutation({
    mutationFn: (v: { id: string; bloqueado: boolean }) => setBloqueoMiembroBackoffice(v.id, v.bloqueado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backoffice-veterinarios'] }),
    onError: (e) => setError(getErrorMessage(e, 'No se pudo cambiar el estado del miembro.')),
  });

  const crearVetCredenciales = useMutation({
    mutationFn: () =>
      crearVeterinarioCredencialesBackoffice({
        nombre: nuevoVetNombre.trim(),
        email: nuevoVetEmail.trim(),
        password: nuevoVetPassword,
      }),
    onSuccess: (m) => {
      setCredCreado(`Veterinario ${m.email} creado. Ya puede iniciar sesión con la contraseña indicada y cambiarla desde su perfil.`);
      setNuevoVetNombre('');
      setNuevoVetEmail('');
      setNuevoVetPassword('');
      setError('');
      qc.invalidateQueries({ queryKey: ['backoffice-veterinarios'] });
    },
    onError: (e) => setError(getErrorMessage(e, 'No se pudo crear el veterinario.')),
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
      <section className="premium-card bg-white p-6 sm:p-8 border border-slate-200" data-tour="admin-vet-panel">
        <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
          {rolLabel(rol) ?? 'Admin veterinaria'}
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Configuración</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Gestiona sede, equipo clínico y catálogo de vacunas desde una consola ejecutiva.
        </p>
      </section>

      {demoSession && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {DEMO_ACTION_HINT}
        </div>
      )}

      {!tab && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CONFIG_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.tab} to={`/veterinaria?tab=${card.tab}`} className="group">
                <Card className="h-full shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)] transition-all group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_45px_-32px_rgba(15,110,86,0.55)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 group-hover:text-accent">{card.titulo}</h2>
                      <p className="mt-1 text-sm text-slate-500">{card.descripcion}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </section>
      )}

      {tab && (
        <Link to="/veterinaria" className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-accent hover:underline">
          ← Volver a Configuración
        </Link>
      )}

      {tab === 'ficha' && (
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
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Logo de la clínica
                </label>
                <div className="flex items-center gap-4">
                  {logoPreview || formVeterinaria.logoUrl ? (
                    <img
                      src={logoPreview || formVeterinaria.logoUrl}
                      alt="Logo de la clínica"
                      className="h-14 w-14 rounded-xl border border-slate-200 object-contain bg-white p-1"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                      <Building2 className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Aparece en el encabezado de las historias clínicas en PDF. Formatos JPG, PNG o WEBP.
                </p>
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
      )}

      {tab === 'equipo' && (
        <>
          <Card className="premium-card">
            <SectionHeader
              title="Crear veterinario con credenciales"
              description="Da de alta un veterinario con email y contraseña temporal. Quedará vinculado a esta veterinaria y podrá cambiar su contraseña desde su perfil."
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                aria-label="Nombre del veterinario"
                placeholder="Nombre completo"
                value={nuevoVetNombre}
                onChange={(e) => setNuevoVetNombre(e.target.value)}
                className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
              <input
                type="email"
                aria-label="Email del nuevo veterinario"
                placeholder="veterinario@clinica.com"
                value={nuevoVetEmail}
                onChange={(e) => setNuevoVetEmail(e.target.value)}
                className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
              <div className="flex gap-2">
                <input
                  aria-label="Contraseña temporal"
                  placeholder="Contraseña temporal"
                  value={nuevoVetPassword}
                  onChange={(e) => setNuevoVetPassword(e.target.value)}
                  className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Generar contraseña"
                  onClick={() => setNuevoVetPassword(generarPasswordTemporal())}
                >
                  Generar
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-[var(--muted)]">Mínimo 6 caracteres. Comparte la contraseña de forma segura con el veterinario.</span>
              <Button
                aria-label="Crear veterinario"
                onClick={() => crearVetCredenciales.mutate()}
                disabled={
                  demoSession ||
                  !nuevoVetNombre.trim() ||
                  !nuevoVetEmail.trim() ||
                  nuevoVetPassword.length < 6 ||
                  !me?.veterinariaId ||
                  crearVetCredenciales.isPending
                }
                title={demoSession ? DEMO_ACTION_HINT : undefined}
              >
                {crearVetCredenciales.isPending ? 'Creando...' : 'Crear veterinario'}
              </Button>
            </div>
            {!me?.veterinariaId && (
              <p className="mt-2 text-sm text-amber-700">
                Esta cuenta aún no tiene veterinariaId V2. Crea el scope de la veterinaria antes de dar de alta veterinarios.
              </p>
            )}
            {credCreado && <p role="status" className="mt-2 text-sm text-emerald-700">{credCreado}</p>}
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
                  className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
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

          <Card className="premium-card">
            <SectionHeader
              title="Consumo por veterinario"
              description="Uso de IA dentro del alcance de esta veterinaria."
              action={<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{consumoUsadoTotal}{consumoLimiteTotal > 0 ? `/${consumoLimiteTotal}` : ''}</span>}
            />
            {consumoItems.length > 0 && (
              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">
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
        </>
      )}

      {tab === 'catalogo' && (
        <Card className="premium-card">
          <SectionHeader
            title="Catálogo de vacunas personalizado"
            description="Administra el catálogo de vacunas custom de tu clínica. Las vacunas base provistas por el sistema son de sólo lectura."
          />
          <div className="mt-4 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3">Vacunas registradas</h3>
              {catalogoQuery.isLoading && <p className="text-sm text-slate-500">Cargando catálogo...</p>}
              {(!catalogoQuery.data || catalogoQuery.data.length === 0) && !catalogoQuery.isLoading && (
                <p className="text-sm text-slate-500">No hay vacunas en el catálogo.</p>
              )}
              <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                {(catalogoQuery.data ?? []).map((item) => {
                  const isCustom = item.origen === 'custom';
                  const isEditing = editCatalogoId === item.id;

                  if (isEditing) {
                    return (
                      <div key={item.id} className="p-3 bg-slate-50 grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs font-semibold text-slate-600">
                            Nombre
                            <input
                              type="text"
                              value={editCatalogoNombre}
                              onChange={(e) => setEditCatalogoNombre(e.target.value)}
                              className="w-full mt-1 min-h-8 rounded border border-slate-200 px-2 text-xs outline-none focus:border-accent"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Especie
                            <select
                              value={editCatalogoEspecie}
                              onChange={(e) => setEditCatalogoEspecie(e.target.value)}
                              className="w-full mt-1 min-h-8 rounded border border-slate-200 px-2 text-xs outline-none focus:border-accent bg-white"
                            >
                              <option value="perro">Perro</option>
                              <option value="gato">Gato</option>
                              <option value="ave">Ave</option>
                              <option value="reptil">Reptil</option>
                              <option value="otro">Otro</option>
                            </select>
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs font-semibold text-slate-600">
                            Intervalo (días)
                            <input
                              type="number"
                              value={editCatalogoIntervalo ?? ''}
                              onChange={(e) => setEditCatalogoIntervalo(e.target.value ? parseInt(e.target.value) : undefined)}
                              className="w-full mt-1 min-h-8 rounded border border-slate-200 px-2 text-xs outline-none focus:border-accent"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Descripción
                            <input
                              type="text"
                              value={editCatalogoDescripcion}
                              onChange={(e) => setEditCatalogoDescripcion(e.target.value)}
                              className="w-full mt-1 min-h-8 rounded border border-slate-200 px-2 text-xs outline-none focus:border-accent"
                            />
                          </label>
                        </div>
                        <div className="flex gap-2 justify-end mt-1">
                          <Button
                            variant="ghost"
                            onClick={() => setEditCatalogoId(null)}
                            className="px-2 py-1 text-xs"
                          >
                            Cancelar
                          </Button>
                          <Button
                            disabled={!editCatalogoNombre || actualizarCatalogoMut.isPending}
                            onClick={() =>
                              actualizarCatalogoMut.mutate({
                                id: item.id!,
                                data: {
                                  nombre: editCatalogoNombre,
                                  especie: editCatalogoEspecie,
                                  intervaloDias: editCatalogoIntervalo,
                                  descripcion: editCatalogoDescripcion || undefined,
                                },
                              })
                            }
                            className="px-2 py-1 text-xs"
                          >
                            Guardar
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.codigo || item.id} className="p-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-800">{item.nombre}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                            isCustom ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isCustom ? 'Personalizada' : 'Base'}
                          </span>
                          <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.2 capitalize">
                            {item.especie}
                          </span>
                        </div>
                        {item.descripcion && (
                          <p className="text-xs text-slate-500 mt-1 truncate">{item.descripcion}</p>
                        )}
                        {item.intervaloDias && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Intervalo: {item.intervaloDias} días
                          </p>
                        )}
                      </div>
                      {isCustom && puedeGestionarCatalogo && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            onClick={() => {
                              setEditCatalogoId(item.id!);
                              setEditCatalogoNombre(item.nombre);
                              setEditCatalogoEspecie(item.especie);
                              setEditCatalogoIntervalo(item.intervaloDias);
                              setEditCatalogoDescripcion(item.descripcion ?? '');
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs text-red-600 hover:text-red-700"
                            disabled={eliminarCatalogoMut.isPending}
                            onClick={() => {
                              if (window.confirm(`¿Seguro que deseas archivar la vacuna "${item.nombre}" del catálogo?`)) {
                                eliminarCatalogoMut.mutate(item.id!);
                              }
                            }}
                          >
                            Archivar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {puedeGestionarCatalogo ? (
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Agregar al catálogo</h3>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Nombre de la vacuna *
                    <input
                      type="text"
                      required
                      placeholder="Ej. Parvovirus"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none bg-white focus:border-accent"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Especie *
                    <select
                      value={nuevaEspecie}
                      onChange={(e) => setNuevaEspecie(e.target.value)}
                      className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none bg-white focus:border-accent"
                    >
                      <option value="perro">Perro</option>
                      <option value="gato">Gato</option>
                      <option value="ave">Ave</option>
                      <option value="reptil">Reptil</option>
                      <option value="otro">Otro</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Intervalo sugerido (días)
                    <input
                      type="number"
                      placeholder="Ej. 365"
                      value={nuevoIntervalo ?? ''}
                      onChange={(e) => setNuevoIntervalo(e.target.value ? parseInt(e.target.value) : undefined)}
                      className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none bg-white focus:border-accent"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Descripción
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={nuevaDescripcion}
                      onChange={(e) => setNuevaDescripcion(e.target.value)}
                      className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none bg-white focus:border-accent"
                    />
                  </label>
                  <Button
                    disabled={!nuevoNombre || crearCatalogoMut.isPending}
                    onClick={() => crearCatalogoMut.mutate()}
                    className="mt-2 w-full justify-center"
                  >
                    {crearCatalogoMut.isPending ? 'Agregando...' : 'Agregar vacuna'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-slate-500">
                No tienes permisos para agregar o editar el catálogo de vacunas.
              </div>
            )}
          </div>
        </Card>
      )}

    </div>
  );
};

export default AdminVeterinaria;
export { AdminVeterinaria };

function generarPasswordTemporal(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < arr.length; i += 1) {
    out += chars[arr[i] % chars.length];
  }
  return `${out}#1`;
}

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
        className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
      />
    </label>
  );
}
