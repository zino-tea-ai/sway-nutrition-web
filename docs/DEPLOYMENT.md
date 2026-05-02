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

## Backend deploy on Fly

Fly needs an account token. Once `FLY_API_TOKEN` is available:

```powershell
gh secret set FLY_API_TOKEN --repo zino-tea-ai/sway-nutrition-web
gh secret set OPENROUTER_API_KEY --repo zino-tea-ai/sway-nutrition-web
gh workflow run "Deploy cutout API to Fly" --repo zino-tea-ai/sway-nutrition-web -f app_name=vilo-cutout-api
```

After Fly returns the public host, wire the frontend to it:

```powershell
gh variable set VILO_CUTOUT_ENDPOINT --repo zino-tea-ai/sway-nutrition-web --body "https://vilo-cutout-api.fly.dev/api/cutout"
gh variable set VILO_ANALYZE_ENDPOINT --repo zino-tea-ai/sway-nutrition-web --body "https://vilo-cutout-api.fly.dev/api/analyze-food"
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
VILO_ANALYZE_PROVIDER=openrouter
OPENROUTER_API_KEY=<set as a host secret>
VILO_OPENROUTER_MODEL=google/gemini-2.5-flash
VILO_OPENROUTER_SITE_URL=https://zino-tea-ai.github.io/sway-nutrition-web/
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
