from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

JOB_DIR = Path(__file__).resolve().parent
REPO_ROOT = JOB_DIR.parents[1]
PROJECT_ROOT = REPO_ROOT / "scanner-download"
DEFAULT_JSON = JOB_DIR / "out" / "stock_scanner_dashboard.json"
DEFAULT_OBJECT = "scanner/stock_scanner_dashboard.json"


def resolve_bucket() -> str:
    for key in (
        "SCANNER_RESULTS_GCS_BUCKET",
        "PUBLISHED_ASSETS_BUCKET",
        "SCANNER_GCS_BUCKET",
    ):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    raise RuntimeError(
        "Set SCANNER_RESULTS_GCS_BUCKET or PUBLISHED_ASSETS_BUCKET (GCS bucket for scanner JSON)."
    )


def resolve_object_name() -> str:
    return (
        os.environ.get("SCANNER_RESULTS_GCS_OBJECT", "").strip()
        or os.environ.get("SCANNER_GCS_OBJECT", "").strip()
        or DEFAULT_OBJECT
    )


def upload_scanner_json(json_path: Path | None = None) -> str:
    load_dotenv(JOB_DIR / ".env")
    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(REPO_ROOT / ".env")

    source = json_path or DEFAULT_JSON
    if not source.exists():
        raise FileNotFoundError(f"Scanner JSON not found at {source}")

    raw = source.read_text(encoding="utf-8")
    json.loads(raw)  # validate

    bucket_name = resolve_bucket()
    object_name = resolve_object_name()

    try:
        from google.cloud import storage
    except ImportError as exc:
        raise RuntimeError("Install google-cloud-storage: pip install google-cloud-storage") from exc

    client = storage.Client()
    blob = client.bucket(bucket_name).blob(object_name)
    blob.upload_from_string(raw, content_type="application/json")
    blob.cache_control = "no-cache, max-age=0"
    blob.patch()

    uri = f"gs://{bucket_name}/{object_name}"
    print(f"Uploaded scanner data from {source} to {uri}", flush=True)
    return uri


if __name__ == "__main__":
    upload_scanner_json()
