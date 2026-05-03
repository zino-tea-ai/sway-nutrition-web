# Deployment

The canonical production path:

- **Frontend**: Vite SPA on **Vercel**, auto-deployed from `main` via the Vercel GitHub integration.
- **Cutout + analyze backend**: FastAPI + rembg + OpenRouter, currently running on **Hugging Face Space** `zinottt/vilo-cutout-api`. Cloud Run and Fly are kept below as alternatives.
- **Container registry**: GitHub Container Registry (`ghcr.io/zino-tea-ai/vilo-cutout-api`).

The earlier GitHub Pages deploy has been retired (Pages had no backend env vars wired up and the page felt broken). Do not re-add it.

## What is automated

On every push to `main`:

- **Vercel** rebuilds and deploys the frontend automatically (configured in the Vercel project's GitHub integration).
- `.github/workflows/cutout-api-image.yml` builds `services/cutout_api/Dockerfile` and publishes `ghcr.io/zino-tea-ai/vilo-cutout-api`.

Vercel uses these environment variables (set in the Vercel project's Settings → Environment Variables):

| Name | Scope | Purpose |
|---|---|---|
| `VITE_VILO_CUTOUT_ENDPOINT` | Frontend (build-time) | Public cutout URL, e.g. `https://zinottt-vilo-cutout-api.hf.space/api/cutout` |
| `VITE_VILO_ANALYZE_ENDPOINT` | Frontend (build-time) | Public analyze URL |
| `VITE_VILO_REMOTE_CUTOUT_MODEL` | Frontend (build-time) | Optional, defaults to `isnet-general-use` |
| `OPENROUTER_API_KEY` | Server-side only | Used by `api/analyze-food.js` (Vercel serverless fallback) |

`OPENROUTER_API_KEY` must NOT have a `VITE_` prefix or it gets bundled into the client.

If `VITE_VILO_CUTOUT_ENDPOINT` is empty, the frontend falls back to in-browser background removal (slow, but works).
If `VITE_VILO_ANALYZE_ENDPOINT` is empty, the frontend derives it from `VITE_VILO_CUTOUT_ENDPOINT` when that one ends in `/api/cutout`.

For ad-hoc smoke tests against an alternate backend without redeploying, append a runtime endpoint to any URL:

```text
https://<your-vercel-app>.vercel.app/?cutoutEndpoint=https%3A%2F%2Fexample.fly.dev%2Fapi%2Fcutout&cutoutModel=isnet-general-use
```

The runtime endpoint is stored in `localStorage`. Clear it with `?cutoutEndpoint=`.

## First-time Vercel deploy

Run once from the repo root:

```powershell
npx vercel
```

When prompted:

- Set up and deploy: `Y`
- Which scope: choose your account/team
- Link to existing project: `N` for the first deploy
- Project name: `sway-nutrition-web` or `vilo`
- Build command: `npm run build`
- Output directory: `dist`

Then add the server-side OpenRouter key (no `VITE_` prefix):

```powershell
npx vercel env add OPENROUTER_API_KEY production
npx vercel env add OPENROUTER_API_KEY preview
npx vercel --prod
```

The deployed URL exposes:

```text
https://<your-vercel-app>.vercel.app/                  → /today (board) or /capture if no stickers yet
https://<your-vercel-app>.vercel.app/today             → today's sticker board
https://<your-vercel-app>.vercel.app/capture           → capture flow (camera / upload / sample)
https://<your-vercel-app>.vercel.app/capture/confirm   → captured sticker, before save
https://<your-vercel-app>.vercel.app/capture/detail    → captured sticker + analysis
https://<your-vercel-app>.vercel.app/api/analyze-food  → server-side OpenRouter proxy
```

`/sticker-lab` and `/sticker-board` redirect to `/capture` and `/today` for old links.

To swap the cutout backend (HF Space → Cloud Run / Fly / something else), follow one of the sections below and update `VITE_VILO_CUTOUT_ENDPOINT` in Vercel.

## Backend deploy on Google Cloud Run

Recommended production path. Cloud Run runs the Docker API, gives it a public HTTPS URL, scales to zero, and lets Vercel stay as the frontend host.

Prerequisites:

- Google Cloud SDK installed: `winget install Google.CloudSDK`
- Logged in: `gcloud auth login`
- Project selected: `gcloud config set project <PROJECT_ID>`
- Billing enabled for the selected project
- Vercel CLI logged in: `vercel whoami`
- `OPENROUTER_API_KEY` available in the shell or in `.env`

Deploy:

```powershell
npm run deploy:cutout:cloud-run -- -ProjectId <PROJECT_ID>
```

Useful variants:

```powershell
npm run deploy:cutout:cloud-run -- -ProjectId <PROJECT_ID> -Region us-central1
npm run deploy:cutout:cloud-run -- -ProjectId <PROJECT_ID> -ServiceName vilo-cutout-api-dev
npm run deploy:cutout:cloud-run -- -ProjectId <PROJECT_ID> -SkipVercelDeploy
```

The script:

- enables Cloud Run, Cloud Build, Artifact Registry, and Secret Manager APIs;
- creates an Artifact Registry Docker repo if needed;
- stores `OPENROUTER_API_KEY` in Secret Manager;
- builds `services/cutout_api/Dockerfile` with Cloud Build;
- deploys the container to Cloud Run with `2Gi` memory, `2` CPU, `min-instances=0`, and public HTTPS;
- smoke-tests `/health`, `/api/cutout?response=json`, and `/api/analyze-food`;
- writes these Vercel env vars and redeploys production:

```text
VITE_VILO_CUTOUT_ENDPOINT=https://<cloud-run-service>/api/cutout
VITE_VILO_ANALYZE_ENDPOINT=https://<cloud-run-service>/api/analyze-food
VITE_VILO_REMOTE_CUTOUT_MODEL=isnet-general-use
```

You can smoke-test the backend later without redeploying:

```powershell
npm run qa:cutout:public -- --cutout-endpoint https://<cloud-run-service>/api/cutout
```

## Backend deploy on Hugging Face Spaces

Use this path when Google Cloud billing is not available yet. It uses a free Docker Space on CPU Basic. This is good for phone testing and early prototype review, but not final production because free Spaces can sleep after inactivity.

Prerequisites:

- Hugging Face account
- A write token from <https://huggingface.co/settings/tokens>
- Set the token in PowerShell:

```powershell
$env:HF_TOKEN="<HUGGING_FACE_TOKEN>"
```

Deploy:

```powershell
npm run deploy:cutout:hf
```

Useful variants:

```powershell
npm run deploy:cutout:hf -- -RepoId <hf-username>/vilo-cutout-api
npm run deploy:cutout:hf -- -SkipVercelDeploy
npm run deploy:cutout:hf -- -AnalyzeProvider openrouter -EnvPath C:\path\to\.env
```

By default this script deploys the cutout API with `VILO_ANALYZE_PROVIDER=mock`, because it is meant to unblock free phone testing. When OpenRouter is available, pass `-AnalyzeProvider openrouter` with `OPENROUTER_API_KEY` in the shell or env file.

The script:

- creates or updates a Docker Space;
- uploads the FastAPI cutout service;
- waits for `/health`;
- smoke-tests `/api/cutout?response=json`;
- writes Vercel env vars and redeploys production unless skipped.

The public API URL will look like:

```text
https://<hf-username>-vilo-cutout-api.hf.space/api/cutout
```

## Backend deploy on Fly

The fastest path from this Windows repo is the local deploy script. It deploys the Docker API to Fly, smoke-tests `/health`, `/api/cutout?response=json`, `/api/analyze-food`, writes the public API URLs into Vercel env, then deploys Vercel production again.

```powershell
npm run deploy:cutout:fly
```

Prerequisites:

- Fly CLI installed: `winget install Fly.Flyctl`
- Vercel CLI logged in: `vercel whoami`
- `OPENROUTER_API_KEY` available in the shell or in `.env`

Useful variants:

```powershell
npm run deploy:cutout:fly -- -AppName vilo-cutout-api-zino
npm run deploy:cutout:fly -- -SkipVercelDeploy
npm run deploy:cutout:fly -- -EnvPath C:\path\to\.env
```

After deployment, the Vercel frontend should have:

```text
VITE_VILO_CUTOUT_ENDPOINT=https://vilo-cutout-api-zino.fly.dev/api/cutout
VITE_VILO_ANALYZE_ENDPOINT=https://vilo-cutout-api-zino.fly.dev/api/analyze-food
VITE_VILO_REMOTE_CUTOUT_MODEL=isnet-general-use
```

You can smoke-test any public backend without redeploying:

```powershell
npm run qa:cutout:public -- --cutout-endpoint https://vilo-cutout-api-zino.fly.dev/api/cutout
```

The GitHub Actions path is still available if you prefer token-based deploy from GitHub:

```powershell
gh secret set FLY_API_TOKEN --repo zino-tea-ai/sway-nutrition-web
gh secret set OPENROUTER_API_KEY --repo zino-tea-ai/sway-nutrition-web
gh workflow run "Deploy cutout API to Fly" --repo zino-tea-ai/sway-nutrition-web -f app_name=vilo-cutout-api-zino
```

## Backend env

Set these on the container host:

```text
VILO_CUTOUT_MODEL=isnet-general-use
VILO_MAX_UPLOAD_MB=12
VILO_MAX_INPUT_PIXELS=9000000
VILO_CORS_ORIGINS=https://sway-nutrition-web.vercel.app,https://zino-tea-ai.github.io
VILO_CORS_ORIGIN_REGEX=^https://.*\.vercel\.app$
VILO_WARMUP=1
VILO_ANALYZE_PROVIDER=openrouter
OPENROUTER_API_KEY=<set as a host secret>
VILO_OPENROUTER_MODEL=google/gemini-2.5-flash
VILO_OPENROUTER_SITE_URL=https://sway-nutrition-web.vercel.app/
VILO_OPENROUTER_APP_TITLE=Vilo Sticker Lab
```

## Local production smoke test

```powershell
$env:CUTOUT_PYTHON=".venv-cutout\Scripts\python.exe"
$env:VILO_CUTOUT_MODEL="isnet-general-use"
$env:VILO_ANALYZE_PROVIDER="mock"
npm run qa:sticker:backend
```

To smoke test OpenRouter locally, load `OPENROUTER_API_KEY`, set `VILO_ANALYZE_PROVIDER=openrouter`, start `npm run cutout:api`, then POST an image to `/api/analyze-food`.
