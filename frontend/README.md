# VetIA — Frontend

SPA en **React + Vite + TypeScript** que usa el veterinario: pacientes, consultas (con audio + IA),
historias clínicas, agenda y brigadas. Habla con **Firebase** (Auth, Firestore, Storage) y, a
medida que se encienden los feature flags, con la **API NestJS** (`/v1`).

> Para el panorama completo, mirá la [documentación del proyecto](../docs/README.md). Acá va lo
> específico del frontend.

## Stack

- **React 19 + Vite + TypeScript** (build `tsc -b && vite build`).
- **Firebase Web SDK** (auth, firestore, storage).
- **axios** para la API (con interceptor de Bearer token).
- **Vitest** (unit + caracterización) y **Playwright** (e2e).

## Arrancar en local

```powershell
cd frontend
copy .env.example .env.local     # completá los VITE_FIREBASE_*
npm install
npm run dev                      # http://localhost:5173
```

## Scripts

```powershell
npm run dev          # servidor de desarrollo (Vite)
npm run build        # tsc -b ; vite build
npm run typecheck    # tsc -b
npm run lint         # eslint .
npm run preview      # sirve el build
npm run test         # vitest (watch)
npm run test:run     # vitest run (CI)
npm run coverage     # cobertura v8
npm run e2e          # playwright test
npm run e2e:install  # instala los navegadores de Playwright (una vez)
```

## Estructura

```
src/
  lib/          # base reusable: firebase, apiClient, featureFlags, errors, mappers, orgContext
  features/     # por dominio: auth, pacientes, consultas, brigadas -> api.ts + hooks
    consultas/  # + pdf.ts, sharing.ts, components/ (DetalleConsulta partido en 4)
  pages/        # rutas (Dashboard, Pacientes, DetalleConsulta, Agenda, Brigadas, ...)
  components/   # UI compartida (Layout, Navbar, SoapViewer, AudioRecorder, ...)
  shared/       # barrel de components/
  services/     # camino legacy: gemini.ts, whisper.ts (Gemini desde el cliente)
  hooks/        # shims de re-export a features/* (compat, no romper imports viejos)
  types/        # tipos del dominio (Veterinario, Paciente, Consulta, Organizacion, ...)
  test/         # setup de Vitest
e2e/            # Playwright (smoke + flujo-principal fixme)
```

La capa `lib/` es la base; `features/` tiene la lógica por dominio; `pages/` y `components/` son UI.
Las rutas viejas (`hooks/`, `services/firebase.ts`) quedaron como **shims de re-export** para no
romper imports existentes.

## Feature flags (Strangler Fig)

El front puede usar el camino viejo (Firebase directo + Cloud Functions + Gemini en el cliente) o la
**API nueva**. Lo decide por flag, **apagados por defecto** (comportamiento idéntico al actual).

| Flag (en `.env.local`) | Enciende |
|---|---|
| `VITE_USE_API_HC` | Numerar HC vía API |
| `VITE_USE_API_IA` | Transcribir + SOAP vía API |
| `VITE_USE_API_DOCS` | PDF + email vía API |

Migrá de a uno: prendé un flag, probá, y si algo falla lo apagás. Detalle en [docs/API.md](../docs/API.md#feature-flags).

## Variables de entorno

Copiá `.env.example` a `.env.local`. Solo las `VITE_` llegan al navegador.

- `VITE_FIREBASE_*` — config pública del cliente (no son secretos).
- `VITE_API_BASE_URL` — base de la API (local: `http://localhost:8080`).
- `VITE_USE_API_HC` / `VITE_USE_API_IA` / `VITE_USE_API_DOCS` — feature flags.
- `VITE_WHATSAPP_COUNTRY_CODE` — prefijo por defecto si el propietario no trae `codigoPais` (default `57`).

> **La API key de Gemini NO va en el frontend.** Vive solo server-side (`api/` y `functions/`).
> Exponerla en el cliente fue uno de los problemas que cerró la refactorización.

## Tests

Vitest corre unit + caracterización (54 tests verdes). Playwright corre los e2e (`smoke` activo;
`flujo-principal` es `fixme` documentado). Detalle completo en [docs/TESTING.md](../docs/TESTING.md).

```powershell
npm run test:run
npm run e2e:install ; npm run e2e
```

## Convenciones

- TypeScript estricto, **sin `any` nuevos**.
- Comentarios que explican el **porqué**, no el qué (ver [docs/TESTING.md](../docs/TESTING.md#convención-de-comentarios-estilo-humano)).
- Updates optimistas en los hooks (no refetch total).
- Auth **fail-closed**: ante error leyendo la whitelist, no se deja pasar.
