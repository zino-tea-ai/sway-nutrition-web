param(
  [string]$RepoId = "",
  [string]$SpaceName = "vilo-cutout-api",
  [string]$CutoutModel = "isnet-general-use",
  [string]$AnalyzeProvider = "mock",
  [string]$VercelOrigin = "https://sway-nutrition-web.vercel.app",
  [string]$EnvPath = ".env",
  [switch]$SkipSmoke,
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
  param([string]$Name, [string]$InstallHint)
  if (!(Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name. $InstallHint"
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

function ConvertTo-ProcessArgument {
  param([string]$Value)
  if ($Value -notmatch '[\s"]') {
    return $Value
  }
  return '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

function Invoke-VercelCli {
  param(
    [string[]]$Arguments,
    [string]$InputText = $null,
    [switch]$IgnoreExit,
    [switch]$Quiet
  )

  $vercelCommand = Get-Command "vercel" -ErrorAction Stop
  $vercelRoot = Split-Path $vercelCommand.Source -Parent
  $vercelEntry = Join-Path $vercelRoot "node_modules\vercel\dist\vc.js"
  $nodeCommand = Get-Command "node" -ErrorAction Stop
  $runnerPath = Join-Path $env:TEMP "vilo-vercel-runner-$([guid]::NewGuid().ToString('n')).mjs"

  @"
import { spawnSync } from "node:child_process";

const args = JSON.parse(process.env.VILO_VERCEL_ARGS_JSON || "[]");
const input = Object.prototype.hasOwnProperty.call(process.env, "VILO_VERCEL_INPUT_TEXT")
  ? Buffer.from(process.env.VILO_VERCEL_INPUT_TEXT, "utf8")
  : undefined;
const result = spawnSync(process.execPath, [process.env.VILO_VERCEL_ENTRY, ...args], {
  input,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? (result.error ? 1 : 0));
"@ | Set-Content -LiteralPath $runnerPath -Encoding UTF8

  $previousEntry = $env:VILO_VERCEL_ENTRY
  $previousArgs = $env:VILO_VERCEL_ARGS_JSON
  $previousInput = $env:VILO_VERCEL_INPUT_TEXT
  $hadEntry = Test-Path env:VILO_VERCEL_ENTRY
  $hadArgs = Test-Path env:VILO_VERCEL_ARGS_JSON
  $hadInput = Test-Path env:VILO_VERCEL_INPUT_TEXT

  $env:VILO_VERCEL_ENTRY = $vercelEntry
  $env:VILO_VERCEL_ARGS_JSON = ConvertTo-Json $Arguments -Compress
  if ($null -ne $InputText) {
    $env:VILO_VERCEL_INPUT_TEXT = $InputText
  } elseif ($hadInput) {
    Remove-Item env:VILO_VERCEL_INPUT_TEXT
  }

  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = $nodeCommand.Source
  $processInfo.Arguments = ConvertTo-ProcessArgument $runnerPath
  $processInfo.UseShellExecute = $false
  $processInfo.RedirectStandardInput = $false
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $processInfo
  try {
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
  } finally {
    if ($hadEntry) { $env:VILO_VERCEL_ENTRY = $previousEntry } else { Remove-Item env:VILO_VERCEL_ENTRY -ErrorAction SilentlyContinue }
    if ($hadArgs) { $env:VILO_VERCEL_ARGS_JSON = $previousArgs } else { Remove-Item env:VILO_VERCEL_ARGS_JSON -ErrorAction SilentlyContinue }
    if ($hadInput) { $env:VILO_VERCEL_INPUT_TEXT = $previousInput } else { Remove-Item env:VILO_VERCEL_INPUT_TEXT -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $runnerPath -Force -ErrorAction SilentlyContinue
  }

  if (!$Quiet) {
    if ($stdout) {
      Write-Host $stdout.TrimEnd()
    }
    if ($stderr) {
      Write-Host $stderr.TrimEnd()
    }
  }

  if (!$IgnoreExit -and $process.ExitCode -ne 0) {
    throw "Vercel CLI failed with exit code $($process.ExitCode)."
  }

  return $process.ExitCode
}

function Set-VercelEnv {
  param(
    [string]$Name,
    [string]$Value,
    [string]$Environment
  )

  [void](Invoke-VercelCli -Arguments @("env", "rm", $Name, $Environment, "--yes") -IgnoreExit -Quiet)
  [void](Invoke-VercelCli -Arguments @("env", "add", $Name, $Environment) -InputText $Value)
}

function ConvertTo-HfHost {
  param([string]$RepoId)
  $parts = $RepoId.Split("/", 2)
  if ($parts.Count -ne 2) {
    throw "RepoId must be namespace/name, got: $RepoId"
  }
  $namespace = $parts[0].ToLowerInvariant().Replace("_", "-")
  $name = $parts[1].ToLowerInvariant().Replace("_", "-")
  return "https://$namespace-$name.hf.space"
}

Import-DotEnv -Path $EnvPath
Import-DotEnv -Path ".env.local"

Require-Command "python" "Install Python or use the bundled project Python."
Require-Command "node" "Install Node.js."
if (!$SkipVercelEnv -or !$SkipVercelDeploy) {
  Require-Command "vercel" "Install Vercel CLI and run: vercel login"
}

$spaceRoot = Join-Path $env:TEMP "vilo-hf-space-$([guid]::NewGuid().ToString('n'))"
New-Item -ItemType Directory -Force -Path $spaceRoot | Out-Null

try {
  Invoke-Step "Prepare Hugging Face Docker Space files" {
    New-Item -ItemType Directory -Force -Path (Join-Path $spaceRoot "services") | Out-Null
    Copy-Item -Path "services\cutout_api" -Destination (Join-Path $spaceRoot "services\cutout_api") -Recurse

    @"
---
title: Vilo Cutout API
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# Vilo Cutout API

FastAPI background-removal backend for the Vilo sticker prototype.
"@ | Set-Content -LiteralPath (Join-Path $spaceRoot "README.md") -Encoding UTF8

    @"
FROM python:3.12-slim

ARG VILO_CUTOUT_MODEL=$CutoutModel

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VILO_CUTOUT_MODEL=`${VILO_CUTOUT_MODEL} \
    VILO_MAX_UPLOAD_MB=12 \
    VILO_MAX_INPUT_PIXELS=9000000 \
    VILO_CORS_ORIGINS="*" \
    VILO_WARMUP=1 \
    VILO_ANALYZE_PROVIDER=$AnalyzeProvider \
    VILO_OPENROUTER_MODEL=google/gemini-2.5-flash \
    VILO_OPENROUTER_APP_TITLE="Vilo Sticker Lab" \
    PORT=7860

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY services/cutout_api/requirements.txt /app/services/cutout_api/requirements.txt
RUN pip install --no-cache-dir -r /app/services/cutout_api/requirements.txt

COPY services /app/services

RUN python -c "from rembg import new_session; import os; new_session(os.environ['VILO_CUTOUT_MODEL'])"

EXPOSE 7860

CMD ["sh", "-c", "uvicorn services.cutout_api.app:app --host 0.0.0.0 --port `${PORT:-7860} --workers 1"]
"@ | Set-Content -LiteralPath (Join-Path $spaceRoot "Dockerfile") -Encoding UTF8
  }

  $uploadResultPath = Join-Path $spaceRoot "hf-upload-result.json"
  Invoke-Step "Create or update Hugging Face Space" {
    $env:VILO_HF_SPACE_ROOT = $spaceRoot
    $env:VILO_HF_REPO_ID = $RepoId
    $env:VILO_HF_SPACE_NAME = $SpaceName
    $env:VILO_HF_ANALYZE_PROVIDER = $AnalyzeProvider
    $env:VILO_HF_OPENROUTER_KEY = if ($env:OPENROUTER_API_KEY) { $env:OPENROUTER_API_KEY } else { $env:VILO_OPENROUTER_API_KEY }
    $env:VILO_HF_RESULT_PATH = $uploadResultPath

    @'
import json
import os
import sys
from huggingface_hub import HfApi, get_token

token = os.environ.get("HF_TOKEN") or get_token()
if not token:
    raise SystemExit("Missing Hugging Face token. Create one at https://huggingface.co/settings/tokens and set HF_TOKEN.")

api = HfApi(token=token)
who = api.whoami(token=token)
namespace = who.get("name")
repo_id = os.environ.get("VILO_HF_REPO_ID") or f"{namespace}/{os.environ.get('VILO_HF_SPACE_NAME', 'vilo-cutout-api')}"
analyze_provider = os.environ.get("VILO_HF_ANALYZE_PROVIDER", "mock")
openrouter_key = os.environ.get("VILO_HF_OPENROUTER_KEY") or ""
if analyze_provider == "openrouter" and not openrouter_key:
    raise SystemExit("AnalyzeProvider=openrouter requires OPENROUTER_API_KEY or VILO_OPENROUTER_API_KEY.")

variables = [
    {"key": "VILO_CUTOUT_MODEL", "value": os.environ.get("VILO_CUTOUT_MODEL", "isnet-general-use")},
    {"key": "VILO_MAX_UPLOAD_MB", "value": "12"},
    {"key": "VILO_MAX_INPUT_PIXELS", "value": "9000000"},
    {"key": "VILO_CORS_ORIGINS", "value": "*"},
    {"key": "VILO_WARMUP", "value": "1"},
    {"key": "VILO_ANALYZE_PROVIDER", "value": analyze_provider},
    {"key": "VILO_OPENROUTER_MODEL", "value": "google/gemini-2.5-flash"},
    {"key": "VILO_OPENROUTER_APP_TITLE", "value": "Vilo Sticker Lab"},
]
secrets = []
if analyze_provider == "openrouter" and openrouter_key:
    secrets.append({"key": "OPENROUTER_API_KEY", "value": openrouter_key})

api.create_repo(
    repo_id=repo_id,
    repo_type="space",
    space_sdk="docker",
    exist_ok=True,
    space_variables=variables,
    space_secrets=secrets or None,
)
for variable in variables:
    api.add_space_variable(repo_id=repo_id, key=variable["key"], value=variable["value"])
for secret in secrets:
    api.add_space_secret(repo_id=repo_id, key=secret["key"], value=secret["value"])
commit = api.upload_folder(
    repo_id=repo_id,
    repo_type="space",
    folder_path=os.environ["VILO_HF_SPACE_ROOT"],
    commit_message="Deploy Vilo cutout API",
    delete_patterns="*",
)
result = {"repo_id": repo_id, "commit_url": getattr(commit, "commit_url", None)}
with open(os.environ["VILO_HF_RESULT_PATH"], "w", encoding="utf-8") as f:
    json.dump(result, f)
print(json.dumps(result, indent=2))
'@ | python -
    if ($LASTEXITCODE -ne 0) {
      throw "Hugging Face upload failed."
    }
  }

  $uploadResult = Get-Content -LiteralPath $uploadResultPath -Raw | ConvertFrom-Json
  $resolvedRepoId = [string]$uploadResult.repo_id
  $spaceOrigin = ConvertTo-HfHost -RepoId $resolvedRepoId
  $cutoutEndpoint = "$spaceOrigin/api/cutout"
  $analyzeEndpoint = "$spaceOrigin/api/analyze-food"

  if (!$SkipSmoke) {
    Invoke-Step "Wait for Hugging Face Space health" {
      $deadline = (Get-Date).AddMinutes(25)
      $expectedAnalyzeProvider = $AnalyzeProvider.Trim().ToLowerInvariant()
      while ((Get-Date) -lt $deadline) {
        try {
          $response = Invoke-WebRequest -Uri "$spaceOrigin/health" -UseBasicParsing -TimeoutSec 20
          if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            $health = $response.Content | ConvertFrom-Json
            $providerMatches = ([string]$health.analyzeProvider).ToLowerInvariant() -eq $expectedAnalyzeProvider
            $keyMatches = $expectedAnalyzeProvider -ne "openrouter" -or [bool]$health.openRouterKeyConfigured
            if ($providerMatches -and $keyMatches) {
              Write-Host $response.Content
              return
            }
            Write-Host "Waiting for Space config: $($response.Content)"
          }
        } catch {
          Write-Host "Waiting for Space build/start..."
        }
        Start-Sleep -Seconds 20
      }
      throw "Timed out waiting for $spaceOrigin/health"
    }

    Invoke-Step "Smoke test Hugging Face cutout API" {
      $args = @(
        "scripts/public-cutout-smoke.mjs",
        "--cutout-endpoint", $cutoutEndpoint,
        "--model", $CutoutModel,
        "--origin", $VercelOrigin
      )
      if ($AnalyzeProvider.Trim().ToLowerInvariant() -ne "openrouter") {
        $args += "--skip-analyze"
      }
      node @args
      if ($LASTEXITCODE -ne 0) {
        throw "Hugging Face Space smoke test failed."
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
      [void](Invoke-VercelCli -Arguments @("deploy", "--prod", "--yes"))
    }
  }

  Write-Host ""
  Write-Host "Hugging Face Space: https://huggingface.co/spaces/$resolvedRepoId" -ForegroundColor Green
  Write-Host "Cutout API: $cutoutEndpoint" -ForegroundColor Green
  Write-Host "Analyze API: $analyzeEndpoint" -ForegroundColor Green
  Write-Host "Frontend: $VercelOrigin/sticker-lab" -ForegroundColor Green
} finally {
  Remove-Item -LiteralPath $spaceRoot -Recurse -Force -ErrorAction SilentlyContinue
}
