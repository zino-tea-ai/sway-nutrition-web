# Deployment

This repo now has a split production path:

- Frontend: static Vite app on GitHub Pages.
- Sticker API: FastAPI + rembg + OpenRouter vision recognition in a Docker container.
- Vercel dev deploy: static Vite app + `/api/analyze-food` OpenRouter proxy. This is good for a stable shareable prototype while the heavy cutout API still waits for a container host.
- Container registry: GitHub Container Registry.

## What is already automated

On every push to `main`:

- `.github/workflows/pages.yml` builds `dist/` and deploys it to GitHub Pages.
- `.github/workflows/cutout-api-image.yml` builds `services/cutout_api/Dockerfile` and publishes `ghcr.io/zino-tea-ai/vilo-cutout-api`.

The Pages build uses these repository variables:

- `VILO_CUTOUT_ENDPOINT`: public backend URL, for example `https://vilo-cutout-api.fly.dev/api/cutout`.
- `VILO_REMOTE_CUTOUT_MODEL`: optional model name, default `isnet-general-use`.
- `VILO_ANALYZE_ENDPOINT`: public food recognition URL, for example `https://vilo-cutout-api.fly.dev/api/analyze-food`.

If `VILO_CUTOUT_ENDPOINT` is empty, the frontend falls back to browser-side background removal.
If `VILO_ANALYZE_ENDPOINT` is empty, the frontend derives it from `VILO_CUTOUT_ENDPOINT` when the path ends in `/api/cutout`.
On Vercel, if both are empty, the frontend uses same-origin `/api/analyze-food` for recognition and browser-side cutout for lifting.

For smoke tests before the final backend URL is baked into the Pages build, pass a runtime endpoint:

```text
https://zino-tea-ai.github.io/sway-nutrition-web/?cutoutEndpoint=https%3A%2F%2Fexample.fly.dev%2Fapi%2Fcutout&cutoutModel=isnet-general-use
```

The runtime endpoint is stored in local storage. Clear it with `?cutoutEndpoint=`.

## Vercel development deploy

Use this path when you want a stable public URL quickly and do not have a Fly/RunPod container account ready yet.

```powershell
npm run build
npm run qa:vercel:analyze
npx vercel
```

When Vercel asks:

- Set up and deploy: `Y`
- Which scope: choose your account/team
- Link to existing project: usually `N` for the first deploy
- Project name: `sway-nutrition-web` or `vilo-sticker-lab`
- Build command: `npm run build`
- Output directory: `dist`

Then set the server-side OpenRouter key in Vercel:

```powershell
npx vercel env add OPENROUTER_API_KEY production
npx vercel env add OPENROUTER_API_KEY preview
npx vercel --prod
```

Do not set `OPENROUTER_API_KEY` as a `VITE_` variable. It must stay server-side only.

The Vercel URL should support:

```text
https://<your-vercel-app>.vercel.app/sticker-lab
https://<your-vercel-app>.vercel.app/api/analyze-food
```

This Vercel path does not run the Python `rembg` container. For faster and more consistent high-quality cutout, deploy the Docker API below and set `VILO_CUTOUT_ENDPOINT`.

## First deploy

Create and push the GitHub repo:

```powershell
gh repo create zino-tea-ai/sway-nutrition-web --public --source . --remote origin --push
```

Enable Pages from GitHub Actions:

```powershell
gh api `
  --method POST `
  -H "Accept: application/vnd.github+json" `
  /repos/zino-tea-ai/sway-nutrition-web/pages `
  -f build_type=workflow
```

If the API returns that Pages is already configured, that is fine.

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
