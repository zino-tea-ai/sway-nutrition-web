param(
  [string]$ProjectId = "",
  [string]$ServiceName = "vilo-cutout-api",
  [string]$Region = "us-central1",
  [string]$ArtifactRepo = "vilo",
  [string]$CutoutModel = "isnet-general-use",
  [string]$EnvPath = ".env",
  [string]$VercelOrigin = "https://sway-nutrition-web.vercel.app",
  [string]$AnalyzeProvider = "openrouter",
  [string]$Memory = "2Gi",
  [string]$Cpu = "2",
  [int]$Timeout = 120,
  [int]$Concurrency = 4,
  [int]$MaxInstances = 3,
  [switch]$SkipVercelEnv,
  [switch]$SkipVercelDeploy,
  [switch]$SkipSmoke
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
  param([string]$Name, [string]$InstallHint)
  if (!(Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name. $InstallHint"
  }
}

function Add-PortableGcloudToPath {
  if (Get-Command "gcloud" -ErrorAction SilentlyContinue) {
    return
  }

  $portable = Join-Path $env:LOCALAPPDATA "Google\CloudSDKPortable\google-cloud-sdk\bin\gcloud.cmd"
  if (Test-Path $portable) {
    $env:Path = "$(Split-Path $portable);$env:Path"
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

  vercel env rm $Name $Environment --yes *> $null
  $Value | vercel env add $Name $Environment
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set Vercel env $Name for $Environment"
  }
}

function Ensure-GcloudSuccess {
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud command failed."
  }
}

Import-DotEnv -Path $EnvPath
Import-DotEnv -Path ".env.local"

Add-PortableGcloudToPath
Require-Command "gcloud" "Install Google Cloud SDK: winget install Google.CloudSDK"
Require-Command "node" "Install Node.js."
Require-Command "vercel" "Install Vercel CLI and run: vercel login"

if (!$ProjectId) {
  $ProjectId = (gcloud config get-value project 2>$null).Trim()
}
if (!$ProjectId -or $ProjectId -eq "(unset)") {
  throw "Missing Google Cloud project. Run: gcloud config set project <PROJECT_ID> or pass -ProjectId <PROJECT_ID>."
}

$usesOpenRouter = $AnalyzeProvider.Trim().ToLower() -eq "openrouter"

if ($usesOpenRouter -and !$env:OPENROUTER_API_KEY -and !$env:VILO_OPENROUTER_API_KEY) {
  throw "OPENROUTER_API_KEY is missing. Set it in the shell or put it in $EnvPath."
}
$openRouterKey = if ($env:OPENROUTER_API_KEY) { $env:OPENROUTER_API_KEY } else { $env:VILO_OPENROUTER_API_KEY }

$tag = Get-Date -Format "yyyyMMddHHmmss"
$image = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo/${ServiceName}:$tag"

Invoke-Step "Check Google Cloud auth" {
  $activeAccount = (gcloud auth list --filter=status:ACTIVE --format="value(account)").Trim()
  Ensure-GcloudSuccess
  if (!$activeAccount) {
    throw "No active Google Cloud account. Run: gcloud auth login"
  }
  Write-Host $activeAccount
}

Invoke-Step "Enable required Google Cloud APIs" {
  gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com `
    secretmanager.googleapis.com `
    --project $ProjectId
  Ensure-GcloudSuccess
}

Invoke-Step "Ensure Artifact Registry repository" {
  gcloud artifacts repositories describe $ArtifactRepo --location $Region --project $ProjectId *> $null
  if ($LASTEXITCODE -ne 0) {
    gcloud artifacts repositories create $ArtifactRepo `
      --repository-format docker `
      --location $Region `
      --description "Vilo container images" `
      --project $ProjectId
    Ensure-GcloudSuccess
  }
}

if ($usesOpenRouter) {
  Invoke-Step "Store OpenRouter key in Secret Manager" {
    $secretFile = New-TemporaryFile
    try {
      Set-Content -LiteralPath $secretFile -Value $openRouterKey -NoNewline
      gcloud secrets describe OPENROUTER_API_KEY --project $ProjectId *> $null
      if ($LASTEXITCODE -ne 0) {
        gcloud secrets create OPENROUTER_API_KEY `
          --replication-policy automatic `
          --data-file $secretFile `
          --project $ProjectId
        Ensure-GcloudSuccess
      } else {
        gcloud secrets versions add OPENROUTER_API_KEY `
          --data-file $secretFile `
          --project $ProjectId
        Ensure-GcloudSuccess
      }
    } finally {
      Remove-Item -LiteralPath $secretFile -Force -ErrorAction SilentlyContinue
    }
  }

  Invoke-Step "Grant Cloud Run access to OpenRouter secret" {
    $projectNumber = (gcloud projects describe $ProjectId --format="value(projectNumber)").Trim()
    Ensure-GcloudSuccess
    $runtimeServiceAccount = "$projectNumber-compute@developer.gserviceaccount.com"
    gcloud secrets add-iam-policy-binding OPENROUTER_API_KEY `
      --member "serviceAccount:$runtimeServiceAccount" `
      --role roles/secretmanager.secretAccessor `
      --project $ProjectId *> $null
    Ensure-GcloudSuccess
  }
}

Invoke-Step "Build container image with Cloud Build" {
  gcloud builds submit . `
    --config services/cutout_api/cloudbuild.yaml `
    --substitutions "_IMAGE=$image,_MODEL=$CutoutModel" `
    --project $ProjectId
  Ensure-GcloudSuccess
}

$envVars = "^@^" + (@(
  "VILO_CUTOUT_MODEL=$CutoutModel",
  "VILO_MAX_UPLOAD_MB=12",
  "VILO_MAX_INPUT_PIXELS=9000000",
  "VILO_CORS_ORIGINS=$VercelOrigin,https://zino-tea-ai.github.io",
  "VILO_CORS_ORIGIN_REGEX=^https://.*\.vercel\.app$",
  "VILO_WARMUP=1",
  "VILO_ANALYZE_PROVIDER=$AnalyzeProvider",
  "VILO_OPENROUTER_MODEL=google/gemini-2.5-flash",
  "VILO_OPENROUTER_SITE_URL=$VercelOrigin/",
  "VILO_OPENROUTER_APP_TITLE=Vilo Sticker Lab"
) -join "@")

Invoke-Step "Deploy Cloud Run service" {
  $deployArgs = @(
    "run", "deploy", $ServiceName,
    "--image", $image,
    "--region", $Region,
    "--platform", "managed",
    "--allow-unauthenticated",
    "--port", "8080",
    "--memory", $Memory,
    "--cpu", $Cpu,
    "--timeout", "$($Timeout)s",
    "--concurrency", "$Concurrency",
    "--min-instances", "0",
    "--max-instances", "$MaxInstances",
    "--set-env-vars", $envVars,
    "--project", $ProjectId
  )
  if ($usesOpenRouter) {
    $deployArgs += @("--set-secrets", "OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest")
  }
  gcloud @deployArgs
  Ensure-GcloudSuccess
}

$serviceUrl = (gcloud run services describe $ServiceName `
  --region $Region `
  --project $ProjectId `
  --format "value(status.url)").Trim()
Ensure-GcloudSuccess

if (!$serviceUrl) {
  throw "Cloud Run service URL is empty."
}

$cutoutEndpoint = "$serviceUrl/api/cutout"
$analyzeEndpoint = "$serviceUrl/api/analyze-food"

if (!$SkipSmoke) {
  Invoke-Step "Smoke test Cloud Run cutout API" {
    node scripts/public-cutout-smoke.mjs `
      --cutout-endpoint $cutoutEndpoint `
      --model $CutoutModel `
      --origin $VercelOrigin `
      $(if (!$usesOpenRouter) { "--skip-analyze" })
    if ($LASTEXITCODE -ne 0) {
      throw "Cloud Run smoke test failed."
    }
  }
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
    if ($LASTEXITCODE -ne 0) {
      throw "Vercel production deploy failed."
    }
  }
}

Write-Host ""
Write-Host "Cloud Run service: $serviceUrl" -ForegroundColor Green
Write-Host "Cutout API: $cutoutEndpoint" -ForegroundColor Green
Write-Host "Analyze API: $analyzeEndpoint" -ForegroundColor Green
Write-Host "Frontend: $VercelOrigin/sticker-lab" -ForegroundColor Green
