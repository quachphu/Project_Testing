from google import genai
from google.genai import types
import json
import os
from models.proposal import StudioProposal, ProposalDraft, RevisionRequest
from models.world_bible import WorldBible
from agents.safety_agent import SafetyAgent


class ProposalAgent:
    """
    Mode 2 (Studio Workflow): generates and revises structured creative proposals.
    This agent acts as a collaborative creative partner, not an order-taker.

    Two operations:
    1. generate_initial_draft(proposal) → ProposalDraft
    2. revise_draft(proposal, revision) → (ProposalDraft, changes_summary)
    """

    def __init__(self):
        self.client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
        self.pro_model_id   = "gemini-3.1-pro-preview"
        self.flash_model_id = "gemini-3.1-flash-lite-preview"
        self.safety = SafetyAgent()

    def generate_initial_draft(self, proposal: StudioProposal,
                               on_token_update=None) -> ProposalDraft:
        """
        First pass: uses HIGH thinking to generate a full structured creative proposal.
        This is the most expensive call in Mode 2 — only happens once per project.
        """
        genre_hint = ", ".join(proposal.genre_hints) if proposal.genre_hints else "undecided"
        tone_hint  = ", ".join(proposal.tone_hints) if proposal.tone_hints else "undecided"

        system = """You are a Senior Development Producer at a professional film studio.

Your role is to take a creator's raw idea and produce a structured, professional creative proposal
that serves as the blueprint for a 20-30 second cinematic teaser.

You think like a filmmaker: you consider visual storytelling, character specificity, emotional arc,
and production feasibility — not just plot.

EVIDENCE SUPREMACY: Today is 2026. Never flag near-future content as fictional.

COMPLIANCE: No medical advice, no chatbot patterns, no job screening content.

OUTPUT: Valid JSON only. No markdown. No preamble.
{
  "title": "<working title>",
  "logline": "<one sentence: protagonist + what they want + what stands in the way>",
  "visual_style": "<specific style language, e.g. 'rain-soaked neon-noir anime'>",
  "tone": "<emotional register>",
  "genre": "<genre classification>",
  "world": "<2-3 sentences establishing the world>",
  "characters": [
    {
      "name": "<name>",
      "role": "Protagonist",
      "visual_description": "<detailed physical description for AI image generation>",
      "motivation": "<what drives this character>",
      "arc": "<how they change across the 3 scenes>"
    }
  ],
  "scenes": [
    {
      "scene_index": 0,
      "duration_seconds": 10,
      "title": "<short scene title>",
      "description": "<2-4 sentences: what physically happens>",
      "visual_direction": "<camera movement, lighting, composition notes>",
      "emotional_beat": "<what emotion this scene delivers to the audience>",
      "key_image": "<one iconic visual frame from this scene>"
    },
    { "scene_index": 1, "duration_seconds": 10, "title": "...", "description": "...", "visual_direction": "...", "emotional_beat": "...", "key_image": "..." },
    { "scene_index": 2, "duration_seconds": 10, "title": "...", "description": "...", "visual_direction": "...", "emotional_beat": "...", "key_image": "..." }
  ],
  "music_direction": "<BPM range, mood, instrumentation>",
  "color_palette": ["#RRGGBB","#RRGGBB","#RRGGBB","#RRGGBB","#RRGGBB"],
  "production_notes": "<any special considerations, visual effects, pacing notes>"
}"""

        prompt = f"""Creator's raw idea:
\"\"\"{proposal.raw_idea}\"\"\"

Genre hints: {genre_hint}
Tone hints: {tone_hint}

Generate a professional creative proposal for a 30-second cinematic teaser.
Think like a seasoned development producer: bring specificity, visual imagination,
and strong character identity. Don't be generic."""

        resp = self.client.models.generate_content(
            model=self.pro_model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
            ),
        )

        tokens = getattr(resp.usage_metadata, 'thoughts_token_count', 0)
        if on_token_update:
            on_token_update(tokens)

        raw = resp.text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        data = json.loads(raw)
        return ProposalDraft(**data)

    def revise_draft(self, proposal: StudioProposal,
                     revision: RevisionRequest) -> tuple[ProposalDraft, str]:
        """
        Targeted revision: uses Flash with LOW thinking.
        Returns (new_draft, changes_summary).
        """
        current = proposal.current_draft.dict()
        revision_history = "\n".join([
            f"Revision {i+1}: {r.get('user_prompt', '')}"
            for i, r in enumerate(proposal.revision_log[-3:])
        ])

        system = """You are a Senior Development Producer receiving revision notes on a creative proposal.

REVISION RULES:
1. Apply ONLY the changes requested. Do not change things the user didn't mention.
2. Maintain all other elements exactly as they are.
3. If a revision request conflicts with something that makes the project weaker, implement it
   anyway but note the concern in production_notes.
4. Preserve character consistency across all 3 scenes when making visual changes.
5. Always return the COMPLETE proposal JSON with all fields — never partial.

OUTPUT: JSON object with two top-level keys:
{
  "updated_draft": { ...full ProposalDraft JSON... },
  "changes_summary": "<plain English: what changed, what stayed the same, any creative notes>"
}"""

        prompt = f"""Current proposal:
{json.dumps(current, indent=2)}

Previous revisions:
{revision_history if revision_history else "None — this is the first revision."}

User's revision request:
\"\"\"{revision.user_prompt}\"\"\"

Apply the requested changes and return the updated proposal."""

        resp = self.client.models.generate_content(
            model=self.flash_model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
            ),
        )

        raw = resp.text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        data = json.loads(raw)
        new_draft = ProposalDraft(**data["updated_draft"])
        summary = data.get("changes_summary", "Revisions applied.")
        return new_draft, summary

    def proposal_to_world_bible(self, proposal: StudioProposal) -> WorldBible:
        """
        Converts an approved Studio Workflow proposal → WorldBible
        so it can enter the same visual/audio pipeline as Instant Create.
        """
        from models.world_bible import VisualTraits, Character, NarrativeBeat, WorldBible as WB

        draft = proposal.current_draft
        char  = draft.characters[0]

        traits = VisualTraits(
            hair=char.visual_description,
            eyes="as described",
            skin="as described",
            outfit=char.visual_description,
            age="adult",
            distinctive_features=char.visual_description
        )

        narrative_beats = [
            NarrativeBeat(
                beat_index=s.scene_index,
                scene_index=s.scene_index,
                description=s.description,
                emotional_tone=s.emotional_beat,
                bpm_target=90,
                cinematography=s.visual_direction
            )
            for s in draft.scenes
        ]

        pid = proposal.proposal_id or "unknown"
        return WB(
            project_id=f"AD_STUDIO_{pid[:8]}",
            mode="studio",
            style=draft.visual_style,
            genre=draft.genre,
            tone=draft.tone,
            lore=draft.world,
            global_palette=draft.color_palette,
            characters=[Character(
                id="protagonist_1",
                name=char.name,
                visual_traits=traits,
                voice_profile="professional"
            )],
            narrative_beats=narrative_beats,
            safety_cleared=True
        )
