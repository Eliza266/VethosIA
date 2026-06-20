import { apiClient } from '../../lib/apiClient';

export interface SystemConfigPublicView {
  defaults: {
    suscripcionDiasPorVencer: number;
    suscripcionDiasGracia: number;
    consumoAlertaPorcentaje: number;
    sesionInactivaHoras: number;
    citaProximaHoras: number;
    citaDiaAnteriorHoras: number;
    vacunasVentanaProximaDias: number;
    invitacionTtlHoras: number;
  };
  integrations: {
    email: {
      mode: 'mock' | 'provider_configured' | 'disabled';
      realProviderConfigured: boolean;
      mockAllowed: boolean;
    };
    whatsapp: {
      mode: 'safe_link_only';
      realApiEnabled: false;
    };
    wompi: {
      mode: 'server_side_tenant_config';
      checkoutGlobalEnabled: false;
      globalSecretsPresent: boolean;
      baseUrl: string;
    };
    jobs: {
      queueDriver: string;
      schedulerAutoRunEnabled: false;
      workerGuard: 'x-worker-secret';
      workerUrlConfigured: boolean;
    };
  };
  notes: string[];
}

export const obtenerConfiguracionPlataforma = async (): Promise<SystemConfigPublicView> => {
  const res = await apiClient.get<SystemConfigPublicView>('/v1/sistema/configuracion');
  return res.data;
};
