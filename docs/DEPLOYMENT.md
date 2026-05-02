# Deployment

This repo now has a split production path:

- Frontend: static Vite app on GitHub Pages.
- Cutout API: FastAPI + rembg in a Docker container.
- Container registry: GitHub Container Registry.

## What is already automated

On every push to `main`:

- `.github/workflows/pages.yml` builds `dist/` and deploys it to GitHub Pages.
- `.github/workflows/cutout-api-image.yml` builds `services/cutout_api/Dockerfile` and publishes `ghcr.io/zino-tea-ai/vilo-cutout-api`.

The Pages build uses these repository variables:

- `VILO_CUTOUT_ENDPOINT`: public backend URL, for example `https://vilo-cutout-api.fly.dev/api/cutout`.
- `VILO_REMOTE_CUTOUT_MODEL`: optional model name, default `isnet-general-use`.

If `VILO_CUTOUT_ENDPOINT` is empty, the frontend falls back to browser-side background removal.

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

## Backend deploy on Fly

Fly needs an account token. Once `FLY_API_TOKEN` is available:

```powershell
gh secret set FLY_API_TOKEN --repo zino-tea-ai/sway-nutrition-web
gh workflow run "Deploy cutout API to Fly" --repo zino-tea-ai/sway-nutrition-web -f app_name=vilo-cutout-api
```

After Fly returns the public host, wire the frontend to it:

```powershell
gh variable set VILO_CUTOUT_ENDPOINT --repo zino-tea-ai/sway-nutrition-web --body "https://vilo-cutout-api.fly.dev/api/cutout"
gh variable set VILO_REMOTE_CUTOUT_MODEL --repo zino-tea-ai/sway-nutrition-web --body "isnet-general-use"
gh workflow run "Deploy frontend to GitHub Pages" --repo zino-tea-ai/sway-nutrition-web
```

## Backend env

Set these on the container host:

```text
VILO_CUTOUT_MODEL=isnet-general-use
VILO_MAX_UPLOAD_MB=12
VILO_MAX_INPUT_PIXELS=9000000
VILO_CORS_ORIGINS=https://zino-tea-ai.github.io
VILO_WARMUP=1
```

## Local production smoke test

```powershell
$env:CUTOUT_PYTHON=".venv-cutout\Scripts\python.exe"
$env:VILO_CUTOUT_MODEL="isnet-general-use"
npm run qa:sticker:backend
```
