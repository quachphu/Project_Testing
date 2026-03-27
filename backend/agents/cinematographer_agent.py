"""
Cinematographer Agent — delegates Veo prompt construction to DirectorAgent.
Exists as a distinct module for future specialization (e.g., shot list generation,
B-roll suggestions, lens / focal length recommendations).
"""
from models.world_bible import WorldBible
from agents.director_agent import DirectorAgent


class CinematographerAgent:
    """Wraps Veo prompt building with cinematographic reasoning."""

    def __init__(self):
        self._director = DirectorAgent()

    def build_veo_prompt(
        self,
        bible: WorldBible,
        beat_index: int,
        ingredient_urls: list,
        prev_scene_url: str = None,
    ) -> str:
        """Build a Veo 3.1 cinematic prompt for the given beat."""
        return self._director.build_veo_prompt(
            bible, beat_index, ingredient_urls, prev_scene_url
        )
