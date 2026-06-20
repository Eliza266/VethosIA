// Ensambla las imagenes de pagina (docs/pdf-assets/img/page-*.png) en un PDF donde cada
// pagina ES una imagen (sin margenes), tamano = dimensiones de la imagen.
// Uso:  node docs/pdf-assets/build-pdf.mjs
// pdfkit se resuelve desde api/node_modules (no requiere instalar nada nuevo).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const PDFDocument = require(path.join(__dirname, '../../api/node_modules/pdfkit'));

const imgDir = path.join(__dirname, 'img');
const outPath = path.join(__dirname, '..', 'VetIA_Estado_y_Guia.pdf');

const paginas = fs
  .readdirSync(imgDir)
  .filter((f) => /^page-\d+.*\.png$/i.test(f))
  .sort(); // page-01..page-14 ordena bien por el cero a la izquierda

if (paginas.length === 0) {
  console.error('No se encontraron imagenes page-*.png en', imgDir);
  process.exit(1);
}

const doc = new PDFDocument({ autoFirstPage: false });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

for (const archivo of paginas) {
  const ruta = path.join(imgDir, archivo);
  const img = doc.openImage(ruta); // { width, height }
  doc.addPage({ size: [img.width, img.height], margin: 0 });
  doc.image(img, 0, 0, { width: img.width, height: img.height });
}

doc.end();

stream.on('finish', () => {
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`PDF generado: ${outPath} (${paginas.length} paginas, ${kb} KB)`);
});
