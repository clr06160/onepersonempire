from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path

JOB_DIR = Path(__file__).resolve().parent
REPO_ROOT = JOB_DIR.parents[1]
PROJECT_ROOT = REPO_ROOT / "scanner-download"
CACHE_DIR = PROJECT_ROOT / "data" / "cache"
DEFAULT_PREFIX = "scanner/cache/"


def resolve_bucket() -> str:
    for key in (
        "SCANNER_RESULTS_GCS_BUCKET",
        "PUBLISHED_ASSETS_BUCKET",
        "SCANNER_GCS_BUCKET",
    ):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    raise RuntimeError("Set SCANNER_RESULTS_GCS_BUCKET or PUBLISHED_ASSETS_BUCKET.")


def resolve_prefix() -> str:
    return os.environ.get("SCANNER_CACHE_GCS_PREFIX", DEFAULT_PREFIX).strip() or DEFAULT_PREFIX


def pull_cache() -> None:
    bucket = resolve_bucket()
    prefix = resolve_prefix().rstrip("/") + "/"
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    uri = f"gs://{bucket}/{prefix}"
    print(f"Pulling price/fundamentals cache from {uri} -> {CACHE_DIR}", flush=True)
    # Prefer gsutil if present; fall back to python client
    if subprocess.call(["which", "gsutil"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
        code = subprocess.call(["gsutil", "-m", "rsync", "-r", uri, str(CACHE_DIR)])
        if code != 0:
            print("gsutil pull returned non-zero (cache may be empty on first run).", flush=True)
        return

    from google.cloud import storage

    client = storage.Client()
    blobs = list(client.list_blobs(bucket, prefix=prefix))
    if not blobs:
        print("No remote cache objects yet — cold start will fetch from FMP.", flush=True)
        return
    for blob in blobs:
        if blob.name.endswith("/"):
            continue
        rel = blob.name[len(prefix) :]
        dest = CACHE_DIR / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(str(dest))
    print(f"Pulled {len(blobs)} cache objects.", flush=True)


def push_cache() -> None:
    if not CACHE_DIR.exists():
        print("No local cache to push.", flush=True)
        return
    bucket = resolve_bucket()
    prefix = resolve_prefix().rstrip("/") + "/"
    uri = f"gs://{bucket}/{prefix}"
    print(f"Pushing cache {CACHE_DIR} -> {uri}", flush=True)
    if subprocess.call(["which", "gsutil"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
        subprocess.check_call(["gsutil", "-m", "rsync", "-r", str(CACHE_DIR), uri])
        return

    from google.cloud import storage

    client = storage.Client()
    bkt = client.bucket(bucket)
    count = 0
    for path in CACHE_DIR.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(CACHE_DIR).as_posix()
        blob = bkt.blob(prefix + rel)
        blob.upload_from_filename(str(path))
        count += 1
    print(f"Pushed {count} cache files.", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync scanner FMP cache with GCS.")
    parser.add_argument("action", choices=("pull", "push"))
    args = parser.parse_args()
    if args.action == "pull":
        pull_cache()
    else:
        push_cache()


if __name__ == "__main__":
    main()
