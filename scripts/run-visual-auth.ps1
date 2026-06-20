#Requires -Version 5.1
<#
.SYNOPSIS
  Smoke visual autenticado por rol (Playwright). No imprime credenciales ni tokens.

.DESCRIPTION
  Carga variables desde frontend/.env.e2e.local (gitignored), valida presencia sin
  mostrar valores sensibles, limpia sesiones locales (.auth/) y ejecuta typecheck,
  build, tests unitarios y Playwright visual.

  Modos:
    Pre-deploy local  — frontend dev ya corriendo; usar -BaseUrl http://127.0.0.1:5173
    Post-deploy prod  — build desplegado; usar -BaseUrl https://vethosia-production.web.app

  Ejemplos:
    # Pre-deploy (terminal 1: cd frontend && npm run dev)
    .\scripts\run-visual-auth.ps1 -BaseUrl "http://127.0.0.1:5173"

    # Post-deploy producción demo
    .\scripts\run-visual-auth.ps1 -BaseUrl "https://vethosia-production.web.app"

    # Playwright visible (depuración)
    .\scripts\run-visual-auth.ps1 -BaseUrl "http://127.0.0.1:5173" -Headed

    # Omitir build (solo validación rápida local)
    .\scripts\run-visual-auth.ps1 -BaseUrl "http://127.0.0.1:5173" -SkipBuild

.PARAMETER BaseUrl
  Sobrescribe E2E_BASE_URL tras cargar .env.e2e.local

.PARAMETER Headed
  Ejecuta Playwright con navegador visible

.PARAMETER UpdateSnapshots
  Pasa --update-snapshots a Playwright (opcional; no aplica a capturas PNG manuales)

.PARAMETER SkipBuild
  Omite npm run build (default: build se ejecuta)
#>
[CmdletBinding()]
param(
  [string]$BaseUrl,
  [switch]$Headed,
  [switch]$UpdateSnapshots,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$FrontendRoot = Join-Path $RepoRoot 'frontend'
$EnvFile = Join-Path $FrontendRoot '.env.e2e.local'
$AuthDir = Join-Path $FrontendRoot '.auth'
$ScreenshotDir = Join-Path $FrontendRoot 'e2e-screenshots\visual-refresh-auth'
$DefaultLocalApiProxyTarget = 'https://vetia-api-cwepwj6irq-uc.a.run.app'
$DefaultFirebaseWebAppId = '1:306398232425:web:3d5edaa1dda496e4f2c7f8'

$RequiredVars = @(
  'E2E_BASE_URL'
  'E2E_DEMO_VETERINARIO_EMAIL'
  'E2E_DEMO_VETERINARIO_PASSWORD'
  'E2E_DEMO_ADMIN_VET_EMAIL'
  'E2E_DEMO_ADMIN_VET_PASSWORD'
  'E2E_DEMO_ADMIN_ENTIDAD_EMAIL'
  'E2E_DEMO_ADMIN_ENTIDAD_PASSWORD'
  'E2E_DEMO_SUPERADMIN_EMAIL'
  'E2E_DEMO_SUPERADMIN_PASSWORD'
)

function Import-DotEnvFile {
  param([Parameter(Mandatory)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host 'ERROR: No se encontro frontend/.env.e2e.local'
    Write-Host 'Copia frontend/.env.e2e.example a frontend/.env.e2e.local y define las variables (sin commitear).'
    exit 1
  }

  foreach ($rawLine in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $line = $rawLine.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith('#')) { continue }

    if ($line.StartsWith('export ')) {
      $line = $line.Substring(7).Trim()
    }

    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { continue }

    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()

    if ($value.Length -ge 2) {
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }

    if ($name.Length -gt 0) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

function Test-EnvPresent {
  param([Parameter(Mandatory)][string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
  return -not [string]::IsNullOrWhiteSpace($value)
}

function Test-EmailRealDisabled {
  $val = [Environment]::GetEnvironmentVariable('VITE_EMAIL_REAL_ENABLED', 'Process')
  if ([string]::IsNullOrWhiteSpace($val)) { return $true }
  $normalized = $val.Trim().ToLowerInvariant()
  return $normalized -in @('false', '0', 'off', 'no', '')
}

function Ensure-PublicFirebaseWebConfig {
  $firebaseVars = @(
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  )

  $missingFirebaseVars = @()
  foreach ($name in $firebaseVars) {
    if (-not (Test-EnvPresent -Name $name)) {
      $missingFirebaseVars += $name
    }
  }
  if ($missingFirebaseVars.Count -eq 0) {
    return $false
  }

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $sdkJson = & firebase apps:sdkconfig WEB $DefaultFirebaseWebAppId --project vethosia-production --json 2>$null
  $sdkExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference

  if ($sdkExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($sdkJson)) {
    Write-Host 'ERROR: No se pudo cargar la configuracion publica Firebase WEB para smoke local.'
    exit 1
  }

  $sdkConfig = ($sdkJson | ConvertFrom-Json).result.sdkConfig
  [Environment]::SetEnvironmentVariable('VITE_FIREBASE_API_KEY', [string]$sdkConfig.apiKey, 'Process')
  [Environment]::SetEnvironmentVariable('VITE_FIREBASE_AUTH_DOMAIN', [string]$sdkConfig.authDomain, 'Process')
  [Environment]::SetEnvironmentVariable('VITE_FIREBASE_PROJECT_ID', [string]$sdkConfig.projectId, 'Process')
  [Environment]::SetEnvironmentVariable('VITE_FIREBASE_STORAGE_BUCKET', [string]$sdkConfig.storageBucket, 'Process')
  [Environment]::SetEnvironmentVariable('VITE_FIREBASE_MESSAGING_SENDER_ID', [string]$sdkConfig.messagingSenderId, 'Process')
  [Environment]::SetEnvironmentVariable('VITE_FIREBASE_APP_ID', [string]$sdkConfig.appId, 'Process')
  return $true
}

function Get-RunModeLabel {
  param([Parameter(Mandatory)][string]$Url)

  if ($Url -match 'vethosia-production\.web\.app') { return 'post-deploy produccion' }
  if ($Url -match '127\.0\.0\.1|localhost') { return 'pre-deploy local' }
  return 'destino personalizado'
}

Push-Location $RepoRoot
try {
  Import-DotEnvFile -Path $EnvFile

  if ($PSBoundParameters.ContainsKey('BaseUrl') -and -not [string]::IsNullOrWhiteSpace($BaseUrl)) {
    [Environment]::SetEnvironmentVariable('E2E_BASE_URL', $BaseUrl.Trim(), 'Process')
  }

  if (-not (Test-EmailRealDisabled)) {
    Write-Host 'ERROR: VITE_EMAIL_REAL_ENABLED debe estar ausente o en false para smoke visual seguro.'
    exit 1
  }
  [Environment]::SetEnvironmentVariable('VITE_EMAIL_REAL_ENABLED', 'false', 'Process')

  $missing = @()
  foreach ($var in $RequiredVars) {
    if (-not (Test-EnvPresent -Name $var)) {
      $missing += $var
    }
  }

  if ($missing.Count -gt 0) {
    Write-Host 'ERROR: Faltan variables de entorno requeridas (solo nombres, sin valores):'
    foreach ($name in $missing) {
      Write-Host "  - $name"
    }
    exit 1
  }

  $targetUrl = [Environment]::GetEnvironmentVariable('E2E_BASE_URL', 'Process')
  $isLocalTarget = $targetUrl -match '127\.0\.0\.1|localhost'
  if ($isLocalTarget) {
    [Environment]::SetEnvironmentVariable('VITE_API_BASE_URL', '', 'Process')
    [Environment]::SetEnvironmentVariable('VITE_USE_API_HC', 'true', 'Process')
    [Environment]::SetEnvironmentVariable('VITE_USE_API_IA', 'true', 'Process')
    [Environment]::SetEnvironmentVariable('VITE_USE_API_DOCS', 'true', 'Process')
    [Environment]::SetEnvironmentVariable('VITE_USE_API_CRUD', 'true', 'Process')
    if (-not (Test-EnvPresent -Name 'DEV_API_PROXY_TARGET')) {
      [Environment]::SetEnvironmentVariable('DEV_API_PROXY_TARGET', $DefaultLocalApiProxyTarget, 'Process')
    }
    $firebaseConfigLoaded = Ensure-PublicFirebaseWebConfig
  }
  Write-Host 'OK: Variables requeridas presentes (valores no mostrados).'
  Write-Host ("Modo: " + (Get-RunModeLabel -Url $targetUrl))
  Write-Host ("E2E_BASE_URL: " + $targetUrl)
  Write-Host 'VITE_EMAIL_REAL_ENABLED: false'
  if ($isLocalTarget) {
    Write-Host 'DEV_API_PROXY_TARGET: configurado para proxy local /v1 (valor no mostrado).'
    Write-Host 'VITE_USE_API_*: true para smoke visual local via /v1.'
    if ($firebaseConfigLoaded) {
      Write-Host 'VITE_FIREBASE_*: configurado desde Firebase WEB sdkconfig (valores no mostrados).'
    }
  }

  if ($targetUrl -match '127\.0\.0\.1:5173|localhost:5173') {
    Write-Host 'Nota: pre-deploy local — asegurate de tener "npm run dev" activo en frontend.'
  }

  if (Test-Path -LiteralPath $AuthDir) {
    Remove-Item -LiteralPath $AuthDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $AuthDir -Force | Out-Null
  New-Item -ItemType Directory -Path $ScreenshotDir -Force | Out-Null
  Write-Host 'OK: .auth/ limpiado; carpeta de capturas lista.'

  Push-Location $FrontendRoot
  try {
    Write-Host '--- npm run typecheck ---'
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    if (-not $SkipBuild) {
      Write-Host '--- npm run build ---'
      npm run build
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } else {
      Write-Host '--- npm run build (omitido: -SkipBuild) ---'
    }

    Write-Host '--- npm run test:run ---'
    npm run test:run
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $playwrightArgs = @('playwright', 'test', '--config=playwright.visual.config.ts')
    if ($Headed.IsPresent) { $playwrightArgs += '--headed' }
    if ($UpdateSnapshots.IsPresent) { $playwrightArgs += '--update-snapshots' }

    Write-Host ('--- npx ' + ($playwrightArgs -join ' ') + ' ---')
    & npx @playwrightArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host 'OK: Smoke visual completado.'
    Write-Host 'Capturas: frontend/e2e-screenshots/visual-refresh-auth/'
    Write-Host 'Sesiones: frontend/.auth/ (local, gitignored)'
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
