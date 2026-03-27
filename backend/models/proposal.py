from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class SceneProposal(BaseModel):
    scene_index: int           # 0, 1, 2
    duration_seconds: int      # 8 or 10
    title: str                 # Short scene title e.g. "The Arrival"
    description: str           # What happens in this scene (2-4 sentences)
    visual_direction: str      # Camera movement, lighting, composition
    emotional_beat: str        # What emotion this scene delivers
    key_image: str             # One iconic image from this scene


class CharacterProposal(BaseModel):
    name: str
    role: str                  # "Protagonist" | "Antagonist" | "Supporting"
    visual_description: str    # Full physical description for Veo/Nano Banana
    motivation: str            # What drives this character
    arc: str                   # How they change across the 3 scenes


class ProposalDraft(BaseModel):
    title: str                             # Working title of the piece
    logline: str                           # One sentence: who + what + stakes
    visual_style: str                      # Style language: "Neon-noir anime" etc.
    tone: str                              # Overall emotional register
    genre: str                             # Genre classification
    world: str                             # 2-3 sentence world description
    characters: List[CharacterProposal]
    scenes: List[SceneProposal]            # Always 3 scenes
    music_direction: str                   # Lyria guidance: BPM, mood, instrumentation
    color_palette: List[str]               # 5 HEX codes
    production_notes: str                  # Any special considerations


class StudioProposal(BaseModel):
    proposal_id: Optional[str] = None
    raw_idea: str
    genre_hints: Optional[List[str]] = []
    tone_hints: Optional[List[str]] = []
    current_draft: Optional[ProposalDraft] = None
    revision_log: List[Dict[str, Any]] = []
    status: str = "drafting"               # drafting|revising|approved


class RevisionRequest(BaseModel):
    proposal_id: str
    user_prompt: str  # What the user wants changed
