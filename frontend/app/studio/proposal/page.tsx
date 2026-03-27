"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SceneProposal = {
  scene_index: number; title: string; description: string;
  visual_direction: string; emotional_beat: string; key_image: string;
};
type CharacterProposal = { name: string; role: string; visual_description: string; motivation: string; arc: string; };
type ProposalDraft = {
  title: string; logline: string; visual_style: string; tone: string; genre: string;
  world: string; characters: CharacterProposal[]; scenes: SceneProposal[];
  music_direction: string; color_palette: string[]; production_notes: string;
};

export default function StudioProposalPage() {
  const router = useRouter();
  const params = useSearchParams();
  const proposalId = params.get("id") || "";

  const [draft, setDraft]         = useState<ProposalDraft | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [revision, setRevision]   = useState("");
  const [summary, setSummary]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [histIdx, setHistIdx]     = useState(-1); // -1 = current draft

  useEffect(() => {
    if (!proposalId) return;
    fetch(`http://localhost:8000/v1/studio/proposal/${proposalId}`)
      .then(r => r.json())
      .then(d => {
        if (d.current_draft) setDraft(d.current_draft);
      });
    fetch(`http://localhost:8000/v1/studio/proposal/${proposalId}/history`)
      .then(r => r.json())
      .then(setRevisions);
  }, [proposalId]);

  async function handleRevise() {
    if (!revision.trim()) return;
    setLoading(true);
    setSummary("");
    try {
      const res = await fetch("http://localhost:8000/v1/studio/proposal/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposalId, user_prompt: revision }),
      });
      const data = await res.json();
      setDraft(data.draft);
      setSummary(data.changes_summary || "");
      setRevision("");
      // refresh history
      const hist = await fetch(`http://localhost:8000/v1/studio/proposal/${proposalId}/history`).then(r=>r.json());
      setRevisions(hist);
    } finally {
      setLoading(false);
    }
  }

  function handleApprove() {
    router.push(`/studio/approve?id=${proposalId}`);
  }

  const displayDraft = histIdx >= 0 && revisions[histIdx]?.new_draft
    ? revisions[histIdx].new_draft
    : draft;

  if (!draft) return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <p className="font-display" style={{ fontSize:"32px", color:"var(--teal)" }}>GENERATING PROPOSAL</p>
        <p className="label" style={{ marginTop:"8px" }}>AI is building your creative brief…</p>
      </div>
    </main>
  );

  return (
    <main style={{ minHeight:"100vh", background:"var(--bg)", display:"grid", gridTemplateColumns:"220px 1fr 300px" }}>

      {/* Left: revision history */}
      <div style={{ borderRight:"1px solid var(--line)", padding:"24px 16px", overflow:"auto" }}>
        <p className="label" style={{ marginBottom:"16px" }}>PROPOSAL HISTORY</p>
        <div
          onClick={() => setHistIdx(-1)}
          style={{ padding:"12px", marginBottom:"8px", border:"1px solid var(--line)", cursor:"pointer",
                   borderColor: histIdx === -1 ? "var(--teal)" : "var(--line)", background:"var(--bg2)" }}
        >
          <p className="label" style={{ color:"var(--teal)" }}>CURRENT</p>
          <p style={{ color:"var(--muted)", fontSize:"11px", marginTop:"4px" }}>Draft {revisions.length+1}</p>
        </div>
        {[...revisions].reverse().map((r, i) => (
          <div key={r.revision_id}
            onClick={() => setHistIdx(revisions.length - 1 - i)}
            style={{ padding:"12px", marginBottom:"8px", border:"1px solid var(--line)", cursor:"pointer",
                     borderColor: histIdx === revisions.length-1-i ? "var(--amber)" : "var(--line)", background:"var(--bg2)" }}
          >
            <p className="label">DRAFT {revisions.length - i}</p>
            <p style={{ color:"var(--muted)", fontSize:"11px", marginTop:"4px", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
              {r.user_prompt?.slice(0,30)}…
            </p>
          </div>
        ))}
      </div>

      {/* Center: proposal document */}
      <div style={{ padding:"32px 40px", overflow:"auto", borderRight:"1px solid var(--line)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"8px" }}>
          <a href="/studio/idea" style={{ color:"var(--muted)", textDecoration:"none", fontSize:"11px" }}>← BACK</a>
          <span className="label" style={{ color:"var(--teal)" }}>STUDIO WORKFLOW · STEP 02</span>
        </div>

        {displayDraft && (
          <div className="fade-in">
            {/* Header */}
            <h1 className="font-display" style={{ fontSize:"52px", lineHeight:1, marginBottom:"8px" }}>{displayDraft.title}</h1>
            <p className="font-story" style={{ color:"var(--muted)", fontSize:"15px", marginBottom:"24px" }}>{displayDraft.logline}</p>

            {/* Meta row */}
            <div style={{ display:"flex", gap:"24px", flexWrap:"wrap", marginBottom:"32px", padding:"16px", background:"var(--bg2)", borderLeft:"3px solid var(--teal)" }}>
              {[
                ["GENRE", displayDraft.genre],
                ["TONE", displayDraft.tone],
                ["STYLE", displayDraft.visual_style],
              ].map(([k,v]) => (
                <div key={k}>
                  <p className="label" style={{ marginBottom:"2px" }}>{k}</p>
                  <p style={{ color:"var(--cream)", fontSize:"12px" }}>{v}</p>
                </div>
              ))}
            </div>

            {/* World */}
            <p className="label" style={{ marginBottom:"8px" }}>WORLD</p>
            <p className="font-story" style={{ color:"var(--muted)", fontSize:"14px", lineHeight:1.8, marginBottom:"32px" }}>{displayDraft.world}</p>

            {/* Characters */}
            <p className="label" style={{ marginBottom:"12px" }}>CHARACTERS</p>
            {displayDraft.characters?.map((c: CharacterProposal) => (
              <div key={c.name} className="card" style={{ padding:"20px", marginBottom:"12px", borderLeft:"3px solid var(--amber)" }}>
                <div style={{ display:"flex", gap:"12px", alignItems:"baseline", marginBottom:"8px" }}>
                  <span className="font-display" style={{ fontSize:"20px" }}>{c.name}</span>
                  <span className="label" style={{ color:"var(--amber)" }}>{c.role}</span>
                </div>
                <p style={{ color:"var(--muted)", fontSize:"12px", lineHeight:1.7 }}>{c.visual_description}</p>
                <p style={{ color:"var(--muted2)", fontSize:"11px", marginTop:"8px" }}>Arc: {c.arc}</p>
              </div>
            ))}

            {/* Scenes */}
            <p className="label" style={{ margin:"24px 0 12px" }}>SCENES</p>
            {displayDraft.scenes?.map((s: SceneProposal, i: number) => (
              <details key={i} style={{ marginBottom:"12px" }}>
                <summary style={{ padding:"16px 20px", background:"var(--bg2)", border:"1px solid var(--line)", cursor:"pointer",
                                   borderLeft:"3px solid var(--teal)", display:"flex", gap:"12px", alignItems:"center", listStyle:"none" }}>
                  <span className="label" style={{ color:"var(--teal)" }}>SCENE {s.scene_index+1}</span>
                  <span className="font-display" style={{ fontSize:"18px" }}>{s.title}</span>
                  <span style={{ marginLeft:"auto", color:"var(--muted)", fontSize:"11px" }}>{s.emotional_beat}</span>
                </summary>
                <div style={{ padding:"20px", background:"var(--bg3)", borderLeft:"3px solid var(--teal)", borderBottom:"1px solid var(--line)" }}>
                  <p style={{ color:"var(--cream)", lineHeight:1.8, marginBottom:"12px" }}>{s.description}</p>
                  <p className="label" style={{ marginBottom:"4px" }}>VISUAL DIR.</p>
                  <p style={{ color:"var(--muted)", fontSize:"12px", marginBottom:"12px" }}>{s.visual_direction}</p>
                  <p className="label" style={{ marginBottom:"4px" }}>KEY IMAGE</p>
                  <p className="font-story" style={{ color:"var(--muted)", fontSize:"13px" }}>{s.key_image}</p>
                </div>
              </details>
            ))}

            {/* Music + Palette */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"24px", marginTop:"24px" }}>
              <div>
                <p className="label" style={{ marginBottom:"6px" }}>MUSIC DIRECTION</p>
                <p style={{ color:"var(--muted)", fontSize:"12px" }}>{displayDraft.music_direction}</p>
              </div>
              <div>
                <p className="label" style={{ marginBottom:"6px" }}>COLOR PALETTE</p>
                <div style={{ display:"flex", gap:"6px" }}>
                  {displayDraft.color_palette?.map((c: string) => (
                    <div key={c} style={{ width:"28px", height:"28px", background:c, border:"1px solid var(--line2)" }} title={c} />
                  ))}
                </div>
              </div>
            </div>

            {/* Approve */}
            <div style={{ marginTop:"40px", borderTop:"1px solid var(--line)", paddingTop:"24px", textAlign:"right" }}>
              <button id="approve-generate-btn" className="btn btn-teal" onClick={handleApprove}>
                APPROVE & GENERATE →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: revision panel */}
      <div style={{ padding:"24px", overflow:"auto" }}>
        <p className="label" style={{ marginBottom:"16px", color:"var(--teal)" }}>REVISION PANEL</p>
        <textarea
          id="revision-input"
          rows={6}
          value={revision}
          onChange={e => setRevision(e.target.value)}
          placeholder="Make the protagonist older… Change scene 2 to rain-soaked city at night…"
        />
        <button id="revise-btn" className="btn btn-outline" onClick={handleRevise}
          disabled={!revision.trim() || loading}
          style={{ marginTop:"12px", width:"100%", opacity: !revision.trim() || loading ? 0.5 : 1 }}>
          {loading ? "APPLYING…" : "REVISE →"}
        </button>

        {/* Changes summary */}
        {summary && (
          <div className="fade-in" style={{ marginTop:"20px", padding:"16px", background:"rgba(29,184,150,0.08)", borderLeft:"3px solid var(--teal)" }}>
            <p className="label" style={{ color:"var(--teal)", marginBottom:"8px" }}>CHANGES APPLIED</p>
            <p style={{ color:"var(--cream)", fontSize:"12px", lineHeight:1.7 }}>{summary}</p>
          </div>
        )}

        <div style={{ marginTop:"32px", padding:"16px", background:"var(--bg3)", borderLeft:"2px solid var(--muted2)" }}>
          <p className="label" style={{ marginBottom:"8px", color:"var(--muted)" }}>HOW TO REVISE</p>
          <p style={{ color:"var(--muted)", fontSize:"11px", lineHeight:1.8 }}>
            Type revision notes in plain language.<br/>
            The AI applies only what you request — everything else stays unchanged.
          </p>
        </div>
      </div>
    </main>
  );
}
