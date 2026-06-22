/**
 * Fails the production build when the emitted bundle points at local/dev
 * services or an API host that is not explicitly allowed for production.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST_DIR = join(process.cwd(), 'dist');
const PROJECT_ID = process.env.VETIA_VERIFY_PROJECT_ID || 'vethosia-production';
const ALLOWED_API_BASE_URL =
  process.env.VETIA_VERIFY_API_URL || 'https://vetia-api-cwepwj6irq-uc.a.run.app';
const ALLOWED_API_ORIGIN = new URL(ALLOWED_API_BASE_URL).origin;
const PREVIEW_BUILD_TARGET = 'preview';
const LIVE_BUILD_TARGET = 'live';
const BUILD_TARGET = process.env.VETIA_BUILD_TARGET || LIVE_BUILD_TARGET;
const TAGGED_API_ORIGIN_REGEX =
  /^https:\/\/[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?---vetia-api-cwepwj6irq-uc\.a\.run\.app$/;
const TAGGED_API_HOST_SUFFIX = '---vetia-api-cwepwj6irq-uc.a.run.app';

const BLOCKED_TOKENS = [
  '127.0.0.1',
  'fake-api-key',
  'vetia-dd652',
  'https://vetia-api-306398232425.us-central1.run.app',
  'https://api.vethosia.com',
];

const BLOCKED_PATTERNS = [
  {
    label: 'localhost API baseURL',
    regex: /baseURL\s*:\s*[`"']https?:\/\/localhost(?::\d+)?(?:\/|[`"'])/,
  },
  {
    label: '127.0.0.1 API baseURL',
    regex: /baseURL\s*:\s*[`"']https?:\/\/127\.0\.0\.1(?::\d+)?(?:\/|[`"'])/,
  },
];

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.svg',
  '.txt',
  '.webmanifest',
]);

function collectTextFiles(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return collectTextFiles(fullPath);
    if (!entry.isFile()) return [];
    if (!TEXT_EXTENSIONS.has(extname(entry.name))) return [];

    const stats = statSync(fullPath);
    return stats.size > 0 ? [fullPath] : [];
  });
}

function isApiUrl(rawUrl) {
  try {
    const { hostname } = new URL(rawUrl);
    return (
      hostname === 'api.vethosia.com' ||
      hostname.startsWith('vetia-api-') ||
      hostname.endsWith(TAGGED_API_HOST_SUFFIX)
    );
  } catch {
    return false;
  }
}

function isAllowedApiBaseUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const isOriginOnly = url.origin === rawUrl && url.pathname === '/' && !url.search && !url.hash;
    if (!isOriginOnly) return false;
    if (BUILD_TARGET === LIVE_BUILD_TARGET) return url.origin === ALLOWED_API_ORIGIN;
    if (BUILD_TARGET === PREVIEW_BUILD_TARGET) return TAGGED_API_ORIGIN_REGEX.test(url.origin);
    return false;
  } catch {
    return false;
  }
}

function buildTargetLabel() {
  return BUILD_TARGET === PREVIEW_BUILD_TARGET ? PREVIEW_BUILD_TARGET : LIVE_BUILD_TARGET;
}

function isLocalUrl(rawUrl) {
  try {
    const { hostname } = new URL(rawUrl);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isKnownVendorLocalFallback(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === 'http:' &&
      url.hostname === 'localhost' &&
      url.port === '' &&
      url.pathname === '/' &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

const files = collectTextFiles(DIST_DIR);
if (files.length === 0) {
  console.error('[verify-prod-build] No readable text assets found in dist/.');
  process.exit(1);
}

const bundle = files.map((file) => readFileSync(file, 'utf8')).join('\n');
const failures = [];
const urls = new Set(bundle.match(/https?:\/\/[^\s"'`\\)<]+/g) ?? []);
const baseUrlMatches = bundle.matchAll(/baseURL\s*:\s*[`"'](https?:\/\/[^`"']+)[`"']/g);
const baseUrlUrls = new Set([...baseUrlMatches].map((match) => match[1]));

if (![LIVE_BUILD_TARGET, PREVIEW_BUILD_TARGET].includes(BUILD_TARGET)) {
  failures.push(`unsupported VETIA_BUILD_TARGET "${BUILD_TARGET}"`);
}

if (!bundle.includes(PROJECT_ID)) {
  failures.push(`missing Firebase projectId "${PROJECT_ID}"`);
}

if (BUILD_TARGET === LIVE_BUILD_TARGET && !bundle.includes(ALLOWED_API_BASE_URL)) {
  failures.push(`missing allowed production API "${ALLOWED_API_BASE_URL}"`);
}

if (BUILD_TARGET === PREVIEW_BUILD_TARGET && ![...urls, ...baseUrlUrls].some(isAllowedApiBaseUrl)) {
  failures.push('missing allowed preview tagged API for service "vetia-api"');
}

for (const token of BLOCKED_TOKENS) {
  if (bundle.includes(token)) {
    failures.push(`blocked token found: ${token}`);
  }
}

for (const pattern of BLOCKED_PATTERNS) {
  if (pattern.regex.test(bundle)) {
    failures.push(`blocked pattern found: ${pattern.label}`);
  }
}

for (const rawUrl of urls) {
  if (isLocalUrl(rawUrl)) {
    if (!isKnownVendorLocalFallback(rawUrl)) {
      failures.push(`local URL found: ${rawUrl}`);
    }
    continue;
  }

  if (!isApiUrl(rawUrl)) continue;

  if (!isAllowedApiBaseUrl(rawUrl)) {
    failures.push(`unexpected API URL found: ${rawUrl}`);
  }
}

for (const rawUrl of baseUrlUrls) {
  if (!isAllowedApiBaseUrl(rawUrl)) {
    failures.push(`unexpected API baseURL found: ${rawUrl}`);
  }
}

if (failures.length > 0) {
  console.error('[verify-prod-build] Production bundle rejected:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `[verify-prod-build] OK (${buildTargetLabel()}) - Firebase project is ${PROJECT_ID}.`,
);
