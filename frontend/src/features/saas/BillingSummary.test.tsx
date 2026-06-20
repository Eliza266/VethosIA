import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BillingSummary from './BillingSummary';

describe('BillingSummary', () => {
  it('muestra estado vacio profesional cuando no hay recibos', () => {
    render(<BillingSummary estadoSuscripcion="activa" />);

    expect(screen.getByText('Estado de cuenta y pagos')).toBeInTheDocument();
    expect(screen.getByText('Al día')).toBeInTheDocument();
    expect(screen.getByText('Sin recibos recientes')).toBeInTheDocument();
    expect(screen.getByText(/No hay recibos confirmados/i)).toBeInTheDocument();
  });

  it('muestra recibos recientes con estado legible', () => {
    render(
      <BillingSummary
        recibos={[
          {
            id: 'rec-1',
            transactionId: 'txn-1',
            subscriptionId: 'sub-1',
            reference: 'pay-1',
            amountInCents: 250000,
            currency: 'COP',
            estado: 'emitido',
            tipo: 'recibo_fase1_no_fiscal',
            fechaEmision: '2026-06-17T10:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('pay-1')).toBeInTheDocument();
    expect(screen.getByText('2.500 COP')).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
  });

  it('muestra cartera vencida sin inventar cobros automaticos', () => {
    render(
      <BillingSummary
        cartera={{ estado: 'vencido_31_60', diasVencido: 45, requierePago: true }}
        recibos={[]}
      />,
    );

    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText(/45 d[ií]as de vencimiento/i)).toBeInTheDocument();
  });

  it('muestra pagos en linea no configurados cuando falta provider', () => {
    render(
      <BillingSummary
        pagosConfig={{
          planOwnerId: 'orgA',
          planOwnerType: 'entidad',
          provider: 'wompi',
          estado: 'incompleto',
          checkoutDisponible: false,
          puedeConfigurar: true,
        }}
      />,
    );

    expect(screen.getByText(/Pagos en l[i\u00ed]nea no configurados/i)).toBeInTheDocument();
  });
});
