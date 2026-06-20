# Fuentes del PDF "VetIA — Estado del Proyecto y Guía Técnica"

El PDF final esta en `docs/VetIA_Estado_y_Guia.pdf`. Cada pagina ES una imagen (estilo del PDF
de alcances): infograficos generados por IA con el texto incluido, tema obsidiana/teal.

## Estructura
- `img/page-01..14-*.png` — las 14 paginas del documento (orden por nombre).
- `img/*.png` (sin prefijo `page-`) — ilustraciones sueltas de respaldo (no se usan en el PDF).
- `build-pdf.mjs` — ensambla `img/page-*.png` en el PDF (1 imagen por pagina, sin margenes).

## Regenerar el PDF
Si cambias o reordenas las imagenes `page-*.png`:

```powershell
node docs/pdf-assets/build-pdf.mjs
```
Genera de nuevo `docs/VetIA_Estado_y_Guia.pdf`. Usa `pdfkit` desde `api/node_modules` (no instala nada).

## Reemplazar una pagina
Sustituye el `page-NN-*.png` correspondiente por una imagen del mismo aspecto (3:2, ~1024x683)
y vuelve a correr el script. El orden lo da el numero `NN` en el nombre.
