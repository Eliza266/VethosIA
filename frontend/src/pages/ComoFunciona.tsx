import React from 'react';
import { Card } from '../components/ui/Primitives';

const PASOS = [
  { n: 1, t: 'Selecciona o crea el paciente', d: 'Registra la mascota y su dueño. Cada paciente pertenece a tu clínica.' },
  { n: 2, t: 'Graba la consulta', d: 'Pulsa el micrófono y habla con normalidad. Puedes grabar varios momentos.' },
  { n: 3, t: 'La IA transcribe y estructura', d: 'Vethos AI convierte el audio en una nota SOAP (Subjetivo, Objetivo, Análisis, Plan).' },
  { n: 4, t: 'Revisa y aprueba', d: 'Edita lo que haga falta. Al aprobar, la historia queda en solo lectura.' },
  { n: 5, t: 'Comparte el PDF', d: 'Genera el PDF y compártelo por correo o WhatsApp con un clic.' },
];

// Pantalla "Cómo funciona" (entendible sin manual). Sirve de tour estatico de onboarding.
const ComoFunciona: React.FC = () => (
  <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 16 }}>
    <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Cómo funciona Vethos AI</h1>
    <p style={{ color: 'var(--muted)' }}>
      De la voz a la historia clínica en minutos. Estos son los pasos:
    </p>
    {PASOS.map((p) => (
      <Card key={p.n}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div
            aria-hidden
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
            }}
          >
            {p.n}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{p.t}</div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>{p.d}</div>
          </div>
        </div>
      </Card>
    ))}
  </div>
);

export default ComoFunciona;
export { ComoFunciona };
