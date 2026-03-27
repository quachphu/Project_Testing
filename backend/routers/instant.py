"""
instant.py — Optimized pipeline (target: <3 min end-to-end)

Speed optimizations:
  1. World Bible: gemini-3.1-flash-lite-preview   (~5-10s)
  2. NO Nano Banana character images step          (saves ~90s)
  3. Veo: veo-3.1-fast-generate-preview x3 parallel (-50% vs standard)
  4. Lyria: runs CONCURRENTLY with Veo polling    (saves ~20s)
  5. All Veo ops fired simultaneously (asyncio.gather)
"""
from fastapi import APIRouter, BackgroundTasks, HTTPException
from models.brief import CreativeBrief
import uuid
import asyncio

router = APIRouter(prefix="/v1/instant", tags=["instant"])

# In-memory live event queues per mission
_mission_queues: dict[str, asyncio.Queue] = {}


def _get_deps():
    from db.supabase_client import SupabaseClient
    from agents.director_agent import DirectorAgent
    from pipelines.visual_pipeline import VisualPipeline
    from pipelines.audio_pipeline import AudioPipeline
    from pipelines.assembly_pipeline import AssemblyPipeline
    return (
        SupabaseClient(),
        DirectorAgent(),
        VisualPipeline(),
        AudioPipeline(),
        AssemblyPipeline(),
    )


def _push(mid: str, event: dict):
    q = _mission_queues.get(mid)
    if q:
        try:
            q.put_nowait(event)
        except Exception:
            pass


@router.post("/initiate")
async def initiate(brief: CreativeBrief, bg: BackgroundTasks):
    db, director, visual, audio, assembly = _get_deps()
    mid = str(uuid.uuid4())
    _mission_queues[mid] = asyncio.Queue()
    await db.create_mission(mid, "instant", brief.dict())
    bg.add_task(run_instant_pipeline, mid, brief)
    return {"mission_id": mid, "status": "planning"}


@router.get("/status/{mid}")
async def status(mid: str):
    db, *_ = _get_deps()
    m = await db.get_mission(mid)
    if not m:
        raise HTTPException(404, "Mission not found")
    return m


@router.get("/events/{mid}")
async def get_events(mid: str):
    q = _mission_queues.get(mid)
    events = []
    if q:
        while not q.empty():
            try:
                events.append(q.get_nowait())
            except Exception:
                break
    return {"events": events}


async def run_instant_pipeline(mid: str, brief: CreativeBrief):
    db, director, visual, audio, assembly = _get_deps()
    try:
        # ── 1. World Bible (Flash-Lite: ~5-10s) ──────────────────────────────
        await db.set_status(mid, "planning")
        _push(mid, {"type": "status", "step": "planning", "msg": "Director building world bible..."})

        bible = director.build_world_bible(
            brief,
            on_token_update=lambda n: asyncio.create_task(
                db.set_field(mid, "thinking_tokens", n)
            ),
        )
        await db.save_world_bible(mid, bible.dict())
        _push(mid, {
            "type": "bible_ready",
            "characters": [{"name": c.name, "traits": c.visual_traits.dict()} for c in bible.characters],
            "genre": bible.genre,
            "tone": bible.tone,
        })

        # ── 2. Skip Nano Banana — jump straight to Veo ────────────────────────
        # (Images add 90+ seconds; they can't be bound to Veo in text-only mode)
        await db.set_status(mid, "scenes")
        _push(mid, {"type": "status", "step": "scenes",
                    "msg": "Veo 3.1 Fast — all scenes firing simultaneously..."})

        prompts = [
            director.build_veo_prompt(bible, i, [], None)
            for i in range(len(bible.narrative_beats))
        ]

        scene_urls   = [None] * len(prompts)
        scene_done   = asyncio.Event()

        # ── 3. Lyria runs concurrently with Veo (saves 20-30s) ───────────────
        lyria_task = asyncio.create_task(_run_lyria(mid, bible, db, audio))
        _push(mid, {"type": "status", "step": "scoring",
                    "msg": "Lyria 3 composing score in background..."})

        async def on_scene_ready(idx: int, url: str):
            scene_urls[idx] = url
            _push(mid, {"type": "scene_ready", "index": idx, "url": url})
            await db.set_field(mid, "scene_urls", [u for u in scene_urls if u])

        # Fire all Veo operations simultaneously
        all_urls = await visual.generate_all_scenes_parallel(
            mid, prompts, [],
            on_scene_ready=on_scene_ready,
        )

        # ── 4. Wait for Lyria (usually already done by now) ──────────────────
        await db.set_status(mid, "scoring")
        audio_url = await lyria_task
        if audio_url:
            _push(mid, {"type": "audio_ready", "url": audio_url})

        # ── 5. Assembly ───────────────────────────────────────────────────────
        await db.set_status(mid, "assembling")
        _push(mid, {"type": "status", "step": "assembling",
                    "msg": "Assembling final teaser..."})
        final_url = await assembly.assemble(mid, all_urls, audio_url)

        await db.complete_mission(mid, final_url)
        _push(mid, {"type": "complete", "url": final_url})

    except Exception as e:
        await db.set_status(mid, "error")
        await db.set_field(mid, "error_msg", str(e))
        _push(mid, {"type": "error", "msg": str(e)})
        raise
    finally:
        await asyncio.sleep(30)
        _mission_queues.pop(mid, None)


async def _run_lyria(mid: str, bible, db, audio) -> str | None:
    """Generate Lyria score concurrently. Returns URL or None on failure."""
    try:
        url = await audio.generate_score(mid, bible)
        return url
    except Exception as e:
        print(f"[Lyria] Non-fatal error (will assemble without music): {e}")
        return None
