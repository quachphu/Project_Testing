"""
gcs_client.py — Asset storage with automatic local fallback

When Google Cloud Application Default Credentials (ADC) are not configured,
uploads fall back to a local `backend/static/assets/` folder served by FastAPI.
This means the full pipeline works without any cloud credentials.
"""
import os
import asyncio
from pathlib import Path
from typing import Optional

# ── Try GCS ───────────────────────────────────────────────────────────────────
try:
    from google.cloud import storage as gcs_lib
    _GCS_AVAILABLE = True
except ImportError:
    _GCS_AVAILABLE = False

# Local fallback directory — FastAPI will mount this as /static
_LOCAL_DIR = Path(__file__).parent.parent / "static" / "assets"
_LOCAL_DIR.mkdir(parents=True, exist_ok=True)

# Base URL for local files (FastAPI serves /static)
_LOCAL_BASE_URL = "http://localhost:8000/static/assets"


class GCSClient:
    """
    Upload/download assets.
    • If GCS credentials exist → upload to GCS bucket, return gs:// or HTTPS URL.
    • Otherwise → save to local filesystem, return http://localhost:8000/static/... URL.
    """

    def __init__(self):
        self._client = None   # lazy; only init if ADC is available
        self._bucket = os.environ.get("GCS_BUCKET_NAME", "aura-director-assets")
        self._using_local = False  # set True on first ADC failure

    def _try_init_gcs(self):
        if not _GCS_AVAILABLE:
            self._using_local = True
            return
        try:
            project = os.environ.get("GOOGLE_CLOUD_PROJECT")
            self._client = gcs_lib.Client(project=project)
            self._using_local = False
            print(f"[GCSClient] Connected to GCS bucket: {self._bucket}")
        except Exception as e:
            print(f"[GCSClient] GCS unavailable ({e}) — using local storage.")
            self._client = None
            self._using_local = True

    def _ensure_client(self):
        if self._client is None and not self._using_local:
            self._try_init_gcs()

    # ── Upload ────────────────────────────────────────────────────────────────

    async def upload_bytes(
        self, data: bytes, path: str, content_type: str
    ) -> str:
        """Upload bytes. Returns public URL (GCS or local)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._upload_sync, data, path, content_type
        )

    def _upload_sync(self, data: bytes, path: str, content_type: str) -> str:
        self._ensure_client()

        if not self._using_local and self._client is not None:
            try:
                bucket = self._client.bucket(self._bucket)
                blob = bucket.blob(path)
                blob.upload_from_string(data, content_type=content_type)
                # Uniform bucket-level access: allUsers:objectViewer is set at
                # bucket level, so per-object make_public() is not needed.
                # Construct the public URL directly.
                public_url = f"https://storage.googleapis.com/{self._bucket}/{path}"
                return public_url
            except Exception as e:
                print(f"[GCSClient] Upload failed ({e}) — falling back to local.")
                self._using_local = True

        # ── Local fallback ─────────────────────────────────────────────────
        local_path = _LOCAL_DIR / path.replace("/", "_")
        local_path.parent.mkdir(parents=True, exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(data)
        filename = local_path.name
        return f"{_LOCAL_BASE_URL}/{filename}"

    # ── Download ──────────────────────────────────────────────────────────────

    async def download_to_file(self, url: str, dest_path: str) -> None:
        """Download asset to a local path."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._download_sync, url, dest_path)

    def _download_sync(self, url: str, dest_path: str) -> None:
        if url.startswith("http://localhost") or url.startswith(_LOCAL_BASE_URL):
            # Resolve local file path from URL
            filename = url.split("/")[-1]
            src = _LOCAL_DIR / filename
            if src.exists():
                import shutil
                shutil.copy(str(src), dest_path)
            return

        # GCS download
        self._ensure_client()
        if self._client is not None:
            # Extract blob path from URL
            blob_path = "/".join(url.split("/")[4:])
            bucket = self._client.bucket(self._bucket)
            blob = bucket.blob(blob_path)
            blob.download_to_filename(dest_path)
