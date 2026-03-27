"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function StudioApprovePage() {
  const router = useRouter();
  const params = useSearchParams();
  const proposalId = params.get("id") || "";
  const [proposal, setProposal] = useState<any>(null);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (!proposalId) return;
    fetch(`http://localhost:8000/v1/studio/proposal/${proposalId}`)
      .then(r => r.json())
      .then(setProposal);
  }, [proposalId]);

  async function handleRollCamera() {
    setLocking(true);
    const res = await fetch(`http://localhost:8000/v1/studio/proposal/approve/${proposalId}`, {
      method: "POST",
    });
    const data = await res.json();
    router.push(`/studio/production?id=${data.mission_id}`);
  }

  const draft = proposal?.current_draft;

  return (
    <main className="fade-in" style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px" }}>
      <div style={{ maxWidth:"640px", width:"100%" }}>
        {/* Top */}
        <div style={{ marginBottom:"32px", textAlign:"center" }}>
          <p className="label" style={{ color:"var(--teal)", marginBottom:"8px" }}>STUDIO WORKFLOW · STEP 03</p>
          <h1 className="font-display" style={{ fontSize:"52px", color:"var(--cream)" }}>PRODUCTION LOCK</h1>
          <p style={{ color:"var(--muted)", marginTop:"12px", lineHeight:1.7 }}>
            You are about to lock this creative brief and begin video generation.
            This cannot be undone.
          </p>
        </div>

        {/* Brief summary card */}
        {draft && (
          <div className="card" style={{ padding:"32px", borderTop:"3px solid var(--teal)", marginBottom:"32px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
              {[
                ["TITLE", draft.title],
                ["LOGLINE", draft.logline],
                ["GENRE", draft.genre],
                ["TONE", draft.tone],
                ["STYLE", draft.visual_style],
                ["DURATION", "30s"],
                ["CHARACTER", draft.characters?.[0]?.name],
                ["SCENES", `${draft.scenes?.length || 3} scenes defined`],
                ["MUSIC", draft.music_direction],
              ].map(([k,v]) => (
                <div key={k}>
                  <p className="label" style={{ marginBottom:"2px", color:"var(--muted2)" }}>{k}</p>
                  <p style={{ color:"var(--cream)", fontSize:"13px" }}>{v}</p>
                </div>
              ))}
            </div>
            {/* Palette */}
            {draft.color_palette && (
              <div style={{ marginTop:"20px" }}>
                <p className="label" style={{ marginBottom:"8px", color:"var(--muted2)" }}>COLOR PALETTE</p>
                <div style={{ display:"flex", gap:"6px" }}>
                  {draft.color_palette.map((c: string) => (
                    <div key={c} style={{ width:"32px", height:"16px", background:c, border:"1px solid var(--line2)" }} title={c} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Revision count */}
        <p style={{ color:"var(--muted)", fontSize:"11px", textAlign:"center", marginBottom:"24px", letterSpacing:"1px" }}>
          PROPOSAL ID: {proposalId.slice(0,8).toUpperCase()}
        </p>

        {/* Actions */}
        <div style={{ display:"flex", gap:"16px", justifyContent:"center" }}>
          <button className="btn btn-outline" onClick={() => router.push(`/studio/proposal?id=${proposalId}`)}>
            ← RETURN TO PROPOSAL
          </button>
          <button id="roll-camera-studio-btn" className="btn btn-teal" onClick={handleRollCamera} disabled={locking}>
            {locking ? "LOCKING…" : "🎬 ROLL CAMERA"}
          </button>
        </div>
      </div>
    </main>
  );
}
