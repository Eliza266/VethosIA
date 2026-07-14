/* eslint-disable no-console */
/**
 * Lista todas las cuentas de Firebase Auth que tienen el custom claim { rol: 'superadmin' }.
 * Solo lectura, no modifica nada.
 *
 * Uso:
 *   $env:GCLOUD_PROJECT="vethosia-5895b"
 *   npm run list-superadmins
 */
import * as admin from 'firebase-admin';

const PROYECTO = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'vethosia-5895b';

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  return admin.initializeApp({ projectId: PROYECTO });
}

async function main(): Promise<void> {
  const app = initAdmin();
  const auth = app.auth();
  console.log(`[list-superadmins] proyecto=${PROYECTO}`);

  let encontrados = 0;
  let pageToken: string | undefined;
  do {
    const result = await auth.listUsers(1000, pageToken);
    for (const user of result.users) {
      const claims = (user.customClaims ?? {}) as Record<string, unknown>;
      if (claims.rol === 'superadmin') {
        encontrados += 1;
        console.log(`  - email=${user.email ?? '(sin email)'} uid=${user.uid} deshabilitado=${user.disabled}`);
      }
    }
    pageToken = result.pageToken;
  } while (pageToken);

  if (encontrados === 0) {
    console.log('[list-superadmins] No se encontró ninguna cuenta con rol=superadmin.');
  } else {
    console.log(`[list-superadmins] Total: ${encontrados}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[list-superadmins] error:', err);
    process.exit(1);
  });
