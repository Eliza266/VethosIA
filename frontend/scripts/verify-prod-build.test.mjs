import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = join(process.cwd(), 'scripts', 'verify-prod-build.mjs');
const PROJECT_ID = 'vethosia-5895b';
const LIVE_API = 'https://vetia-api-awdlgzrxkq-uc.a.run.app';
const TAGGED_API = 'https://p19-ab8fe87---vetia-api-awdlgzrxkq-uc.a.run.app';
const OLD_API = 'https://vetia-api-306398232425.us-central1.run.app';

const tempDirs = [];

function bundleWith(apiUrl, extras = '') {
  return `const projectId="${PROJECT_ID}";const client={baseURL:"${apiUrl}"};${extras}`;
}

function runVerifier(bundle, env = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'vetia-verify-'));
  tempDirs.push(cwd);
  mkdirSync(join(cwd, 'dist'));
  writeFileSync(join(cwd, 'dist', 'index.js'), bundle);

  const childEnv = { ...process.env };
  delete childEnv.VETIA_BUILD_TARGET;
  Object.assign(childEnv, env);

  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd,
    env: childEnv,
    encoding: 'utf8',
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('verify-prod-build', () => {
  it('acepta API principal en modo normal', () => {
    const result = runVerifier(bundleWith(LIVE_API));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OK (live)');
  });

  it('rechaza API tagged en modo normal', () => {
    const result = runVerifier(bundleWith(TAGGED_API));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('missing allowed production API');
    expect(result.stderr).toContain('unexpected API URL');
  });

  it('acepta API tagged en modo preview explicito', () => {
    const result = runVerifier(bundleWith(TAGGED_API), { VETIA_BUILD_TARGET: 'preview' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OK (preview)');
  });

  it('rechaza API externa aunque preview este activo', () => {
    const result = runVerifier(bundleWith('https://api.example.com'), {
      VETIA_BUILD_TARGET: 'preview',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('unexpected API baseURL');
  });

  it('rechaza localhost aunque preview este activo', () => {
    const result = runVerifier(bundleWith('http://localhost:8081'), {
      VETIA_BUILD_TARGET: 'preview',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('blocked pattern found: localhost API baseURL');
  });

  it('rechaza API vieja aunque preview este activo', () => {
    const result = runVerifier(bundleWith(OLD_API), { VETIA_BUILD_TARGET: 'preview' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`blocked token found: ${OLD_API}`);
  });

  it('rechaza preview si falta el proyecto Firebase esperado', () => {
    const result = runVerifier(`const client={baseURL:"${TAGGED_API}"};`, {
      VETIA_BUILD_TARGET: 'preview',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`missing Firebase projectId "${PROJECT_ID}"`);
  });

  it('conserva bloqueo de tokens prohibidos', () => {
    const result = runVerifier(bundleWith(LIVE_API, 'const key="fake-api-key";'));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('blocked token found: fake-api-key');
  });
});
