from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

SCANNERS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCANNERS_DIR.parent
DEFAULT_JSON = SCANNERS_DIR / "stock_scanner_dashboard.json"
DEFAULT_HTML = SCANNERS_DIR / "stock_scanner_dashboard.html"
DEFAULT_OBJECT = "scanner/stock_scanner_dashboard.json"


def build_json_from_html(html_path: Path) -> str:
    import re
    from datetime import datetime, timezone

    html = html_path.read_text(encoding="utf-8")
    matched = re.search(r"const systems = (\[[\s\S]*?\]);\s*const select =", html)
    if not matched:
        raise RuntimeError(f"Could not find scanner systems in {html_path}")

    systems = json.loads(matched.group(1))
    generated_at = html_path.stat().st_mtime
    return json.dumps(
        {
            "connected": True,
            "generatedAt": datetime.fromtimestamp(generated_at, tz=timezone.utc).astimezone().isoformat(timespec="seconds"),
            "source": "html-fallback",
            "systems": systems,
        },
        indent=2,
    )


def resolve_scanner_json(json_path: Path | None = None) -> tuple[str, str]:
    source = json_path or DEFAULT_JSON
    if source.exists():
        raw = source.read_text(encoding="utf-8")
        json.loads(raw)
        return str(source), raw

    if DEFAULT_HTML.exists():
        return str(DEFAULT_HTML), build_json_from_html(DEFAULT_HTML)

    raise FileNotFoundError(
        f"Scanner JSON not found at {source} and HTML fallback missing at {DEFAULT_HTML}"
    )


def upload_scanner_json(json_path: Path | None = None) -> str:
    load_dotenv(SCANNERS_DIR / ".env")
    load_dotenv(PROJECT_ROOT / ".env")

    bucket_name = os.environ.get("SCANNER_GCS_BUCKET", "").strip()
    if not bucket_name:
        raise RuntimeError("SCANNER_GCS_BUCKET is not set.")

    object_name = os.environ.get("SCANNER_GCS_OBJECT", DEFAULT_OBJECT).strip() or DEFAULT_OBJECT
    source_label, raw = resolve_scanner_json(json_path)

    credentials = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if credentials:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials

    try:
        from google.cloud import storage
    except ImportError as exc:
        raise RuntimeError(
            "Install google-cloud-storage first: pip install google-cloud-storage"
        ) from exc

    client = storage.Client()
    blob = client.bucket(bucket_name).blob(object_name)
    blob.upload_from_string(raw, content_type="application/json")
    blob.cache_control = "no-cache"
    blob.patch()

    uri = f"gs://{bucket_name}/{object_name}"
    print(f"Uploaded scanner data from {source_label} to {uri}", flush=True)
    return uri


if __name__ == "__main__":
    upload_scanner_json()
