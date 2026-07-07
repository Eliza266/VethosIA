import React from 'react';
import { useMe } from '../features/tenant/hooks';
import { MetricsPanel } from '../features/metricas/MetricsPanel';
import { PageHeader } from '../components/ui/Primitives';

// Modulo dedicado de metricas: antes esta ruta era un stub; ahora muestra el mismo
// MetricsPanel que ya se usaba (metido dentro de "Mi veterinaria"), con su propio
// espacio en vez de competir con el resumen operativo o la gestion de la sede.
const Metricas: React.FC = () => {
  const { data: me } = useMe();
  const rol = me?.role ?? me?.rol ?? null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        badge="Operación centralizada"
        title="Métricas"
        description="Consultas, consumo de IA, diagnósticos y desempeño por veterinario y por sede."
      />
      <MetricsPanel rol={rol} />
    </div>
  );
};

export default Metricas;
export { Metricas };
