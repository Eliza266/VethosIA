// Load test k6 para POST /v1/consultas/:id/hc.
// Objetivo: demostrar que la numeracion por clinica NO sufre la contencion del contador
// global viejo. Por eso cada VU usa SU PROPIA org (escenario SaaS real: ~10k usuarios
// repartidos en miles de clinicas), que es justo donde el doc global reventaba.
//
// PENDIENTE de ejecutar en CI/cloud: requiere k6 instalado y la API desplegada (o local)
// con tokens de Firebase validos. En este entorno no se puede correr k6 real ni emitir
// tokens a escala; el script queda listo. Como correrlo:
//
//   k6 run -e API_URL=https://<run-url> -e TOKEN_PREFIX=<...> api/loadtest/hc.js
//
// Para una prueba honesta necesitas ID tokens reales por VU. Opciones:
//   - desactivar el AuthGuard en un entorno de staging (NO en prod), o
//   - pre-generar tokens del Auth emulator y pasarlos via un archivo (SharedArray).
//
// Aqui dejamos el patron con un token por env (se reusa); en staging real cada VU
// deberia traer el suyo.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const errores = new Counter('hc_errores');

export const options = {
  scenarios: {
    // rampa hasta 10k VUs sostenidos, simulando carga de muchas clinicas a la vez.
    contencion: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 1000 },
        { duration: '2m', target: 10000 },
        { duration: '2m', target: 10000 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // si el contador estuviera congestionado, la latencia p95 se dispararia y habria errores.
    http_req_duration: ['p(95)<800'],
    hc_errores: ['count<50'],
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:8080';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  // cada VU finge ser una consulta distinta de su propia clinica.
  const consultaId = `load-${__VU}-${__ITER}`;
  const res = http.post(
    `${API_URL}/v1/consultas/${consultaId}/hc`,
    null,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
    },
  );

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'trae numeroHC': (r) => {
      try {
        return typeof r.json('numeroHC') === 'string';
      } catch (_e) {
        return false;
      }
    },
  });
  if (!ok) errores.add(1);
  sleep(1);
}
