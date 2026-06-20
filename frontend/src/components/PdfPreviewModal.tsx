import React from 'react';
import { Card, Button } from './ui/Primitives';

// Vista previa del PDF antes de descargar (PDF 04.D). Muestra el signed URL en un iframe.
const PdfPreviewModal: React.FC<{
  url: string | null;
  nombreArchivo?: string;
  onClose: () => void;
}> = ({ url, nombreArchivo = 'historia.pdf', onClose }) => {
  if (!url) return null;
  return (
    <div
      role="dialog"
      aria-label="Vista previa del PDF"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(820px, 96vw)' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontWeight: 700 }}>Vista previa</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={url} download={nombreArchivo} target="_blank" rel="noreferrer">
                <Button>Descargar</Button>
              </a>
              <Button variant="ghost" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
          <iframe title="Vista previa PDF" src={url} style={{ width: '100%', height: '70vh', border: '1px solid var(--border)', borderRadius: 8 }} />
        </Card>
      </div>
    </div>
  );
};

export default PdfPreviewModal;
export { PdfPreviewModal };
