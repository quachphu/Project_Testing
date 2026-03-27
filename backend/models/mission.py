from pydantic import BaseModel
from typing import List, Optional


class MissionStatus(BaseModel):
    mission_id: str
    mode: str
    status: str
    world_bible: Optional[dict] = None
    scene_urls: List[str] = []
    audio_url: Optional[str] = None
    final_url: Optional[str] = None
    consistency_scores: List[float] = []
    thinking_tokens_used: int = 0
    elapsed_seconds: float = 0
    error: Optional[str] = None
