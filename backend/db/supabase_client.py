import os
import asyncio
import uuid
from typing import Any, Dict, List, Optional

# ── Try to import real Supabase client ────────────────────────────────────────
try:
    from supabase import create_client, Client as _SupaClient
    _SUPABASE_AVAILABLE = True
except Exception:
    _SUPABASE_AVAILABLE = False


# ── In-memory store (used when Supabase is unavailable / key is wrong) ────────
_MEM: Dict[str, Dict] = {}
_PROPOSALS: Dict[str, Dict] = {}
_REVISIONS: Dict[str, List] = {}


class SupabaseClient:
    """
    Async wrapper around Supabase.
    Falls back to an in-memory dict store when the Supabase key is invalid
    or the DB is unreachable — so the UI works for demo purposes.
    """

    def __init__(self):
        self._client = None
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_KEY", "")

        # Supabase Python client requires a JWT (eyJ...). The sb_secret_... format
        # is a new Supabase personal-access-token format not supported by the SDK yet.
        if _SUPABASE_AVAILABLE and url and key.startswith("eyJ"):
            try:
                self._client = create_client(url, key)
                print("[SupabaseClient] Connected to Supabase.")
            except Exception as e:
                print(f"[SupabaseClient] Connection failed ({e}) — using in-memory store.")
        else:
            print("[SupabaseClient] Using in-memory store (no valid Supabase key).")

    def _using_mem(self) -> bool:
        return self._client is None

    def _disable_supabase(self, err: Exception):
        """Called when any Supabase operation fails — falls back to memory for this session."""
        print(f"[SupabaseClient] DB error ({err}) — switching to in-memory store for this session.")
        self._client = None

    # ─── MISSION OPERATIONS ───────────────────────────────────────────────────

    async def create_mission(
        self,
        mission_id: str,
        mode: str,
        brief: Optional[Dict] = None,
        proposal_id: Optional[str] = None,
    ) -> Dict:
        row = {
            "mission_id": mission_id,
            "mode": mode,
            "brief": brief,
            "proposal_id": proposal_id,
            "status": "pending",
            "scene_urls": [],
            "thinking_tokens": 0,
        }
        if self._using_mem():
            _MEM[mission_id] = row
            return row
        try:
            result = self._client.table("missions").insert(row).execute()
            return result.data[0] if result.data else row
        except Exception as e:
            self._disable_supabase(e)
            _MEM[mission_id] = row
            return row

    async def get_mission(self, mission_id: str) -> Optional[Dict]:
        if self._using_mem():
            return _MEM.get(mission_id)
        result = (
            self._client.table("missions")
            .select("*")
            .eq("mission_id", mission_id)
            .execute()
        )
        return result.data[0] if result.data else None

    async def set_status(self, mission_id: str, status: str) -> None:
        if self._using_mem():
            if mission_id in _MEM:
                _MEM[mission_id]["status"] = status
            return
        self._client.table("missions").update({"status": status}).eq(
            "mission_id", mission_id
        ).execute()

    async def set_field(self, mission_id: str, field: str, value: Any) -> None:
        if self._using_mem():
            if mission_id in _MEM:
                _MEM[mission_id][field] = value
            return
        self._client.table("missions").update({field: value}).eq(
            "mission_id", mission_id
        ).execute()

    async def save_world_bible(self, mission_id: str, bible_dict: Dict) -> None:
        if self._using_mem():
            if mission_id in _MEM:
                _MEM[mission_id]["world_bible"] = bible_dict
            return
        self._client.table("missions").update({"world_bible": bible_dict}).eq(
            "mission_id", mission_id
        ).execute()

    async def complete_mission(self, mission_id: str, final_url: str) -> None:
        from datetime import datetime, timezone
        update = {"status": "complete", "final_url": final_url,
                  "completed_at": datetime.now(timezone.utc).isoformat()}
        if self._using_mem():
            if mission_id in _MEM:
                _MEM[mission_id].update(update)
            return
        self._client.table("missions").update(update).eq("mission_id", mission_id).execute()

    # ─── CHARACTER OPERATIONS ─────────────────────────────────────────────────

    async def store_character(
        self, mission_id: str, char_id: str, embedding: List[float],
        seed_url: str, visual_traits: Dict,
    ) -> None:
        if self._using_mem():
            return  # skip in demo mode
        data = {"mission_id": mission_id, "name": char_id,
                 "appearance_embedding": embedding, "seed_url": seed_url,
                 "visual_traits": visual_traits}
        self._client.table("characters").insert(data).execute()

    async def get_character_embedding(self, mission_id: str) -> Optional[List[float]]:
        if self._using_mem():
            return None
        result = (
            self._client.table("characters")
            .select("appearance_embedding")
            .eq("mission_id", mission_id)
            .limit(1)
            .execute()
        )
        return result.data[0].get("appearance_embedding") if result.data else None

    # ─── SCENE OPERATIONS ─────────────────────────────────────────────────────

    async def update_scene(
        self, mission_id: str, scene_index: int, video_url: str, consistency_score: float
    ) -> None:
        if self._using_mem():
            return
        from datetime import datetime, timezone
        existing = (
            self._client.table("scenes")
            .select("scene_id")
            .eq("mission_id", mission_id)
            .eq("scene_index", scene_index)
            .execute()
        )
        payload = {"mission_id": mission_id, "scene_index": scene_index,
                   "video_url": video_url, "consistency_score": consistency_score,
                   "status": "complete",
                   "generated_at": datetime.now(timezone.utc).isoformat()}
        if existing.data:
            self._client.table("scenes").update(payload).eq(
                "scene_id", existing.data[0]["scene_id"]
            ).execute()
        else:
            self._client.table("scenes").insert(payload).execute()

    # ─── STUDIO PROPOSAL OPERATIONS ──────────────────────────────────────────

    async def create_proposal(self, proposal_id: str, data: Dict) -> Dict:
        row = {
            "proposal_id": proposal_id,
            "raw_idea": data.get("raw_idea", ""),
            "genre_hints": data.get("genre_hints", []),
            "tone_hints": data.get("tone_hints", []),
            "current_draft": data.get("current_draft") or {},
            "status": "drafting",
            "revision_log": [],
        }
        if self._using_mem():
            _PROPOSALS[proposal_id] = row
            _REVISIONS[proposal_id] = []
            return row
        result = self._client.table("studio_proposals").insert(row).execute()
        return result.data[0] if result.data else row

    async def get_proposal(self, proposal_id: str) -> Optional[Dict]:
        if self._using_mem():
            return _PROPOSALS.get(proposal_id)
        result = (
            self._client.table("studio_proposals")
            .select("*")
            .eq("proposal_id", proposal_id)
            .execute()
        )
        return result.data[0] if result.data else None

    async def save_proposal_draft(
        self, proposal_id: str, draft_dict: Dict, thinking_tokens: int = 0
    ) -> None:
        if self._using_mem():
            if proposal_id in _PROPOSALS:
                _PROPOSALS[proposal_id]["current_draft"] = draft_dict
                _PROPOSALS[proposal_id]["status"] = "revising"
            return
        self._client.table("studio_proposals").update(
            {"current_draft": draft_dict, "status": "revising"}
        ).eq("proposal_id", proposal_id).execute()

    async def save_revision(
        self, proposal_id: str, user_prompt: str,
        previous_draft: Dict, new_draft: Dict, changes_summary: str,
    ) -> None:
        rev = {"revision_id": str(uuid.uuid4()), "proposal_id": proposal_id,
               "user_prompt": user_prompt, "previous_draft": previous_draft,
               "new_draft": new_draft, "changes_summary": changes_summary}
        if self._using_mem():
            _REVISIONS.setdefault(proposal_id, []).append(rev)
            if proposal_id in _PROPOSALS:
                _PROPOSALS[proposal_id]["current_draft"] = new_draft
            return
        count_result = (
            self._client.table("revision_history")
            .select("revision_id")
            .eq("proposal_id", proposal_id)
            .execute()
        )
        rev["revision_num"] = len(count_result.data) + 1
        self._client.table("revision_history").insert(rev).execute()
        self._client.table("studio_proposals").update(
            {"current_draft": new_draft, "status": "revising"}
        ).eq("proposal_id", proposal_id).execute()

    async def set_proposal_status(self, proposal_id: str, status: str) -> None:
        from datetime import datetime, timezone
        payload: Dict[str, Any] = {"status": status}
        if status == "approved":
            payload["approved_at"] = datetime.now(timezone.utc).isoformat()
        if self._using_mem():
            if proposal_id in _PROPOSALS:
                _PROPOSALS[proposal_id].update(payload)
            return
        self._client.table("studio_proposals").update(payload).eq(
            "proposal_id", proposal_id
        ).execute()

    async def get_revision_history(self, proposal_id: str) -> List[Dict]:
        if self._using_mem():
            return _REVISIONS.get(proposal_id, [])
        result = (
            self._client.table("revision_history")
            .select("*")
            .eq("proposal_id", proposal_id)
            .order("revision_num")
            .execute()
        )
        return result.data or []
