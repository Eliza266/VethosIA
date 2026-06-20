import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { obtenerMetricas, obtenerConsumo } from './api';
import { Card, Skeleton } from '../../components/ui/Primitives';
import { rolLabel, type Rol } from '../../lib/rbac';

const ALCANCE_LABEL: Record<string, string> = {
  global: 'Toda la plataforma',
  entidad: 'Tu entidad',
  veterinaria: 'Tu veterinaria',
  individual: 'Tu actividad',
};

// Panel de metricas + consumo, alcance segun rol (Super Admin: global; Admin: entidad;
// Vet: individual). Los datos vienen de /v1/metricas y /v1/consumo (server-side).
const MetricsPanel: React.FC<{ rol?: Rol | null }> = ({ rol }) => {
  const metricas = useQuery({ queryKey: ['metricas'], queryFn: () => obtenerMetricas() });
  const consumo = useQuery({ queryKey: ['consumo'], queryFn: obtenerConsumo });

  if (metricas.isLoading) {
    return (
      <Card>
        <Skeleton height={20} width={180} />
      </Card>
    );
  }
  if (metricas.isError || !metricas.data) {
    return (
      <Card>
        <div style={{ color: 'var(--muted)' }}>No se pudieron cargar las métricas.</div>
      </Card>
    );
  }

  const m = metricas.data;
  const c = consumo.data;
  const topDiagnosticos = m.topDiagnosticos ?? [];
  const especies = m.distribucionEspecies ?? [];
  const consumoPorVet = m.consumoIaPorVeterinario ?? [];
  const consolidadoVeterinarias = m.consolidadoVeterinarias ?? [];
  const tarjetas = [
    { label: 'Pacientes', valor: m.pacientes },
    { label: 'Pacientes atendidos', valor: m.pacientesAtendidos ?? 0 },
    { label: 'Consultas/SOAP', valor: `${m.consultas}/${m.soapGenerados ?? 0}` },
    { label: 'SOAP usados', valor: `${m.soapUsados ?? c?.usados ?? 0}/${m.soapLimite ?? c?.limite ?? 0}` },
    { label: 'Ahorro IA', valor: `${m.tiempoAhorradoMinutos ?? 0} min` },
    { label: 'Citas programadas', valor: m.citasProgramadas ?? 0 },
    { label: 'Citas realizadas', valor: m.citasRealizadas ?? 0 },
    { label: 'No asistio', valor: m.citasNoAsistio ?? 0 },
    { label: 'Vacunas vencidas', valor: m.vacunasVencidas ?? 0 },
    { label: 'Vacunas próximas', valor: m.vacunasProximas ?? 0 },
    { label: 'Cumplimiento vacunas', valor: `${m.cumplimientoVacunacion ?? 100}%` },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          Panel — {rolLabel(rol)}
        </h2>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{ALCANCE_LABEL[m.alcance]}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {tarjetas.map((t) => (
          <Card key={t.label}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{t.valor}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{t.label}</div>
          </Card>
        ))}
      </div>

      {c && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Consumo IA ({c.periodo})</span>
            <span style={{ color: c.bloqueado ? 'var(--danger)' : 'var(--muted)' }}>
              {c.usados}/{c.limite}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)' }}>
            <div
              style={{
                height: 8,
                width: `${Math.min(100, c.porcentaje)}%`,
                borderRadius: 999,
                background: c.bloqueado ? 'var(--danger)' : c.alcanzo80 ? 'var(--warn)' : 'var(--success)',
              }}
            />
          </div>
          {c.bloqueado && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>
              Límite alcanzado: la generación con IA está bloqueada hasta el próximo periodo o cambio de plan.
            </div>
          )}
        </Card>
      )}

      {topDiagnosticos.length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Top diagnosticos</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {topDiagnosticos.map((d) => (
              <div
                key={d.nombre}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}
              >
                <span style={{ color: 'var(--text)' }}>{d.nombre}</span>
                <span style={{ color: 'var(--muted)', fontWeight: 700 }}>{d.total}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(especies.length > 0 || consumoPorVet.length > 0 || consolidadoVeterinarias.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {especies.length > 0 && (
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Distribucion por especie</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {especies.map((e) => (
                  <div key={e.clave} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text)' }}>{e.clave}</span>
                    <strong>{e.total}</strong>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {consumoPorVet.length > 0 && (
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Consumo por veterinario</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {consumoPorVet.slice(0, 6).map((v) => (
                  <div key={v.veterinarioId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text)' }}>{v.veterinarioId}</span>
                    <strong>{v.usados}/{v.limite}</strong>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {consolidadoVeterinarias.length > 0 && (
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Consolidado por sede</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {consolidadoVeterinarias.slice(0, 6).map((v) => (
                  <div key={v.veterinariaId} style={{ display: 'grid', gap: 2, fontSize: 13 }}>
                    <strong style={{ color: 'var(--text)' }}>{v.veterinariaId}</strong>
                    <span style={{ color: 'var(--muted)' }}>
                      {v.pacientes} pacientes · {v.consultas} consultas · {v.vacunasVencidas} vacunas vencidas
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default MetricsPanel;
export { MetricsPanel };
