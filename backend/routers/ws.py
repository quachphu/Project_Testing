from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from db.supabase_client import SupabaseClient
import asyncio

router = APIRouter(prefix="/ws")


@router.websocket("/mission/{mid}")
async def stream(ws: WebSocket, mid: str):
    """
    Streams mission status + live events every 1s.
    Events are sourced from two places:
      1. The in-memory event queue in instant.py (_mission_queues)
      2. Polling Supabase for DB status changes
    """
    await ws.accept()

    db = SupabaseClient()
    last_status = None
    consecutive_errors = 0
    not_found_count = 0

    try:
        while True:
            # ── Drain live events from the in-memory queue ─────────────────
            try:
                from routers.instant import _mission_queues
                q = _mission_queues.get(mid)
                if q:
                    while not q.empty():
                        event = q.get_nowait()
                        await ws.send_json(event)
            except Exception:
                pass

            # ── Poll DB for status ──────────────────────────────────────────
            try:
                m = await db.get_mission(mid)
                consecutive_errors = 0
            except Exception as e:
                consecutive_errors += 1
                if consecutive_errors >= 5:
                    await ws.send_json({"type": "error", "msg": str(e)})
                    break
                await asyncio.sleep(2)
                continue

            if not m:
                not_found_count += 1
                if not_found_count >= 10:
                    await ws.send_json({"type": "error", "msg": "mission not found"})
                    break
                await asyncio.sleep(1)
                continue

            not_found_count = 0
            cur = m.get("status")
            if cur != last_status:
                last_status = cur
                await ws.send_json({"type": "status", "data": m})

            if cur in ("complete", "error"):
                await ws.send_json({"type": cur, "data": m})
                break

            await asyncio.sleep(1.0)

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
