"""
Embedding Pipeline — CLIP-style drift detection using Gemini embeddings.
Used to verify character visual consistency across scenes.
Wraps the embedding logic from VisualPipeline for standalone use.
"""
import numpy as np
import google.generativeai as genai
import os


class EmbeddingPipeline:
    """Gemini embedding utility for visual consistency checks."""

    def __init__(self):
        genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
        self.model = genai.GenerativeModel("text-embedding-004")

    async def embed_image(self, image_url: str) -> list[float]:
        """Embed an image from a URL and return a 512-d float vector."""
        r = await self.model.embed_content_async(
            content={"image_url": image_url},
            output_dimensionality=512,
        )
        return r.embedding

    def cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """Cosine similarity between two embedding vectors."""
        va = np.array(a, dtype=np.float32)
        vb = np.array(b, dtype=np.float32)
        norm_a = np.linalg.norm(va)
        norm_b = np.linalg.norm(vb)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(va, vb) / (norm_a * norm_b))

    async def drift_score(
        self, reference_url: str, scene_frame_url: str
    ) -> float:
        """
        Returns a similarity score 0–1 between reference character and scene frame.
        Score < 0.75 triggers a consistency override regeneration.
        """
        ref_emb   = await self.embed_image(reference_url)
        scene_emb = await self.embed_image(scene_frame_url)
        return self.cosine_similarity(ref_emb, scene_emb)
