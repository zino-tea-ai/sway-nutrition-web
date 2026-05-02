FROM python:3.12-slim

ARG VILO_CUTOUT_MODEL=isnet-general-use

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VILO_CUTOUT_MODEL=${VILO_CUTOUT_MODEL} \
    VILO_MAX_UPLOAD_MB=12 \
    VILO_MAX_INPUT_PIXELS=9000000 \
    VILO_CORS_ORIGINS="*" \
    VILO_WARMUP=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY services/cutout_api/requirements.txt /app/services/cutout_api/requirements.txt
RUN pip install --no-cache-dir -r /app/services/cutout_api/requirements.txt

COPY services /app/services

# Pull the model during image build so runtime cold starts do not download it on the first user request.
RUN python -c "from rembg import new_session; import os; new_session(os.environ['VILO_CUTOUT_MODEL'])"

EXPOSE 8787

CMD ["uvicorn", "services.cutout_api.app:app", "--host", "0.0.0.0", "--port", "8787", "--workers", "1"]
