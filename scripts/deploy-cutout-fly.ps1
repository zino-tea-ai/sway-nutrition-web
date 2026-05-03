param(
  [string]$AppName = "vilo-cutout-api-zino",
  [string]$Region = "nrt",
  [string]$CutoutModel = "isnet-general-use",
  [string]$EnvPath = ".env",
  [string]$VercelOrigin = "https://sway-nutrition-web.vercel.app",
  [switch]$SkipVercelEnv,
  [switch]$SkipVercelDeploy
)

$ErrorActionPreference = "Stop"

function Import-DotEnv {
  param([string]$Path)
  if (!(Test-Path $Path)) {
    return
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -and !$line.StartsWith("#") -and $line.Contains("=")) {
      $name, $value = $line.Split("=", 2)
      $name = $name.Trim()
      $value = $value.Trim().Trim('"').Trim("'")
      if ($name -and !(Test-Path "env:$name")) {
        Set-Item -Path "env:$name" -Value $value
      }
    }
  }
}

function Require-Command {
  param([string]$Name)
  if (!(Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Cyan
  & $Command
}

function Set-VercelEnv {
  param(
    [string]$Name,
    [string]$Value,
    [string]$Environment
  )

  $Value | vercel env rm $Name $Environment --yes *> $null
  $Value | vercel env add $Name $Environment
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set Vercel env $Name for $Environment"
  }
}

Import-DotEnv -Path $EnvPath
Import-DotEnv -Path ".env.local"

Require-Command "node"
Require-Command "vercel"

$flyCommand = Get-Command "flyctl" -ErrorAction SilentlyContinue
if (!$flyCommand) {
  $flyCommand = Get-Command "fly" -ErrorAction SilentlyContinue
}
if (!$flyCommand) {
  throw "Missing Fly CLI. Install it, then rerun: winget install Fly.Flyctl"
}
$fly = $flyCommand.Source

if (!$env:OPENROUTER_API_KEY -and !$env:VILO_OPENROUTER_API_KEY) {
  throw "OPENROUTER_API_KEY is missing. Set it in the shell or put it in $EnvPath."
}
$openRouterKey = if ($env:OPENROUTER_API_KEY) { $env:OPENROUTER_API_KEY } else { $env:VILO_OPENROUTER_API_KEY }

$backendOrigin = "https://$AppName.fly.dev"
$cutoutEndpoint = "$backendOrigin/api/cutout"
$analyzeEndpoint = "$backendOrigin/api/analyze-food"

Invoke-Step "Check Fly auth" {
  & $fly auth whoami
  if ($LASTEXITCODE -ne 0) {
    & $fly auth login
    & $fly auth whoami
  }
}

Invoke-Step "Ensure Fly app exists" {
  & $fly apps create $AppName
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Fly app may already exist; continuing."
  }
}

Invoke-Step "Set Fly secrets" {
  & $fly secrets set OPENROUTER_API_KEY="$openRouterKey" --app $AppName
}

Invoke-Step "Deploy cutout API to Fly" {
  & $fly deploy --config fly.toml --app $AppName --remote-only --build-arg "VILO_CUTOUT_MODEL=$CutoutModel"
}

Invoke-Step "Smoke test Fly cutout API" {
  node scripts/public-cutout-smoke.mjs `
    --cutout-endpoint $cutoutEndpoint `
    --model $CutoutModel `
    --origin $VercelOrigin
}

if (!$SkipVercelEnv) {
  Invoke-Step "Set Vercel frontend env" {
    foreach ($environment in @("production", "preview")) {
      Set-VercelEnv -Name "VITE_VILO_CUTOUT_ENDPOINT" -Value $cutoutEndpoint -Environment $environment
      Set-VercelEnv -Name "VITE_VILO_ANALYZE_ENDPOINT" -Value $analyzeEndpoint -Environment $environment
      Set-VercelEnv -Name "VITE_VILO_REMOTE_CUTOUT_MODEL" -Value $CutoutModel -Environment $environment
    }
  }
}

if (!$SkipVercelDeploy) {
  Invoke-Step "Deploy Vercel production frontend" {
    vercel deploy --prod --yes
  }
}

Write-Host ""
Write-Host "Cutout API: $cutoutEndpoint" -ForegroundColor Green
Write-Host "Analyze API: $analyzeEndpoint" -ForegroundColor Green
Write-Host "Frontend: $VercelOrigin/sticker-lab" -ForegroundColor Green
