FROM python:3.12-slim-bookworm

# Optional: gsutil for faster cache rsync
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
       > /etc/apt/sources.list.d/google-cloud-sdk.list \
  && curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
       | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-cloud-cli \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY jobs/scanner-refresh/requirements.txt /app/jobs/scanner-refresh/requirements.txt
RUN pip install --no-cache-dir -r /app/jobs/scanner-refresh/requirements.txt

# Scanner code + universe lists (no secrets)
COPY scanner-download /app/scanner-download
COPY jobs/scanner-refresh /app/jobs/scanner-refresh

RUN chmod +x /app/jobs/scanner-refresh/entrypoint.sh \
  && mkdir -p /app/scanner-download/data/cache /app/scanner-download/reports /app/jobs/scanner-refresh/out

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/scanner-download/shared:/app/jobs/scanner-refresh

# Weekday morning job should finish within a few hours on warm cache
CMD ["/app/jobs/scanner-refresh/entrypoint.sh"]
