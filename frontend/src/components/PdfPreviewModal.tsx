import React from 'react';
import { Button } from './ui/Primitives';
import { Modal } from './ui/Modal';

// Vista previa del PDF antes de descargar (PDF 04.D). Muestra el signed URL en un iframe.
const PdfPreviewModal: React.FC<{
  url: string | null;
  nombreArchivo?: string;
  onClose: () => void;
}> = ({ url, nombreArchivo = 'historia.pdf', onClose }) => {
  return (
    <Modal
      open={!!url}
      onClose={onClose}
      title="Vista previa"
      ariaLabel="Vista previa del PDF"
      size="lg"
      footer={
        <a href={url ?? undefined} download={nombreArchivo} target="_blank" rel="noreferrer">
          <Button>Descargar</Button>
        </a>
      }
    >
      {url && (
        <iframe
          title="Vista previa PDF"
          src={url}
          style={{ width: '100%', height: '70vh', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
        />
      )}
    </Modal>
  );
};

export default PdfPreviewModal;
export { PdfPreviewModal };
