# Desplegar el frontend en Vercel

El frontend (`frontend/`, React + Vite + PWA) se despliega en Vercel; la API NestJS va en
Cloud Run (ver [DEPLOY.md](./DEPLOY.md)). El `frontend/vercel.json` ya deja listo el build y los
rewrites SPA (todas las rutas -> `/index.html`, necesario para React Router).

## Pasos
1. En Vercel: **New Project** -> importa este repositorio de Git.
2. **Root Directory:** `frontend`.
3. Framework: **Vite** (autodetectado). Build: `npm run build`. Output: `dist`. (Ya en `vercel.json`.)
4. Define las **Environment Variables** (Production y Preview) — solo `VITE_*` (config pública, NO secretos):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=vethosia-production.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=vethosia-production
VITE_FIREBASE_STORAGE_BUCKET=vethosia-production.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=https://<tu-api-en-cloud-run>      # URL del backend NestJS
VITE_USE_API_HC=true
VITE_USE_API_IA=true
VITE_USE_API_DOCS=true
VITE_USE_API_CRUD=true
VITE_WHATSAPP_COUNTRY_CODE=57
```

5. **Deploy.** En cada push a la rama, Vercel reconstruye.

## Notas
- **Ninguna clave de proveedor de IA/pagos** va en Vercel (todas son `VITE_*` = públicas). Esas
  viven solo en el backend (Cloud Run / Secret Manager). Ver [DEPLOY.md](./DEPLOY.md).
- En el proyecto Firebase, agrega el dominio de Vercel a **Authentication > Settings > Authorized
  domains** para que funcione el login con Google.
- `VITE_API_BASE_URL` debe apuntar al backend ya desplegado; con los flags en `true`, el frontend
  consume `/v1` (sin claves en el navegador).
