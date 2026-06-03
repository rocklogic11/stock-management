param(
  [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$serverDir = Join-Path $repoRoot "server"
$webDir = Join-Path $repoRoot "web"
$startedServer = $false
$serverProcess = $null

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host "==> $Name"
  & $Action
}

function Test-Health {
  param([string]$Url)

  try {
    $response = Invoke-RestMethod -Uri "$Url/api/health" -Method Get -TimeoutSec 3
    return $response.code -eq 200
  } catch {
    return $false
  }
}

try {
  Invoke-Step "Run database migration" {
    Push-Location $serverDir
    npm run migrate:barcode-images
    Pop-Location
  }

  Invoke-Step "Check backend JavaScript syntax" {
    $files = @(
      "src/app.js",
      "src/routes/categories.js",
      "src/routes/products.js",
      "src/routes/inbound-orders.js",
      "src/routes/inventory-orders.js",
      "src/routes/upload.js",
      "src/middleware/auth.js",
      "src/config/index.js",
      "src/utils/permissions.js",
      "src/scripts/release-smoke-test.js",
      "src/scripts/p0-regression-test.js",
      "src/scripts/validate-production-env.js"
    )
    Push-Location $serverDir
    foreach ($file in $files) {
      node --check $file
    }
    Pop-Location
  }

  Invoke-Step "Build frontend" {
    Push-Location $webDir
    npm run build
    Pop-Location
  }

  if (-not (Test-Health -Url $BaseUrl)) {
    Invoke-Step "Start local backend for smoke test" {
      $serverLog = Join-Path $repoRoot "release-server.log"
      $serverErrorLog = Join-Path $repoRoot "release-server-error.log"
      $serverProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run","start" -WorkingDirectory $serverDir -WindowStyle Hidden -PassThru -RedirectStandardOutput $serverLog -RedirectStandardError $serverErrorLog
      $startedServer = $true

      $ready = $false
      for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Health -Url $BaseUrl) {
          $ready = $true
          break
        }
      }

      if (-not $ready) {
        throw "Local backend did not become healthy at $BaseUrl"
      }
    }
  }

  Invoke-Step "Run release smoke test" {
    Push-Location $serverDir
    $env:SMOKE_BASE_URL = $BaseUrl
    npm run smoke:release
    Pop-Location
  }

  Invoke-Step "Run P0 regression test" {
    Push-Location $serverDir
    $env:SMOKE_BASE_URL = $BaseUrl
    npm run test:p0
    Pop-Location
  }

  Write-Host "Release check passed."
} finally {
  if ($startedServer -and $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
