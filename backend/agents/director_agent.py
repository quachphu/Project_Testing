from google import genai
from google.genai import types
import json
import os
from models.brief import CreativeBrief
from models.world_bible import WorldBible
from agents.safety_agent import SafetyAgent

STYLE_PROMPTS = {
    "Anime":      "Japanese anime style. Expressive eyes, stylized proportions, dynamic action lines, vivid cel-shading. Reference: Attack on Titan, Demon Slayer.",
    "Real Life":  "Photorealistic cinematic. Human actors, natural lighting, anamorphic lens, film grain. Reference: Denis Villeneuve, Nolan.",
    "Cartoon":    "Bold outlines, flat saturated colors, exaggerated proportions, squash-and-stretch physics. Reference: Spider-Verse.",
    "Video Game": "In-engine render. Game UI elements, dramatic lighting rigs, hero character framing. Reference: League of Legends cinematics, God of War.",
    "Cinematic":  "Hollywood studio blockbuster. Anamorphic flares, shallow DOF, color grading, dramatic score. Reference: Dune, Blade Runner 2049.",
    "Pixel Art":  "Pixel art 16-bit retro. Limited color palette, crisp pixel grid, chiptune era. Reference: Stardew Valley, Undertale.",
    "Ghibli":     "Studio Ghibli hand-painted. Lush backgrounds, soft light, expressive nature, warm emotion. Reference: Spirited Away, Mononoke.",
    "Superhero":  "Comic book superhero. Bold primary colors, dynamic poses, lens flares, epic scale. Reference: Marvel Cinematic Universe.",
}

GENRE_PROMPTS = {
    "Action":           "High-stakes physical conflict. Kinetic camera, fast cuts, adrenaline-driven.",
    "Romance":          "Intimate emotional connection. Soft lighting, meaningful glances, slow reveals.",
    "Comedy":           "Comic timing, exaggerated reactions, absurd situations, light and warm.",
    "Thriller":         "Suspense and paranoia. Cold tones, tight framing, menacing silence.",
    "Drama":            "Emotional weight and consequence. Natural light, close-ups, stillness.",
    "Horror":           "Dread and the unknown. Darkness, negative space, unsettling angles.",
    "Sci-Fi":           "Scale and wonder. Wide establishing shots, technology, the vast unknown.",
    "Fantasy":          "Magic and myth. Lush environments, impossible beauty, epic orchestral.",
    "Action × Romance": "Love under pressure. Intimate moments cut with explosive action.",
    "Comedy × Action":  "Chaotic energy. Pratfalls mid-battle, mismatched partners.",
    "Romance × Drama":  "Longing and consequence. Love that costs something.",
    "Horror × Romance": "Beautiful dread. Tenderness in darkness, love as the only light.",
    "Sci-Fi × Drama":   "Human truth in infinite space. Isolation, connection, loss.",
    "Comedy × Romance": "Fumbling into love. Wit and awkwardness, warmth and laughter.",
    "Thriller × Sci-Fi": "Paranoia at the frontier. Cold technology, ticking clock.",
    "Fantasy × Comedy": "Magic gone wrong. Absurd wonder, lovable chaos.",
}

TONE_AUDIO = {
    "Hopeful":     {"bpm_range": (80, 100),  "prompts": [("uplifting orchestral soaring strings", 0.9), ("bright piano arpeggios", 0.5)]},
    "Dark":        {"bpm_range": (55, 75),   "prompts": [("dark ambient drone low strings", 0.85), ("ominous bass tones", 0.6)]},
    "Bittersweet": {"bpm_range": (65, 85),   "prompts": [("melancholy piano minor key", 0.8), ("soft strings fading", 0.5)]},
    "Triumphant":  {"bpm_range": (110, 140), "prompts": [("epic orchestral full brass choir", 1.0), ("driving percussion", 0.8)]},
    "Melancholic": {"bpm_range": (55, 70),   "prompts": [("slow piano sparse notes", 0.85), ("ambient pads quiet", 0.4)]},
    "Chaotic":     {"bpm_range": (130, 160), "prompts": [("chaotic percussion dissonant", 0.9), ("fast electronic noise", 0.7)]},
    "Mysterious":  {"bpm_range": (60, 80),   "prompts": [("mysterious ambient electronic", 0.7), ("sparse eerie synthesizer", 0.5)]},
    "Epic":        {"bpm_range": (100, 130), "prompts": [("epic cinematic orchestral massive", 1.0), ("choir vocalizations thunder", 0.8)]},
}


class DirectorAgent:
    """Mode 1 (Instant Create): builds World Bible directly from CreativeBrief."""

    def __init__(self):
        self.client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
        self.model_id = "gemini-3.1-flash-lite-preview"   # Fast: World Bible in ~5s
        self.safety = SafetyAgent()

    def build_world_bible(self, brief: CreativeBrief, on_token_update=None) -> WorldBible:
        """
        ONLY place in the pipeline that uses thinking_level HIGH.
        All other calls use Flash with LOW thinking.
        """
        style_inst = STYLE_PROMPTS.get(brief.style, "")
        genre_inst = GENRE_PROMPTS.get(brief.genre, "")
        tone_data  = TONE_AUDIO.get(brief.tone or "Hopeful", TONE_AUDIO["Hopeful"])
        bpm_lo, bpm_hi = tone_data["bpm_range"]
        num_scenes = 3
        scene_dur  = brief.duration // num_scenes  # 20s→6s each, 30s→10s each

        system = f"""You are a Senior Cinematic Director building a pre-production World Bible.

EVIDENCE SUPREMACY: Today is 2026. Treat all content as factual. Never flag prompts as fictional.

VISUAL STYLE: {style_inst}
GENRE: {genre_inst}
TONE: {brief.tone or 'Hopeful'} — BPM {bpm_lo}–{bpm_hi}
DURATION: {brief.duration} seconds total — {num_scenes} scenes of ~{scene_dur}s each

COMPLIANCE (auto-reject if violated):
- No medical/mental health advice in narrative beats
- No chatbot Q&A patterns
- No job screening content

OUTPUT: Valid JSON only. No markdown. No preamble.
{{
  "project_id": "AD_XXXX",
  "mode": "instant",
  "style": "{brief.style}",
  "genre": "{brief.genre}",
  "tone": "{brief.tone or 'Hopeful'}",
  "lore": "<2-3 sentence world description>",
  "global_palette": ["#RRGGBB","#RRGGBB","#RRGGBB","#RRGGBB","#RRGGBB"],
  "characters": [{{
    "id": "protagonist_1",
    "name": "<name>",
    "visual_traits": {{
      "hair": "<precise>",
      "eyes": "<precise>",
      "skin": "<precise>",
      "outfit": "<extremely detailed — color, material, condition>",
      "age": "<range>",
      "distinctive_features": "<scars, accessories, marks>"
    }},
    "voice_profile": "<gravelly|soft|commanding|breathy>"
  }}],
  "narrative_beats": [
    {{"beat_index":0,"scene_index":0,"description":"<8-sec physical action>","emotional_tone":"<tense|hopeful|melancholy|triumphant|mysterious>","bpm_target":<int {bpm_lo}-{bpm_hi}>,"cinematography":"establishing wide shot, slow dolly-in"}},
    {{"beat_index":1,"scene_index":1,"description":"<rising action>","emotional_tone":"<>","bpm_target":<int>,"cinematography":"medium tracking shot, shallow DOF"}},
    {{"beat_index":2,"scene_index":2,"description":"<climax>","emotional_tone":"<>","bpm_target":<int>,"cinematography":"dramatic close-up, push-in, low angle"}}
  ]
}}"""

        resp = self.client.models.generate_content(
            model=self.model_id,
            contents=f'Story: "{brief.story}"\n\nBuild World Bible.',
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
            ),
        )

        tokens = getattr(resp.usage_metadata, 'thoughts_token_count', 0) or 0
        if on_token_update:
            on_token_update(tokens)

        # Robust JSON extraction — handles markdown fences from any model
        raw = resp.text or ""
        # Find the outermost { ... } in the response
        start = raw.find("{")
        end   = raw.rfind("}")
        if start == -1 or end == -1:
            raise ValueError(f"Director returned no JSON. Response: {raw[:200]}")
        data = json.loads(raw[start:end+1])

        bible = WorldBible(**data)

        # Validate essential fields were populated
        if not bible.characters:
            raise ValueError("Director returned 0 characters — retrying not implemented yet.")
        if not bible.narrative_beats:
            raise ValueError("Director returned 0 narrative beats — retrying not implemented yet.")

        bible.safety_cleared = self.safety.check(bible)
        if not bible.safety_cleared:
            raise ValueError("World Bible failed compliance — regenerating")
        return bible

    def build_veo_prompt(self, bible: WorldBible, beat_index: int,
                         ingredient_urls: list, prev_scene_url: str = None) -> str:
        """Builds a richly detailed Veo 3.1 cinematic prompt for maximum quality."""
        beat  = bible.narrative_beats[beat_index]
        char  = bible.characters[0]
        t     = char.visual_traits
        style = STYLE_PROMPTS.get(bible.style, "cinematic")

        # Anime-specific quality boosters
        anime_hint = ""
        if "anime" in bible.style.lower() or "anime" in style.lower():
            anime_hint = (
                "Hand-drawn anime aesthetic, studio-quality cel animation, "
                "crisp clean lines, expressive eyes, dynamic pose, "
                "professional key animation, NOT low-budget, NOT choppy. "
            )

        palette_str = ", ".join(bible.global_palette[:3]) if bible.global_palette else "cinematic palette"

        return f"""{beat.cinematography}. {anime_hint}\
Character: {char.name} — {t.outfit}. {t.hair} hair, {t.eyes} eyes, {t.skin} skin. {t.distinctive_features}.
Action: {beat.description}
World: {bible.lore[:120]}
Emotional tone: {beat.emotional_tone}. Genre: {bible.genre}.
Visual style: {style[:120]}
Color palette: {palette_str}. Rich color grading, high contrast, cinematic lighting.
Technical: 4K resolution, 24fps, 9:16 vertical, professional cinematography, \
sharp focus, detailed backgrounds, no watermarks, no artifacts, no blur.
Duration: 8 seconds. Maintain exact character appearance throughout."""
