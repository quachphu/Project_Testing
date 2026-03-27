"""
visual_pipeline.py — Scene generation using official Google AI APIs (parallel)

Models (per Jan 2026 docs):
  - Nano Banana (image): gemini-3.1-flash-image-preview  (generate_content → inline_data)
  - Veo 3.1 (video):     veo-3.1-generate-preview       (generate_videos → poll → .save())

Performance:
  - Character angles generated in parallel (asyncio.gather)
  - All 3 scenes fired simultaneously, then awaited together
"""
import asyncio
import os
import tempfile
from google import genai
from google.genai import types
from models.world_bible import WorldBible, Character
from storage.gcs_client import GCSClient
from db.supabase_client import SupabaseClient


class VisualPipeline:
    # ── Model IDs (from official docs) ────────────────────────────────────────
    IMAGE_MODEL = "gemini-3.1-flash-image-preview"       # Nano Banana 2 (for Studio mode)
    VIDEO_MODEL = "veo-3.1-fast-generate-preview"         # Veo 3.1 Fast — for Instant mode

    def __init__(self):
        self.gcs = GCSClient()
        self.db  = SupabaseClient()
        self._client = None

    def _get_client(self) -> genai.Client:
        if self._client is None:
            self._client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
        return self._client

    # ── IMAGE: Nano Banana — one angle ───────────────────────────────────────

    async def _generate_single_image(self, prompt: str, path: str, content_type: str = "image/jpeg") -> str:
        """Generate a single image and upload it. Returns GCS/local URL."""
        client = self._get_client()
        loop = asyncio.get_event_loop()

        def _sync_generate():
            resp = client.models.generate_content(
                model=self.IMAGE_MODEL,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                ),
            )
            for part in (resp.parts or []):
                if part.inline_data is not None:
                    return part.inline_data.data
            return None

        img_bytes = await loop.run_in_executor(None, _sync_generate)
        if img_bytes is None:
            raise RuntimeError(f"Nano Banana returned no image for prompt: {prompt[:50]}")

        return await self.gcs.upload_bytes(img_bytes, path, content_type)

    # ── CHARACTER INGREDIENTS — 3 angles in parallel ─────────────────────────

    async def generate_ingredients(
        self,
        char: Character,
        mission_id: str,
        style: str,
        on_progress=None,
    ) -> list[str]:
        """Generate 3 reference angles simultaneously using asyncio.gather."""
        try:
            from agents.director_agent import STYLE_PROMPTS
        except ImportError:
            STYLE_PROMPTS = {}
        style_hint = STYLE_PROMPTS.get(style, "cinematic, film quality")[:80]
        t = char.visual_traits
        base = (
            f"{style_hint}. Character: {char.name}. {t.age}. "
            f"{t.skin} skin. {t.hair} hair. Wearing: {t.outfit}. "
            f"Distinctive: {t.distinctive_features}. "
            f"Clean studio background. Professional lighting. No text."
        )
        angle_prompts = [
            f"{base} Front-facing portrait. Direct gaze. Symmetrical.",
            f"{base} Three-quarter profile. Dramatic side lighting.",
            f"{base} Full body. Environmental context. Wide shot.",
        ]
        paths = [
            f"ingredients/{mission_id}/{char.id}_a{i}.jpg"
            for i in range(3)
        ]

        # Fire all 3 image generations simultaneously
        tasks = [
            self._generate_single_image(p, path)
            for p, path in zip(angle_prompts, paths)
        ]
        urls = await asyncio.gather(*tasks)
        urls = list(urls)

        if on_progress:
            for i, url in enumerate(urls):
                on_progress(f"ingredient_{i}", url)

        # Store character embedding
        emb = await self._embed_text(f"{char.name} {t.outfit} {t.distinctive_features}")
        await self.db.store_character(mission_id, char.id, emb, urls[0], t.dict())
        return urls

    # ── VIDEO: Veo 3.1 — single scene ─────────────────────────────────────────

    async def _start_veo_operation(self, veo_prompt: str):
        """Start a Veo generation operation. Non-blocking — returns the operation."""
        client = self._get_client()
        loop = asyncio.get_event_loop()

        def _sync_start():
            return client.models.generate_videos(
                model=self.VIDEO_MODEL,
                prompt=veo_prompt,
                config=types.GenerateVideosConfig(
                    aspect_ratio="9:16",
                    duration_seconds=8,
                    number_of_videos=1,
                ),
            )

        return await loop.run_in_executor(None, _sync_start)

    async def _poll_and_download_veo(self, op, mission_id: str, scene_index: int, on_progress=None) -> str:
        """Poll a running Veo operation until done, then download and upload to GCS."""
        client = self._get_client()
        loop = asyncio.get_event_loop()

        # Poll until done
        while not op.done:
            await asyncio.sleep(10)
            op = await loop.run_in_executor(None, lambda: client.operations.get(op))
            if on_progress:
                on_progress("polling", scene_index)

        if op.error:
            raise RuntimeError(f"Veo scene {scene_index}: {op.error}")

        generated_video = op.response.generated_videos[0]

        # Download to temp file using .save() as per official docs
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as vf:
            vid_path = vf.name

        try:
            def _sync_download():
                # Official API: client.files.download(file=...) then .save(path)
                client.files.download(file=generated_video.video)
                generated_video.video.save(vid_path)

            await loop.run_in_executor(None, _sync_download)
            with open(vid_path, "rb") as f:
                video_bytes = f.read()
        finally:
            try:
                os.unlink(vid_path)
            except OSError:
                pass

        url = await self.gcs.upload_bytes(
            video_bytes,
            f"scenes/{mission_id}/scene_{scene_index}.mp4",
            "video/mp4",
        )
        await self.db.update_scene(mission_id, scene_index, url, 1.0)
        return url

    async def generate_scene(
        self,
        mission_id: str,
        scene_index: int,
        veo_prompt: str,
        ingredient_urls: list,
        prev_video_url: str = None,
        on_progress=None,
    ) -> str:
        """Start Veo, poll until done, upload video. Used for per-scene calls."""
        try:
            op = await self._start_veo_operation(veo_prompt)
            return await self._poll_and_download_veo(op, mission_id, scene_index, on_progress)
        except Exception as e:
            raise RuntimeError(f"Veo 3.1 scene {scene_index} failed: {e}") from e

    async def generate_all_scenes_parallel(
        self,
        mission_id: str,
        prompts: list[str],
        ingredient_urls: list,
        on_scene_ready=None,
    ) -> list[str]:
        """
        Fire ALL scene Veo operations simultaneously, then poll them all in parallel.
        This saves 2× the wait time vs sequential.
        on_scene_ready(index, url) called as each scene finishes.
        """
        # Start all operations simultaneously
        ops = await asyncio.gather(*[
            self._start_veo_operation(p) for p in prompts
        ])

        # Poll all in parallel, surface each result as it arrives
        urls = [None] * len(ops)

        async def _wait_one(i, op):
            url = await self._poll_and_download_veo(op, mission_id, i)
            urls[i] = url
            if on_scene_ready:
                await on_scene_ready(i, url)
            return url

        await asyncio.gather(*[_wait_one(i, op) for i, op in enumerate(ops)])
        return urls

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _embed_text(self, text: str) -> list:
        client = self._get_client()
        loop = asyncio.get_event_loop()
        try:
            def _sync():
                r = client.models.embed_content(model="text-embedding-004", contents=text)
                return r.embeddings[0].values if r.embeddings else []
            return await loop.run_in_executor(None, _sync)
        except Exception:
            return []
