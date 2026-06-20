import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearPlan, listarPagos, listarPlanes, type Plan } from '../features/saas/api';
import { useMe } from '../features/tenant/hooks';
import {
  aprobarSolicitudTecnica,
  listarSolicitudesTecnicas,
  rechazarSolicitudTecnica,
} from '../features/tenant/api';
import {
  actualizarEntidadGlobalBackoffice,
  actualizarVeterinariaBackoffice,
  crearEntidadBackoffice,
  crearVeterinariaBackoffice,
  listarAuditoriaBackoffice,
  listarConsumosBackoffice,
  listarEntidadesBackoffice,
  listarMiembrosBackoffice,
  listarSuscripcionesBackoffice,
  listarVeterinariasBackoffice,
  setBloqueoMiembroBackoffice,
  type BackofficeMiembro,
  type BackofficeVeterinaria,
} from '../features/backoffice/api';
import { obtenerConfiguracionPlataforma } from '../features/plataforma/api';
import { useConfirm } from '../components/ui/Primitives';
import { SuperAdminShell } from './superadmin/SuperAdminShell';
import { SuperAdminOverview } from './superadmin/SuperAdminOverview';
import { EntidadesPanel } from './superadmin/EntidadesPanel';
import { VeterinariasPanel } from './superadmin/VeterinariasPanel';
import { UsuariosPanel } from './superadmin/UsuariosPanel';
import { PlanesPanel } from './superadmin/PlanesPanel';
import { SuscripcionesPanel } from './superadmin/SuscripcionesPanel';
import { PagosPanel } from './superadmin/PagosPanel';
import { AuditoriaPanel } from './superadmin/AuditoriaPanel';
import { ConfiguracionPanel } from './superadmin/ConfiguracionPanel';
import { AreaTecnicaPanel } from './superadmin/AreaTecnicaPanel';
import type {
  EntidadDraft,
  SedeCreateDraft,
  SedeDraft,
  SuperAdminDataset,
  SuperAdminSection,
} from './superadmin/types';
import {
  entidadPayload,
  entidadToDraft,
  isVeterinario,
  optionalText,
} from './superadmin/utils';

const planVacio: Omit<Plan, 'id'> = {
  nombre: '',
  precioMensualCOP: 0,
  precioAnualCOP: 0,
  asientosMax: 1,
  limiteHistoriasMes: 50,
  historiasGratisTrial: 10,
  tipo: 'ambos',
  activo: true,
};

const entidadVacia: EntidadDraft = {
  nombre: '',
  tipo: '',
  direccion: '',
  ciudad: '',
  pais: '',
  telefono: '',
  emailContacto: '',
  logoUrl: '',
  estado: 'activa',
};

const sedeNuevaVacia: SedeCreateDraft = {
  entidadId: '',
  nombre: '',
  ciudad: '',
  pais: '',
  emailContacto: '',
  planOwnerType: 'entidad',
};

function sectionFromLocation(pathname: string, search: string): SuperAdminSection {
  const [pathOnly, inlineSearch = ''] = pathname.split('?');
  const effectiveSearch = search || (inlineSearch ? `?${inlineSearch}` : '');
  if (pathOnly === '/planes') return 'planes';
  if (pathOnly === '/suscripciones') return 'suscripciones';
  if (pathOnly === '/auditoria') return 'auditoria';
  if (pathOnly === '/configuracion') return 'configuracion';
  const panel = new URLSearchParams(effectiveSearch).get('panel');
  if (
    panel === 'entidades' ||
    panel === 'veterinarias' ||
    panel === 'usuarios' ||
    panel === 'pagos'
  ) {
    return panel;
  }
  return 'overview';
}

function sedePayload(input: SedeCreateDraft) {
  return {
    entidadId: input.entidadId,
    nombre: input.nombre.trim(),
    ciudad: optionalText(input.ciudad),
    pais: optionalText(input.pais),
    emailContacto: optionalText(input.emailContacto),
    planOwnerType: input.planOwnerType,
  };
}

// Consola global de plataforma. No reutiliza pantallas tenant para evitar mezclar scopes.
const SuperAdmin: React.FC = () => {
  const location = useLocation();
  const section = sectionFromLocation(location.pathname, location.search);
  const { confirm } = useConfirm();
  const { data: me } = useMe();
  const qc = useQueryClient();

  const [planDraft, setPlanDraft] = useState<Omit<Plan, 'id'>>(planVacio);
  const [entidadNueva, setEntidadNueva] = useState<EntidadDraft>(entidadVacia);
  const [entidadEditId, setEntidadEditId] = useState<string | null>(null);
  const [entidadDraft, setEntidadDraft] = useState<EntidadDraft>(entidadVacia);
  const [sedeNueva, setSedeNueva] = useState<SedeCreateDraft>(sedeNuevaVacia);
  const [sedeEditId, setSedeEditId] = useState<string | null>(null);
  const [sedeDraft, setSedeDraft] = useState<SedeDraft>({ nombre: '', ciudad: '', estado: 'activa' });

  const planes = useQuery({ queryKey: ['planes'], queryFn: listarPlanes });
  const pagos = useQuery({ queryKey: ['pagos'], queryFn: listarPagos });
  const entidades = useQuery({ queryKey: ['backoffice-entidades'], queryFn: listarEntidadesBackoffice });
  const veterinarias = useQuery({ queryKey: ['backoffice-veterinarias'], queryFn: listarVeterinariasBackoffice });
  const miembros = useQuery({ queryKey: ['backoffice-miembros'], queryFn: listarMiembrosBackoffice });
  const consumos = useQuery({ queryKey: ['backoffice-consumos'], queryFn: listarConsumosBackoffice });
  const suscripciones = useQuery({ queryKey: ['backoffice-suscripciones'], queryFn: listarSuscripcionesBackoffice });
  const auditoria = useQuery({ queryKey: ['backoffice-auditoria'], queryFn: listarAuditoriaBackoffice });
  const solicitudesTecnicas = useQuery({ queryKey: ['solicitudes-tecnicas'], queryFn: () => listarSolicitudesTecnicas() });
  const systemConfig = useQuery({ queryKey: ['plataforma-configuracion'], queryFn: obtenerConfiguracionPlataforma });

  const crearPlanMutation = useMutation({
    mutationFn: () => crearPlan(planDraft),
    onSuccess: () => {
      setPlanDraft(planVacio);
      qc.invalidateQueries({ queryKey: ['planes'] });
      qc.invalidateQueries({ queryKey: ['backoffice-auditoria'] });
    },
  });
  const aprobar = useMutation({
    mutationFn: (id: string) => aprobarSolicitudTecnica(id, 'Vinculacion aprobada por Area Tecnica.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes-tecnicas'] }),
  });
  const rechazar = useMutation({
    mutationFn: (id: string) => rechazarSolicitudTecnica(id, 'Vinculacion rechazada por Area Tecnica.'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes-tecnicas'] }),
  });
  const crearEntidad = useMutation({
    mutationFn: () => crearEntidadBackoffice(entidadPayload(entidadNueva)),
    onSuccess: () => {
      setEntidadNueva(entidadVacia);
      qc.invalidateQueries({ queryKey: ['backoffice-entidades'] });
      qc.invalidateQueries({ queryKey: ['backoffice-auditoria'] });
    },
  });
  const editarEntidad = useMutation({
    mutationFn: ({ id, input }: { id: string; input: EntidadDraft }) =>
      actualizarEntidadGlobalBackoffice(id, entidadPayload(input)),
    onSuccess: () => {
      setEntidadEditId(null);
      qc.invalidateQueries({ queryKey: ['backoffice-entidades'] });
      qc.invalidateQueries({ queryKey: ['backoffice-auditoria'] });
    },
  });
  const crearSede = useMutation({
    mutationFn: () => crearVeterinariaBackoffice(sedePayload(sedeNueva)),
    onSuccess: () => {
      setSedeNueva(sedeNuevaVacia);
      qc.invalidateQueries({ queryKey: ['backoffice-veterinarias'] });
      qc.invalidateQueries({ queryKey: ['backoffice-auditoria'] });
    },
  });
  const editarSede = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SedeDraft }) => actualizarVeterinariaBackoffice(id, input),
    onSuccess: () => {
      setSedeEditId(null);
      qc.invalidateQueries({ queryKey: ['backoffice-veterinarias'] });
      qc.invalidateQueries({ queryKey: ['backoffice-auditoria'] });
    },
  });
  const cambiarBloqueo = useMutation({
    mutationFn: ({ id, bloqueado }: { id: string; bloqueado: boolean }) => setBloqueoMiembroBackoffice(id, bloqueado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backoffice-miembros'] });
      qc.invalidateQueries({ queryKey: ['backoffice-auditoria'] });
    },
  });

  const entidadesData = entidades.data ?? [];
  const veterinariasData = veterinarias.data ?? [];
  const miembrosData = miembros.data ?? [];
  const consumosData = consumos.data ?? [];
  const veterinariosData = miembrosData.filter(isVeterinario);

  const relations = useMemo(() => {
    const entidadById = new Map<string, SuperAdminDataset['entidades'][number]>();
    const sedesByEntidad = new Map<string, BackofficeVeterinaria[]>();
    const vetsBySede = new Map<string, BackofficeMiembro[]>();
    const consumoBySede = new Map<string, SuperAdminDataset['consumos']>();
    const consumoByEntidad = new Map<string, SuperAdminDataset['consumos']>();

    entidadesData.forEach((entidad) => entidadById.set(entidad.id, entidad));
    veterinariasData.forEach((sede) => {
      const entidadId = sede.entidadId ?? sede.planOwnerId;
      if (!entidadId) return;
      sedesByEntidad.set(entidadId, [...(sedesByEntidad.get(entidadId) ?? []), sede]);
    });
    veterinariosData.forEach((vet) => {
      const sedeId = vet.veterinariaId ?? (vet.accountType === 'veterinaria' ? vet.accountId : undefined);
      if (!sedeId) return;
      vetsBySede.set(sedeId, [...(vetsBySede.get(sedeId) ?? []), vet]);
    });
    consumosData.forEach((consumo) => {
      if (consumo.veterinariaId) {
        consumoBySede.set(consumo.veterinariaId, [...(consumoBySede.get(consumo.veterinariaId) ?? []), consumo]);
      }
      if (consumo.entidadId) {
        consumoByEntidad.set(consumo.entidadId, [...(consumoByEntidad.get(consumo.entidadId) ?? []), consumo]);
      }
    });

    return { entidadById, sedesByEntidad, vetsBySede, consumoBySede, consumoByEntidad };
  }, [consumosData, entidadesData, veterinariasData, veterinariosData]);

  const data: SuperAdminDataset = {
    me,
    entidades: entidadesData,
    veterinarias: veterinariasData,
    miembros: miembrosData,
    consumos: consumosData,
    suscripciones: suscripciones.data ?? [],
    auditoria: auditoria.data ?? [],
    solicitudes: solicitudesTecnicas.data ?? [],
    planes: planes.data ?? [],
    pagos: pagos.data ?? [],
    systemConfig: systemConfig.data,
    relations,
  };

  const actionState = {
    crearPlan: crearPlanMutation.isPending,
    crearEntidad: crearEntidad.isPending,
    editarEntidad: editarEntidad.isPending,
    crearSede: crearSede.isPending,
    editarSede: editarSede.isPending,
    cambiarBloqueo: cambiarBloqueo.isPending,
    solicitudTecnica: aprobar.isPending || rechazar.isPending,
  };

  const iniciarEdicionEntidad = (entidad: SuperAdminDataset['entidades'][number]) => {
    setEntidadEditId(entidad.id);
    setEntidadDraft(entidadToDraft(entidad));
  };

  const iniciarEdicionSede = (sede: BackofficeVeterinaria) => {
    setSedeEditId(sede.id);
    setSedeDraft({ nombre: sede.nombre, ciudad: sede.ciudad ?? '', estado: sede.estado });
  };

  const toggleBloqueo = async (miembro: BackofficeMiembro) => {
    const bloqueado = miembro.bloqueado || miembro.estado === 'bloqueado';
    const ok = await confirm({
      title: bloqueado ? 'Reactivar usuario' : 'Desactivar usuario',
      message: `${bloqueado ? 'Reactivar' : 'Desactivar'} ${miembro.email ?? miembro.uid}. Esta accion afecta el acceso de la cuenta y queda auditada.`,
      confirmLabel: bloqueado ? 'Reactivar' : 'Desactivar',
      variant: bloqueado ? 'primary' : 'danger',
    });
    if (!ok) return;
    cambiarBloqueo.mutate({ id: miembro.id, bloqueado: !bloqueado });
  };

  const renderSection = () => {
    switch (section) {
      case 'entidades':
        return (
          <EntidadesPanel
            data={data}
            nueva={entidadNueva}
            setNueva={setEntidadNueva}
            editId={entidadEditId}
            draft={entidadDraft}
            setDraft={setEntidadDraft}
            onCreate={() => crearEntidad.mutate()}
            onEditStart={iniciarEdicionEntidad}
            onEditCancel={() => setEntidadEditId(null)}
            onSave={(id, input) => editarEntidad.mutate({ id, input })}
            actionState={actionState}
          />
        );
      case 'veterinarias':
        return (
          <VeterinariasPanel
            data={data}
            nueva={sedeNueva}
            setNueva={setSedeNueva}
            editId={sedeEditId}
            draft={sedeDraft}
            setDraft={setSedeDraft}
            onCreate={() => crearSede.mutate()}
            onEditStart={iniciarEdicionSede}
            onEditCancel={() => setSedeEditId(null)}
            onSave={(id, input) => editarSede.mutate({ id, input })}
            actionState={actionState}
          />
        );
      case 'usuarios':
        return <UsuariosPanel data={data} actionState={actionState} onToggleBloqueo={toggleBloqueo} />;
      case 'planes':
        return <PlanesPanel planes={data.planes} draft={planDraft} setDraft={setPlanDraft} onCreate={() => crearPlanMutation.mutate()} actionState={actionState} />;
      case 'suscripciones':
        return <SuscripcionesPanel suscripciones={data.suscripciones} consumos={data.consumos} />;
      case 'pagos':
        return <PagosPanel pagos={data.pagos} systemConfig={data.systemConfig} />;
      case 'auditoria':
        return <AuditoriaPanel eventos={data.auditoria} />;
      case 'configuracion':
        return <ConfiguracionPanel config={data.systemConfig} isLoading={systemConfig.isLoading} />;
      default:
        return (
          <>
            <SuperAdminOverview data={data} />
            <AreaTecnicaPanel
              solicitudes={data.solicitudes}
              actionState={actionState}
              onApprove={(id) => aprobar.mutate(id)}
              onReject={(id) => rechazar.mutate(id)}
            />
          </>
        );
    }
  };

  return <SuperAdminShell active={section}>{renderSection()}</SuperAdminShell>;
};

export default SuperAdmin;
export { SuperAdmin };
