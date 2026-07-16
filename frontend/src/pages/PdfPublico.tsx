import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileWarning, Download } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { Card } from '../components/ui/Primitives';
import logoVethos from '../assets/logo-vethos.png';

interface ResolverLinkResponse {
  ok: boolean;
  downloadUrl?: string;
}

// Pagina publica (sin login) a la que llega el propietario de la mascota al abrir el
// link corto compartido por WhatsApp/correo: /pdf/:token. Reemplaza al signed URL largo
// de Storage, cuyo error de vencimiento no podiamos personalizar.
const PdfPublico: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<'cargando' | 'valido' | 'vencido'>('cargando');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setEstado('vencido');
      return;
    }
    let cancelado = false;
    apiClient
      .get<ResolverLinkResponse>(`/v1/pdf/${token}`)
      .then((res) => {
        if (cancelado) return;
        if (res.data.ok && res.data.downloadUrl) {
          setDownloadUrl(res.data.downloadUrl);
          setEstado('valido');
        } else {
          setEstado('vencido');
        }
      })
      .catch(() => {
        if (!cancelado) setEstado('vencido');
      });
    return () => {
      cancelado = true;
    };
  }, [token]);

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <Card className="w-full max-w-md text-center">
        <img src={logoVethos} alt="Vethos AI" className="mx-auto mb-4 h-14 w-14 object-contain" />

        {estado === 'cargando' && (
          <p className="text-sm font-medium text-slate-500 animate-pulse">Verificando enlace...</p>
        )}

        {estado === 'valido' && downloadUrl && (
          <>
            <h1 className="mb-2 text-lg font-black text-slate-900">Historia clínica lista</h1>
            <p className="mb-5 text-sm text-slate-500">
              Descarga el documento en formato PDF con la información de la consulta.
            </p>
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Download className="h-4 w-4" />
              Descargar PDF
            </a>
          </>
        )}

        {estado === 'vencido' && (
          <>
            <FileWarning className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--warn)' }} />
            <h1 className="mb-2 text-lg font-black text-slate-900">Este enlace venció</h1>
            <p className="text-sm text-slate-500">
              Pide un nuevo enlace a tu veterinaria para volver a ver la historia clínica.
            </p>
          </>
        )}
      </Card>
    </div>
  );
};

export default PdfPublico;
export { PdfPublico };
