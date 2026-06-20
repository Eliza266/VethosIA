import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { aceptarInvitacion } from '../features/tenant/api';
import { Card, Button } from '../components/ui/Primitives';
import { getErrorMessage } from '../lib/errors';

// Pantalla para aceptar una invitacion (enlace unico 48h): /invitacion?token=...
const Invitacion: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'ok' | 'pendiente' | 'error'>('idle');
  const [mensaje, setMensaje] = useState('');

  const aceptar = async () => {
    setEstado('cargando');
    try {
      const res = await aceptarInvitacion(token);
      if ('estado' in res && res.estado === 'pendiente_revision_tecnica') {
        setEstado('pendiente');
        setMensaje(res.mensaje || 'La vinculación quedó pendiente de revisión técnica.');
        return;
      }
      setEstado('ok');
      setMensaje(`Te uniste a la organizacion ${res.orgId} como ${res.rol}.`);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setEstado('error');
      setMensaje(getErrorMessage(err, 'No se pudo aceptar la invitacion (puede haber expirado).'));
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '10vh auto' }}>
      <Card>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          Invitacion a Vethos AI
        </h1>
        {!token && <p style={{ color: 'var(--danger)' }}>Falta el token de invitacion en el enlace.</p>}
        {token && estado !== 'ok' && estado !== 'pendiente' && (
          <>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
              Acepta la invitacion para unirte a la entidad. El enlace es valido por 48 horas.
            </p>
            <Button onClick={aceptar} disabled={estado === 'cargando'}>
              {estado === 'cargando' ? 'Aceptando...' : 'Aceptar invitacion'}
            </Button>
          </>
        )}
        {mensaje && (
          <p
            role="alert"
            style={{
              marginTop: 16,
              color:
                estado === 'error'
                  ? 'var(--danger)'
                  : estado === 'pendiente'
                    ? '#92400e'
                    : 'var(--success)',
            }}
          >
            {mensaje}
          </p>
        )}
      </Card>
    </div>
  );
};

export default Invitacion;
export { Invitacion };
