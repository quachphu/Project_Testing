from pydantic import BaseModel, Field
from typing import List, Optional


class VisualTraits(BaseModel):
    hair: str
    eyes: str
    skin: str
    outfit: str
    age: str
    distinctive_features: str


class Character(BaseModel):
    id: str
    name: str
    visual_traits: VisualTraits
    voice_profile: str
    visual_seed_url: Optional[str] = None


class NarrativeBeat(BaseModel):
    beat_index: int
    scene_index: int
    description: str
    emotional_tone: str
    bpm_target: int
    cinematography: str


class WorldBible(BaseModel):
    project_id: str
    mode: str                              # 'instant' | 'studio'
    style: str
    genre: str
    tone: str
    lore: str
    global_palette: List[str]             = Field(default_factory=list)
    characters: List[Character]           = Field(default_factory=list)
    narrative_beats: List[NarrativeBeat] = Field(default_factory=list)
    safety_cleared: bool = False
