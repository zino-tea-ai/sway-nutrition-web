# Vilo Sticker API

Production path for food sticker background removal and food recognition.

## Local Run

```powershell
python -m venv .venv-cutout
.\.venv-cutout\Scripts\python -m pip install -r services\cutout_api\requirements.txt
$env:VILO_CUTOUT_MODEL="isnet-general-use"
$env:VILO_ANALYZE_PROVIDER="openrouter"
$env:OPENROUTER_API_KEY="<OPENROUTER_API_KEY>"
$env:VILO_OPENROUTER_MODEL="google/gemini-2.5-flash"
$env:VILO_CORS_ORIGINS="http://127.0.0.1:5188,http://localhost:5188"
.\.venv-cutout\Scripts\python -m uvicorn services.cutout_api.app:app --host 127.0.0.1 --port 8787
```

Frontend:

```powershell
$env:VITE_VILO_CUTOUT_ENDPOINT="http://127.0.0.1:8787/api/cutout"
$env:VITE_VILO_ANALYZE_ENDPOINT="http://127.0.0.1:8787/api/analyze-food"
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
- `GET /api/contract`
- `GET /api/models`
- `POST /api/warmup?model=isnet-general-use`
- `POST /api/cutout?model=isnet-general-use`
- `POST /api/analyze-food`

`/api/cutout` accepts multipart form-data with an `image` file and returns `image/png`.
`/api/analyze-food` accepts the same `image` file and returns the stable sticker detail JSON used by the frontend:

```json
{
  "name": "Master Kong Unsweetened Iced Black Tea",
  "localName": "康师傅无糖冰红茶",
  "type": "饮料 / 茶饮",
  "calories": 0,
  "protein": 0,
  "fiber": 0,
  "confidence": 0.86,
  "note": "无糖茶饮热量很低，适合记录为轻负担饮品；如果搭配正餐，继续看整体蛋白和纤维。"
}
```

## Food Recognition

Production recognition uses OpenRouter:

```powershell
$env:VILO_ANALYZE_PROVIDER="openrouter"
$env:OPENROUTER_API_KEY="<OPENROUTER_API_KEY>"
$env:VILO_OPENROUTER_MODEL="google/gemini-2.5-flash"
```

For offline QA, set `VILO_ANALYZE_PROVIDER=mock`. For local throwaway development only, `heuristic` is available, but it is not a production recognizer.

## Production

Use the Dockerfile so the model is downloaded during image build, not during the first user request.

```powershell
docker build -f services\cutout_api\Dockerfile -t vilo-cutout-api .
docker run --rm -p 8787:8787 `
  -e VILO_CUTOUT_MODEL=isnet-general-use `
  -e VILO_ANALYZE_PROVIDER=openrouter `
  -e OPENROUTER_API_KEY=<OPENROUTER_API_KEY> `
  vilo-cutout-api
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
