param(
  [string]$RuntimeDir = "D:\Yellow\runtime",
  [string]$PublicHealthUrl = "https://lying-jones-terminal-church.trycloudflare.com/health",
  [string]$LocalHealthUrl = "http://127.0.0.1:3010/health",
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$frontendPublic = Join-Path $root "frontend\yellow\public\yellow-next"
$dockerPublic = Join-Path $root "public\yellow-next"
$runtimeEnv = Join-Path $RuntimeDir "yellow-public-demo.env"
$runtimeCompose = Join-Path $RuntimeDir "yellow-public-demo.compose.yml"
$tunnelCompose = Join-Path $RuntimeDir "yellow-public-demo-tunnel.compose.yml"
$sourceCompose = Join-Path $root "docker-compose.yml"

foreach ($path in @($runtimeEnv, $runtimeCompose, $tunnelCompose, $sourceCompose)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Required promotion file missing: $path"
  }
}

Push-Location $root
try {
  if (-not $SkipTests) {
    & bun test `
      tests/order617-cashier-search-bounded-read-workbench.test.ts `
      tests/order611-operational-timeline.test.ts `
      tests/order611-today-glass-dashboard.test.ts `
      tests/mobile-stable-tunnel.test.ts
    if ($LASTEXITCODE -ne 0) { throw "Focused tests failed." }

    & bun run typecheck
    if ($LASTEXITCODE -ne 0) { throw "Typecheck failed." }

    & bun run boundaries
    if ($LASTEXITCODE -ne 0) { throw "Import boundary check failed." }
  }

  & bun x vite build --config frontend/yellow/vite.config.ts --outDir public/yellow-next --emptyOutDir
  if ($LASTEXITCODE -ne 0) { throw "Yellow Next production build failed." }

  if (-not (Test-Path -LiteralPath $frontendPublic)) {
    throw "Vite output folder missing: $frontendPublic"
  }
  if (-not (Test-Path -LiteralPath $dockerPublic)) {
    New-Item -ItemType Directory -Path $dockerPublic | Out-Null
  }

  & robocopy $frontendPublic $dockerPublic /MIR /NFL /NDL /NJH /NJS /NP
  if ($LASTEXITCODE -gt 3) { throw "Asset mirror failed with robocopy exit code $LASTEXITCODE." }

  & docker compose --env-file $runtimeEnv -f $sourceCompose -f $runtimeCompose -f $tunnelCompose up -d --build app
  if ($LASTEXITCODE -ne 0) { throw "Docker app rebuild failed." }

  foreach ($url in @($LocalHealthUrl, $PublicHealthUrl)) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 20
    if ($response.StatusCode -ne 200) {
      throw "Health check failed for $url with HTTP $($response.StatusCode)."
    }
  }

  Write-Host "Yellow public demo promoted from $root"
  Write-Host "Local health: $LocalHealthUrl"
  Write-Host "Public health: $PublicHealthUrl"
} finally {
  Pop-Location
}

