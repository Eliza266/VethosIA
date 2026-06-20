# P1.7-FIX minimo - resultado harness Brigadas

Fecha local: 2026-06-19

## Alcance

Se corrigio solo la serializacion local de Brigadas para no persistir campos `undefined` en Firestore. No se cambio configuracion global de Firestore ni se uso `ignoreUndefinedProperties`.

## Emuladores

- Firestore: `127.0.0.1:8080`
- Auth: `127.0.0.1:9099`
- Storage: `127.0.0.1:9199`
- `GCLOUD_PROJECT=vethosia-production`
- `FIREBASE_PROJECT_ID=vethosia-production`

## Resultado

- `api npm run build`: OK.
- `api npm run test:unit -- --runInBand`: OK, 42 suites passed, 449 tests passed.
- `api npm run test:rules`: OK, 2 suites passed, 38 tests passed.
- `api npm run test:integration`: OK, 4 suites passed, 1 skipped, 27 tests passed, 1 skipped.
- `frontend npm run typecheck`: OK.
- `frontend npm run test:run`: OK, 68 files passed, 310 tests passed.
- `frontend npm run e2e -- --workers=1`: OK, 9 passed, 1 skipped.

## Nota

El skipped de integracion corresponde a suite live protegida. El skipped de e2e corresponde al flujo principal marcado como omitido. No se ejecuto produccion, deploy, push, stage, migraciones, jobs reales, email real ni WhatsApp real.
