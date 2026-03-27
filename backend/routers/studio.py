from fastapi import APIRouter, BackgroundTasks, HTTPException
from models.proposal import StudioProposal, RevisionRequest
from db.supabase_client import SupabaseClient
from agents.proposal_agent import ProposalAgent
from pipelines.visual_pipeline import VisualPipeline
from pipelines.audio_pipeline import AudioPipeline
from pipelines.assembly_pipeline import AssemblyPipeline
import uuid
import asyncio

router = APIRouter(prefix="/v1/studio", tags=["studio"])
db = SupabaseClient()
agent = ProposalAgent()
visual = VisualPipeline()
audio = AudioPipeline()
assembly = AssemblyPipeline()


@router.post("/proposal/create")
async def create_proposal(body: dict):
    """
    Step 1: User submits raw idea.
    Blocks ~15s while AI generates first draft, then returns proposal_id + draft.
    """
    pid = str(uuid.uuid4())
    proposal = StudioProposal(
        proposal_id=pid,
        raw_idea=body.get("raw_idea", ""),
        genre_hints=body.get("genre_hints", []),
        tone_hints=body.get("tone_hints", []),
    )
    await db.create_proposal(pid, proposal.dict())

    token_log = [0]
    def on_tokens(n): token_log[0] = n

    draft = agent.generate_initial_draft(proposal, on_token_update=on_tokens)
    proposal.current_draft = draft
    proposal.status = "revising"
    await db.save_proposal_draft(pid, draft.dict(), token_log[0])

    return {
        "proposal_id": pid,
        "status": "revising",
        "draft": draft.dict(),
        "thinking_tokens": token_log[0],
    }


@router.post("/proposal/revise")
async def revise_proposal(revision: RevisionRequest):
    """
    Step 2 (repeatable): User sends revision prompt.
    Returns updated draft + plain-English changes summary.
    """
    proposal_data = await db.get_proposal(revision.proposal_id)
    if not proposal_data:
        raise HTTPException(404, "Proposal not found")

    from models.proposal import ProposalDraft
    proposal = StudioProposal(**proposal_data)

    new_draft, summary = agent.revise_draft(proposal, revision)

    await db.save_revision(
        proposal_id=revision.proposal_id,
        user_prompt=revision.user_prompt,
        previous_draft=proposal.current_draft.dict(),
        new_draft=new_draft.dict(),
        changes_summary=summary,
    )

    return {
        "proposal_id": revision.proposal_id,
        "status": "revising",
        "draft": new_draft.dict(),
        "changes_summary": summary,
    }


@router.post("/proposal/approve/{proposal_id}")
async def approve_proposal(proposal_id: str, bg: BackgroundTasks):
    """
    Step 3: User clicks APPROVE. Locks proposal and kicks off generation.
    Returns mission_id → frontend redirects to /studio/production?id=...
    """
    proposal_data = await db.get_proposal(proposal_id)
    if not proposal_data:
        raise HTTPException(404, "Proposal not found")

    proposal = StudioProposal(**proposal_data)
    await db.set_proposal_status(proposal_id, "approved")

    mid = str(uuid.uuid4())
    await db.create_mission(mid, "studio", None, proposal_id=proposal_id)

    bg.add_task(run_studio_pipeline, mid, proposal)
    return {"mission_id": mid, "proposal_id": proposal_id, "status": "generating"}


@router.get("/proposal/{proposal_id}")
async def get_proposal(proposal_id: str):
    p = await db.get_proposal(proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")
    return p


@router.get("/proposal/{proposal_id}/history")
async def get_revision_history(proposal_id: str):
    return await db.get_revision_history(proposal_id)


async def run_studio_pipeline(mid: str, proposal: StudioProposal):
    """Same visual/audio pipeline as Instant — WorldBible comes from approved proposal."""
    try:
        bible = agent.proposal_to_world_bible(proposal)

        await db.set_status(mid, "ingredients")
        ingredient_urls = []
        for char in bible.characters:
            urls = await visual.generate_ingredients(char, mid, bible.style)
            char.visual_seed_url = urls[0]
            ingredient_urls.extend(urls[:3])

        scene_urls, prev = [], None
        for i, beat in enumerate(bible.narrative_beats):
            await db.set_status(mid, f"scene_{i}")
            from agents.director_agent import DirectorAgent
            d = DirectorAgent()
            prompt = d.build_veo_prompt(bible, i, ingredient_urls, prev)
            url = await visual.generate_scene(mid, i, prompt, ingredient_urls, prev)
            scene_urls.append(url)
            prev = url
            await db.set_field(mid, "scene_urls", scene_urls)

        await db.set_status(mid, "scoring")
        audio_url = await audio.generate_score(mid, bible)

        await db.set_status(mid, "assembling")
        final_url = await assembly.assemble(mid, scene_urls, audio_url)
        await db.complete_mission(mid, final_url)

    except Exception as e:
        await db.set_status(mid, "error")
        await db.set_field(mid, "error_msg", str(e))
        raise
