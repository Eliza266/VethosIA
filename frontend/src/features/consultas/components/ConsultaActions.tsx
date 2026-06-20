import React from 'react';
import { useMe } from '../../tenant/hooks';
import { puedeAprobar, puedeEliminar, puedeOperarClinica } from '../../../lib/rbac';
import { getFeatureFlags } from '../../../lib/featureFlags';
import { CheckCircle2, Trash2, Download, MessageCircle, Mail } from 'lucide-react';
import { ActionBar, Button, Badge } from '../../../components/ui/Primitives';
import type { Consulta, Paciente } from '../../../types';

interface Props {
  consulta: Consulta;
  paciente: Paciente;
  isDeleting: boolean;
  isSavingDatos: boolean;
  isApproving: boolean;
  isSendingWhatsApp: boolean;
  isSendingEmail: boolean;
  onDelete: () => void;
  onSaveDatos: () => void;
  onApprove: () => void;
  onSendWhatsApp: () => void;
  onSendEmail: () => void;
  onDownloadPDF: () => void;
}

const ConsultaActions: React.FC<Props> = ({
  consulta,
  paciente,
  isDeleting,
  isSavingDatos,
  isApproving,
  isSendingWhatsApp,
  isSendingEmail,
  onDelete,
  onSaveDatos,
  onApprove,
  onSendWhatsApp,
  onSendEmail,
  onDownloadPDF,
}) => {
  const { data: me } = useMe();
  const puedeBorrar = puedeEliminar(me ?? null);
  const puedeAprobarConsulta = puedeAprobar(me ?? null);
  const puedeGuardarDatos = puedeOperarClinica(me ?? null);
  const emailRealEnabled = getFeatureFlags().emailRealEnabled;
  const esBorrador = consulta.estado === 'borrador';
  const esAprobada = consulta.estado === 'aprobada';

  return (
    <ActionBar sticky className="w-full sm:w-auto sm:justify-end">
      {esBorrador && puedeBorrar && (
        <Button variant="danger" size="sm" onClick={onDelete} disabled={isDeleting}>
          <Trash2 className="h-4 w-4" />
          {isDeleting ? 'Eliminando...' : 'Eliminar'}
        </Button>
      )}

      {esBorrador && puedeGuardarDatos && (
        <Button variant="secondary" size="sm" onClick={onSaveDatos} disabled={isSavingDatos}>
          <CheckCircle2 className="h-4 w-4" />
          {isSavingDatos ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      )}

      {esAprobada && (
        <>
          <Button
            variant="whatsapp"
            size="md"
            onClick={onSendWhatsApp}
            disabled={isSendingWhatsApp}
            title="Compartir historia clínica por WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
            {isSendingWhatsApp ? 'Enviando...' : 'WhatsApp'}
          </Button>

          {paciente?.propietario?.email && (
            <Button
              variant="ghost"
              size="md"
              onClick={onSendEmail}
              disabled={isSendingEmail}
              title={
                emailRealEnabled
                  ? 'Enviar PDF al correo del propietario'
                  : 'Email real pendiente de activación — modo demo'
              }
              style={
                emailRealEnabled
                  ? undefined
                  : {
                      background: 'var(--info-soft)',
                      color: 'var(--info)',
                      border: '1px solid color-mix(in srgb, var(--info) 24%, transparent)',
                    }
              }
            >
              <Mail className="h-4 w-4" />
              {isSendingEmail ? 'Enviando...' : 'Enviar por Email'}
              {!emailRealEnabled && (
                <Badge size="sm" estado="info">
                  Demo
                </Badge>
              )}
            </Button>
          )}

          <Button variant="primary" size="md" onClick={onDownloadPDF} title="Descargar PDF de historia clínica">
            <Download className="h-4 w-4" />
            Descargar PDF
          </Button>
        </>
      )}

      {!esAprobada && consulta.soap && puedeAprobarConsulta && (
        <Button variant="primary" size="lg" onClick={onApprove} disabled={isApproving}>
          <CheckCircle2 className="h-5 w-5" />
          {isApproving ? 'Aprobando...' : 'Aprobar Consulta'}
        </Button>
      )}
    </ActionBar>
  );
};

export default ConsultaActions;
