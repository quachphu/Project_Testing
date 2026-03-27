from models.world_bible import WorldBible

BLOCKED_TERMS = [
    "diagnos", "prescri", "therapy", "mental health", "clinical depression",
    "medication", "medical advice", "anxiety treatment", "suicide", "self-harm",
    "job interview", "hiring", "resume screener", "applicant", "recruitment",
    "how can i help you", "what would you like", "i am an ai assistant"
]


class SafetyAgent:
    def check(self, bible: WorldBible) -> bool:
        corpus = " ".join([
            bible.lore,
            *[b.description for b in bible.narrative_beats],
            *[c.name + " " + c.voice_profile for c in bible.characters]
        ]).lower()
        for term in BLOCKED_TERMS:
            if term in corpus:
                print(f"[SafetyAgent] BLOCKED: '{term}'")
                return False
        return True

    def check_proposal(self, text: str) -> bool:
        lowered = text.lower()
        return not any(term in lowered for term in BLOCKED_TERMS)
