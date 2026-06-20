/* eslint-disable no-console */
/**
 * Asigna el custom claim { rol: 'superadmin' } a un usuario de Firebase Auth.
 * Idempotente: si ya tiene rol superadmin, no hace nada.
 *
 * Uso (contra PROD vethosia-production):
 *   $env:GCLOUD_PROJECT="vethosia-production"
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="ruta/a/service-account.json"
 *   npm run set-superadmin -- --email=alguien@dominio.com
 *   npm run set-superadmin -- --uid=abc123
 *
 * Inspeccionar claims sin modificar (alias de prueba):
 *   npm run set-superadmin -- --inspect --email=gerencia+admin@nextvoiceia.com
 *
 * Tras ejecutar, el usuario debe cerrar sesion y volver a entrar, o forzar
 * getIdToken(true) en el cliente para que el ID token incluya el nuevo claim.
 *
 * RIESGO — gerencia@nextvoiceia.com:
 *   Es el admin bootstrap de la org Vethosia (rol admin, org GT1BZbIdWWS7fANv3EUW).
 *   NO convertirlo a superadmin sin decision explicita: perderia el contexto de
 *   "Admin Entidad" y ganaria acceso cross-tenant. Usar un usuario dedicado para
 *   superadmin (p. ej. gerencia+superadmin@...) o mantener admin en la cuenta principal.
 */
import * as admin from 'firebase-admin';

const PROYECTO = 'vethosia-production';
const CUENTA_BOOTSTRAP = 'gerencia@nextvoiceia.com';

type Args = {
  email?: string;
  uid?: string;
  dryRun: boolean;
  inspect: boolean;
};

function parseArgs(argv: string[]): Args {
  let email: string | undefined;
  let uid: string | undefined;
  let dryRun = false;
  let inspect = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--inspect') inspect = true;
    else if (arg.startsWith('--email=')) email = arg.slice('--email='.length).trim().toLowerCase();
    else if (arg.startsWith('--uid=')) uid = arg.slice('--uid='.length).trim();
  }
  return { email, uid, dryRun, inspect };
}

function initAdmin(): admin.app.App {
  if (admin.apps.length && admin.apps[0]) return admin.apps[0];
  const projectId = process.env.GCLOUD_PROJECT ?? PROYECTO;
  return admin.initializeApp({ projectId });
}

async function resolverUsuario(
  auth: admin.auth.Auth,
  args: Args,
): Promise<admin.auth.UserRecord> {
  if (args.uid) return auth.getUser(args.uid);
  if (args.email) return auth.getUserByEmail(args.email);
  throw new Error('Indica --email=... o --uid=...');
}

function formatearClaims(claims: Record<string, unknown> | undefined): string {
  if (!claims || Object.keys(claims).length === 0) return '(sin custom claims)';
  return JSON.stringify(claims, null, 2);
}

async function inspeccionar(auth: admin.auth.Auth, args: Args): Promise<void> {
  const user = await resolverUsuario(auth, args);
  const claims = user.customClaims ?? {};
  console.log(`[inspect] uid=${user.uid}`);
  console.log(`[inspect] email=${user.email ?? '(sin email)'}`);
  console.log(`[inspect] claims=${formatearClaims(claims as Record<string, unknown>)}`);
}

async function asignarSuperadmin(auth: admin.auth.Auth, args: Args): Promise<void> {
  const user = await resolverUsuario(auth, args);
  const email = user.email?.toLowerCase() ?? '';
  const prev = (user.customClaims ?? {}) as Record<string, unknown>;

  if (email === CUENTA_BOOTSTRAP) {
    console.warn(
      `[set-superadmin] ADVERTENCIA: ${CUENTA_BOOTSTRAP} es el admin bootstrap de Vethosia.`,
    );
    console.warn(
      '[set-superadmin] Convertirlo a superadmin cambia su experiencia (cross-tenant). Abortando.',
    );
    console.warn('[set-superadmin] Usa otra cuenta o elimina esta guarda solo si es intencional.');
    process.exitCode = 1;
    return;
  }

  if (prev.rol === 'superadmin') {
    console.log(`[set-superadmin] ${user.uid} ya tiene rol=superadmin. Nada que hacer.`);
    return;
  }

  const next = { ...prev, rol: 'superadmin' as const };
  console.log(`[set-superadmin] uid=${user.uid} email=${user.email ?? '(sin email)'}`);
  console.log(`[set-superadmin] claims actuales: ${formatearClaims(prev)}`);
  console.log(`[set-superadmin] claims nuevos:   ${formatearClaims(next)}`);

  if (args.dryRun) {
    console.log('[set-superadmin] --dry-run: no se aplicaron cambios.');
    return;
  }

  await auth.setCustomUserClaims(user.uid, next);
  console.log('[set-superadmin] Claim aplicado. El usuario debe cerrar sesion y volver a entrar');
  console.log('             o ejecutar getIdToken(true) para refrescar el ID token.');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email && !args.uid) {
    console.error('Uso: npm run set-superadmin -- --email=... | --uid=... [--dry-run] [--inspect]');
    process.exit(1);
  }

  const app = initAdmin();
  const auth = app.auth();
  const projectId = app.options.projectId ?? PROYECTO;
  console.log(`[set-superadmin] proyecto=${projectId}`);

  if (args.inspect) {
    await inspeccionar(auth, args);
    return;
  }

  await asignarSuperadmin(auth, args);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err: unknown) => {
    console.error('[set-superadmin] error:', err);
    process.exit(1);
  });
