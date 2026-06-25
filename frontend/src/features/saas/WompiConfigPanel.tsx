import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, SectionHeader } from '../../components/ui/Primitives';
import { configurarWompi, type ConfigurarWompiRequest, type PagosConfigResponse } from './api';
import { getErrorMessage } from '../../lib/errors';

interface WompiConfigPanelProps {
  config: PagosConfigResponse;
}

const WompiConfigPanel: React.FC<WompiConfigPanelProps> = ({ config }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState<ConfigurarWompiRequest>({
    publicKey: '',
    privateKey: '',
    eventsSecret: '',
    integritySecret: '',
  });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const guardar = useMutation({
    mutationFn: () => configurarWompi(form),
    onSuccess: () => {
      setOk('Configuración guardada. Los secretos no se muestran de nuevo por seguridad.');
      setError('');
      setForm({ publicKey: '', privateKey: '', eventsSecret: '', integritySecret: '' });
      void qc.invalidateQueries({ queryKey: ['pagos-config-me'] });
    },
    onError: (e) => {
      setOk('');
      setError(getErrorMessage(e, 'No se pudo guardar la configuración de Wompi.'));
    },
  });

  if (!config.puedeConfigurar) return null;

  return (
    <section
      aria-label="Configurar pagos Wompi"
      className="rounded-2xl border border-[color-mix(in_srgb,var(--accent)_18%,var(--border))] bg-[var(--surface)] p-5 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.45)]"
    >
      <SectionHeader
        title="Wompi en modo seguro"
        description="Las credenciales se capturan como campos protegidos y se envían solo al servidor. No se muestran valores guardados ni se activa checkout real desde esta vista."
        action={<Badge estado={config.estado}>{config.estado}</Badge>}
      />
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm font-semibold text-amber-800">
        Controlado por plataforma: no pegues credenciales productivas en ambientes de prueba o demo.
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(
          [
            ['publicKey', 'Public key'],
            ['privateKey', 'Private key'],
            ['eventsSecret', 'Events secret'],
            ['integritySecret', 'Integrity secret'],
          ] as const
        ).map(([field, label]) => (
          <label key={field} className="grid gap-1">
            <span className="text-xs font-bold text-slate-700">{label}</span>
            <input
              type="password"
              autoComplete="off"
              aria-label={label}
              value={form[field]}
              onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando...' : 'Guardar configuración Wompi'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {ok && (
        <p role="status" className="mt-3 text-sm font-medium text-accent">
          {ok}
        </p>
      )}
    </section>
  );
};

export default WompiConfigPanel;
export { WompiConfigPanel };
