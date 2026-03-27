"""
audio_pipeline.py — Music generation using Lyria 3 (official Google AI API)

Model (per docs): lyria-3-clip-preview
API: client.models.generate_content(model="lyria-3-clip-preview", ...)
     config: response_modalities=["AUDIO", "TEXT"]
Response: response.parts[i].inline_data.data  (mp3 bytes)
"""
import asyncio
import os
from google import genai
from google.genai import types
from models.world_bible import WorldBible
from storage.gcs_client import GCSClient


# Tone → music description mapping (used to build Lyria prompts)
TONE_MUSIC = {
    "Hopeful":       "uplifting orchestral, rising strings, warm brass, hopeful melody",
    "Dark":          "dark ambient, minor keys, heavy low brass, tension drones",
    "Bittersweet":   "melancholic piano, gentle strings, bittersweet waltz tempo",
    "Triumphant":    "epic orchestral, full brass, driving percussion, triumphant theme",
    "Melancholic":   "solo cello, sparse piano, slow minor, introspective and lonely",
    "Chaotic":       "dissonant strings, erratic tempo, percussion bursts, chaotic energy",
    "Mysterious":    "ethereal pads, mysterious woodwinds, sparse texture, slow build",
    "Epic":          "massive orchestral swell, choir, percussion, epic cinematic score",
}


class AudioPipeline:
    # ── Model IDs (per official docs) ─────────────────────────────────────────
    MUSIC_MODEL = "lyria-3-clip-preview"  # 30-second clip model

    def __init__(self):
        self.gcs = GCSClient()
        self._client = None

    def _get_client(self) -> genai.Client:
        if self._client is None:
            self._client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
        return self._client

    def _build_prompt(self, bible: WorldBible, duration: int) -> str:
        tone_desc = TONE_MUSIC.get(bible.tone, "cinematic orchestral")
        genre_desc = bible.genre.replace(" × ", " and ")
        return (
            f"Create a {duration}-second cinematic musical score for a "
            f"{genre_desc} film teaser. Tone: {tone_desc}. "
            f"Style: {bible.style}. "
            f"Build from quiet opening to emotional peak, no vocals, "
            f"professional film score quality."
        )

    async def generate_score(
        self, mission_id: str, bible: WorldBible, on_chunk=None, duration: int = 30
    ) -> str:
        """
        Generate a music score using Lyria 3 Clip.

        API: client.models.generate_content(model="lyria-3-clip-preview", ...)
        Response: inline_data parts with mp3 audio bytes.
        """
        client = self._get_client()
        prompt = self._build_prompt(bible, duration)

        if on_chunk:
            on_chunk("start", 0, 0)

        try:
            response = client.models.generate_content(
                model=self.MUSIC_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO", "TEXT"],
                ),
            )
        except Exception as e:
            raise RuntimeError(f"Lyria 3 generation failed: {e}") from e

        # Extract audio bytes from response
        audio_bytes = None
        for part in response.parts:
            if hasattr(part, "inline_data") and part.inline_data is not None:
                audio_bytes = part.inline_data.data
                break
            if hasattr(part, "text") and part.text:
                # Log any text parts (metadata/annotations)
                print(f"[Lyria] {part.text}")

        if audio_bytes is None:
            raise RuntimeError("Lyria 3 returned no audio data.")

        if on_chunk:
            on_chunk("chunk", duration, duration)

        url = await self.gcs.upload_bytes(
            audio_bytes,
            f"audio/{mission_id}/score.mp3",
            "audio/mpeg",
        )

        if on_chunk:
            on_chunk("done", duration, duration)

        return url
