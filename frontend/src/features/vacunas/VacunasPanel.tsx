import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarVacunasPaciente,
  crearVacuna,
  actualizarVacuna,
  eliminarVacuna,
  marcarVacunaAplicada,
  etiquetaEstadoVacuna,
  fechaVacuna,
  toDateInput,
  type Vacuna,
} from './api';
import { useMe } from '../tenant/hooks';
import { puedeEliminar } from '../../lib/rbac';
import { Card, Button, Badge, Skeleton, useConfirm } from '../../components/ui/Primitives';
import type { Paciente } from '../../types';
import { etiquetaIntervalo, vacunasCatalogoPorEspecie } from './catalogo';

const inputStyle: React.CSSProperties = {
  padding: 8,
  border: '1px solid var(--border)',
  borderRadius: 8,
};

const hoyInput = (): string => new Date().toISOString().slice(0, 10);

const VacunasPanel: React.FC<{
  pacienteId: string;
  pacienteEspecie?: Paciente['especie'];
}> = ({ pacienteId, pacienteEspecie }) => {
  const { data: me } = useMe();
  const { confirm } = useConfirm();
  const puedeBorrar = puedeEliminar(me ?? null);
  const qc = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [catalogoCodigo, setCatalogoCodigo] = useState('');
  const [intervaloDias, setIntervaloDias] = useState<number | undefined>();
  const [aplicada, setAplicada] = useState(hoyInput());
  const [proximaDosis, setProximaDosis] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editProxima, setEditProxima] = useState('');
  const catalogo = vacunasCatalogoPorEspecie(pacienteEspecie);

  const vacunas = useQuery({
    queryKey: ['vacunas', pacienteId],
    queryFn: () => listarVacunasPaciente(pacienteId),
    enabled: !!pacienteId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vacunas', pacienteId] });

  const crear = useMutation({
    mutationFn: () =>
      crearVacuna({
        pacienteId,
        nombre,
        especie: pacienteEspecie,
        catalogoCodigo: catalogoCodigo || undefined,
        intervaloDias,
        fuente: catalogoCodigo ? 'catalogo_base' : 'personalizada',
        aplicada: aplicada || undefined,
        proximaDosis: proximaDosis || undefined,
      }),
    onSuccess: () => {
      setNombre('');
      setCatalogoCodigo('');
      setIntervaloDias(undefined);
      setAplicada(hoyInput());
      setProximaDosis('');
      invalidate();
    },
  });

  const actualizar = useMutation({
    mutationFn: ({ id, campos }: { id: string; campos: Partial<Vacuna> }) =>
      actualizarVacuna(pacienteId, id, campos),
    onSuccess: () => {
      setEditId(null);
      invalidate();
    },
  });

  const aplicar = useMutation({
    mutationFn: (id: string) => marcarVacunaAplicada(pacienteId, id, { aplicada: hoyInput() }),
    onSuccess: () => invalidate(),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarVacuna(pacienteId, id),
    onSuccess: () => invalidate(),
  });

  const iniciarEdicion = (v: Vacuna) => {
    setEditId(v.id);
    setEditNombre(v.nombre);
    setEditProxima(toDateInput(v.proximaDosis));
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setEditNombre('');
    setEditProxima('');
  };

  const seleccionarCatalogo = (codigo: string) => {
    setCatalogoCodigo(codigo);
    const item = catalogo.find((v) => v.codigo === codigo);
    if (!item) return;
    setNombre(item.nombre);
    setIntervaloDias(item.intervaloDias);
  };

  const confirmarEliminar = async (v: Vacuna) => {
    const ok = await confirm({
      title: 'Archivar vacuna',
      message: `¿Archivar la vacuna "${v.nombre}"? El historial se conserva.`,
      confirmLabel: 'Archivar',
      variant: 'danger',
    });
    if (!ok) return;
    eliminar.mutate(v.id);
  };

  const errorMsg =
    (vacunas.error && 'No se pudieron cargar las vacunas.') ||
    (crear.error && 'Error al agregar la vacuna.') ||
    (actualizar.error && 'Error al guardar los cambios.') ||
    (aplicar.error && 'Error al marcar la vacuna como aplicada.') ||
    (eliminar.error && 'Error al archivar la vacuna.') ||
    null;

  return (
    <Card className="shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontWeight: 800, color: 'var(--text)' }}>Vacunas</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Registro de inmunizaciones, proximas dosis y recordatorios internos del paciente.
        </p>
      </div>

      {catalogo.length > 0 && (
        <div
          aria-label="Catálogo base de vacunas"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 12,
            marginBottom: 12,
            background: 'rgba(15, 110, 86, 0.035)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <strong style={{ display: 'block', fontSize: 14 }}>Catálogo base por especie</strong>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                Solo lectura. Usa una referencia del catalogo o registra una vacuna propia.
              </span>
            </div>
            <select
              aria-label="Seleccionar vacuna del catalogo"
              value={catalogoCodigo}
              onChange={(e) => seleccionarCatalogo(e.target.value)}
              style={{ ...inputStyle, minWidth: 220, background: 'white' }}
            >
              <option value="">Usar vacuna del catalogo</option>
              {catalogo.map((item) => (
                <option key={item.codigo} value={item.codigo}>
                  {item.nombre} - {etiquetaIntervalo(item.intervaloDias)}
                </option>
              ))}
            </select>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 }}>
            {catalogo.slice(0, 5).map((item) => (
              <li key={item.codigo} style={{ fontSize: 13, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>{item.nombre}</strong> -{' '}
                {etiquetaIntervalo(item.intervaloDias)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }}>
        <input
          aria-label="Nombre de la vacuna"
          placeholder="Vacuna (ej. Rabia)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 160 }}
        />
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
          Aplicada
          <input
            aria-label="Fecha aplicada"
            type="date"
            value={aplicada}
            onChange={(e) => setAplicada(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
          Próxima
          <input
            aria-label="Próxima dosis"
            type="date"
            value={proximaDosis}
            onChange={(e) => setProximaDosis(e.target.value)}
            style={inputStyle}
          />
        </label>
        <Button disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
          {crear.isPending ? 'Agregando...' : 'Registrar'}
        </Button>
      </div>

      {errorMsg && (
        <p role="alert" style={{ color: 'var(--danger)', marginBottom: 12 }}>
          {errorMsg}
        </p>
      )}

      {vacunas.isLoading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      ) : (vacunas.data ?? []).length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--border)',
            borderRadius: 16,
            padding: 24,
            textAlign: 'center',
            color: 'var(--muted)',
            background: 'rgba(148, 163, 184, 0.08)',
          }}
        >
          <strong style={{ display: 'block', color: 'var(--text)', marginBottom: 4 }}>
            Sin vacunas registradas.
          </strong>
          <span style={{ fontSize: 13 }}>
            Registra una vacuna aplicada o una proxima dosis para iniciar el seguimiento.
          </span>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {(vacunas.data ?? []).map((v) => {
            const fecha = fechaVacuna(v);
            const editando = editId === v.id;

            if (editando) {
              return (
                <li
                  key={v.id}
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    padding: 8,
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}
                >
                  <input
                    aria-label="Editar nombre"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    style={{ ...inputStyle, flex: 1, minWidth: 120 }}
                  />
                  <input
                    aria-label="Editar proxima dosis"
                    type="date"
                    value={editProxima}
                    onChange={(e) => setEditProxima(e.target.value)}
                    style={inputStyle}
                  />
                  <Button
                    disabled={!editNombre || actualizar.isPending}
                    onClick={() =>
                      actualizar.mutate({
                        id: v.id,
                        campos: {
                          nombre: editNombre,
                          proximaDosis: editProxima || undefined,
                        },
                      })
                    }
                  >
                    {actualizar.isPending ? 'Guardando...' : 'Guardar'}
                  </Button>
                  <Button variant="ghost" onClick={cancelarEdicion}>
                    Cancelar
                  </Button>
                </li>
              );
            }

            return (
              <li
                key={v.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{v.nombre}</span>
                  {fecha && (
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {v.aplicada ? 'Aplicada' : 'Próxima'}:{' '}
                      {new Date(fecha).toLocaleDateString('es-CO')}
                    </span>
                  )}
                  {v.proximaDosis && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Próxima dosis: {new Date(v.proximaDosis).toLocaleDateString('es-CO')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge estado={v.estado}>{etiquetaEstadoVacuna(v.estado)}</Badge>
                  <Button
                    variant="ghost"
                    aria-label={`Marcar aplicada ${v.nombre}`}
                    disabled={aplicar.isPending}
                    onClick={() => aplicar.mutate(v.id)}
                  >
                    Aplicada
                  </Button>
                  <Button variant="ghost" aria-label={`Editar ${v.nombre}`} onClick={() => iniciarEdicion(v)}>
                    Editar
                  </Button>
                  {puedeBorrar && (
                    <Button
                      variant="ghost"
                      aria-label={`Archivar ${v.nombre}`}
                      disabled={eliminar.isPending}
                      onClick={() => confirmarEliminar(v)}
                      style={{ color: 'var(--danger)' }}
                    >
                      {eliminar.isPending ? '...' : 'Archivar'}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export default VacunasPanel;
export { VacunasPanel };
