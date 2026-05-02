# Vilo Cutout API

Production path for food sticker background removal.

## Local Run

```powershell
python -m venv .venv-cutout
.\.venv-cutout\Scripts\python -m pip install -r services\cutout_api\requirements.txt
$env:VILO_CUTOUT_MODEL="isnet-general-use"
$env:VILO_CORS_ORIGINS="http://127.0.0.1:5188,http://localhost:5188"
.\.venv-cutout\Scripts\python -m uvicorn services.cutout_api.app:app --host 127.0.0.1 --port 8787
```

Frontend:

```powershell
$env:VITE_VILO_CUTOUT_ENDPOINT="http://127.0.0.1:8787/api/cutout"
npm run dev
```

## Models

- `u2netp`: fastest preview model.
- `silueta`: smaller balanced model.
- `isnet-general-use`: default quality model for general food/object cutouts.
- `birefnet-general-lite`: quality candidate if available in the installed `rembg` release.
- `birefnet-general`: max-quality candidate with heavier memory/cold start.

## Endpoints

- `GET /health`
- `GET /api/models`
- `POST /api/warmup?model=isnet-general-use`
- `POST /api/cutout?model=isnet-general-use`

`/api/cutout` accepts multipart form-data with an `image` file and returns `image/png`.

## Production

Use the Dockerfile so the model is downloaded during image build, not during the first user request.

```powershell
docker build -f services\cutout_api\Dockerfile -t vilo-cutout-api .
docker run --rm -p 8787:8787 -e VILO_CUTOUT_MODEL=isnet-general-use vilo-cutout-api
```

Fly.io:

```powershell
copy services\cutout_api\fly.toml.example fly.toml
fly launch --no-deploy
fly deploy
```

The repo also includes GitHub Actions for:

- publishing the frontend to GitHub Pages;
- publishing the cutout API image to GitHub Container Registry;
- manually deploying the cutout API to Fly when `FLY_API_TOKEN` is configured.

See `docs/DEPLOYMENT.md`.
