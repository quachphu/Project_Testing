from pydantic import BaseModel
from typing import Optional


class CreativeBrief(BaseModel):
    style: str
    # "Anime"|"Real Life"|"Cartoon"|"Video Game"|"Cinematic"|"Pixel Art"|"Ghibli"|"Superhero"
    genre: str
    # "Action"|"Romance"|"Comedy"|"Thriller"|"Drama"|"Horror"|"Sci-Fi"|"Fantasy"
    # + blends: "Action × Romance"|"Comedy × Action"|"Romance × Drama"|"Horror × Romance"
    # "Sci-Fi × Drama"|"Comedy × Romance"|"Thriller × Sci-Fi"|"Fantasy × Comedy"
    tone: Optional[str] = None
    # "Hopeful"|"Dark"|"Bittersweet"|"Triumphant"|"Melancholic"|"Chaotic"|"Mysterious"|"Epic"
    story: str           # 10–400 chars — the user's story spark
    duration: int = 30   # 20 or 30 seconds
