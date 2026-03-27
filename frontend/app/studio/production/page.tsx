"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

// Same Production Floor as Instant Create — mode='studio' shows proposal info panel
const AGENTS = [
  { id: "director",   label: "DIRECTOR",       cls: "agent-director",   desc: "World Bible · Approved proposal" },
  { id: "cinemato",   label: "CINEMATOGRAPHER", cls: "agent-cinemato",   desc: "Scene prompts · Visual composition" },
  { id: "composer",   label: "COMPOSER",        cls: "agent-composer",   desc: "Lyria score · BPM orchestration" },
  { id: "continuity", label: "CONTINUITY",      cls: "agent-continuity", desc: "Embedding drift · Character lock" },
];

const STATUS_MAP: Record<string, string> = {
  pending: "Initializing…",
  planning: "Building World Bible from approved proposal…",
  ingredients: "Generating character references…",
  scene_0: "Rendering Scene 01…",
  scene_1: "Rendering Scene 02…",
  scene_2: "Rendering Scene 03…",
  scoring: "Composing score…",
  assembling: "Final assembly…",
  complete: "TRAILER READY",
  error: "Error encountered",
};

const ACTIVE_AGENT: Record<string, string> = {
  planning:    "director",
  ingredients: "cinemato",
  scene_0:     "cinemato",
  scene_1:     "cinemato",
  scene_2:     "cinemato",
  scoring:     "composer",
  assembling:  "continuity",
};

export default function StudioProductionPage() {
  const params = useSearchParams();
  const missionId = params.get("id") || "";
  const [mission, setMission] = useState<any>(null);
  const [log, setLog] = useState<string[]>(["Studio mission initiated."]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!missionId) return;
    const ws = new WebSocket(`ws://localhost:8000/ws/mission/${missionId}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.data) {
        setMission(msg.data);
        const label = STATUS_MAP[msg.data.status] || msg.data.status;
        setLog(prev => [...prev, label]);
      }
    };
    return () => ws.close();
  }, [missionId]);

  const status = mission?.status || "pending";
  const activeAgent = ACTIVE_AGENT[status] || "";
  const isComplete = status === "complete";
  const isError    = status === "error";

  return (
    <main style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column" }}>
      <div style={{ borderBottom:"1px solid var(--line)", padding:"14px 32px", display:"flex", alignItems:"center", gap:"16px" }}>
        <span className="font-display" style={{ fontSize:"20px", letterSpacing:"3px", color:"var(--cream)" }}>AURA DIRECTOR</span>
        <span style={{ color:"var(--line2)" }}>|</span>
        <span className="label" style={{ color:"var(--teal)" }}>STUDIO PRODUCTION FLOOR</span>
        <span style={{ marginLeft:"auto", fontFamily:"DM Mono", fontSize:"11px", color:"var(--muted)", letterSpacing:"1.5px" }}>
          {missionId.slice(0,8).toUpperCase()}
        </span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", flex:1, gap:0 }}>
        <div style={{ padding:"32px", borderRight:"1px solid var(--line)" }}>
          <p className="label" style={{ marginBottom:"16px" }}>ACTIVE AGENTS</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"32px" }}>
            {AGENTS.map(a => {
              const isActive = activeAgent === a.id;
              return (
                <div key={a.id} className={`card ${a.cls}`}
                  style={{ padding:"20px", borderLeft:`3px solid var(--agent-color)`, transition:"all 300ms ease",
                            opacity: isComplete ? 1 : isActive ? 1 : 0.45 }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
                    <div className="agent-dot" style={{ animation: isActive ? "pulse 1.2s infinite" : "none" }} />
                    <span className="font-display" style={{ fontSize:"16px", color:"var(--cream)", letterSpacing:"2px" }}>{a.label}</span>
                  </div>
                  <p style={{ color:"var(--muted)", fontSize:"11px" }}>{a.desc}</p>
                  {isActive && <p style={{ marginTop:"10px", color:"var(--teal)", fontSize:"11px" }}>● PROCESSING</p>}
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding:"20px", marginBottom:"24px" }}>
            <p className="label" style={{ marginBottom:"8px" }}>PIPELINE STATUS</p>
            <p className="font-display" style={{ fontSize:"22px", color: isError ? "var(--coral)" : isComplete ? "var(--teal)" : "var(--amber)" }}>
              {STATUS_MAP[status] || status.toUpperCase()}
            </p>
          </div>

          {isComplete && mission?.final_url && (
            <div className="fade-in" style={{ marginTop:"24px" }}>
              <div style={{ padding:"32px", background:"var(--bg2)", border:"1px solid var(--teal)", textAlign:"center" }}>
                <p className="font-display" style={{ fontSize:"36px", color:"var(--teal)", marginBottom:"16px" }}>
                  🎬 TRAILER READY
                </p>
                <a href={mission.final_url} target="_blank" rel="noopener noreferrer">
                  <button className="btn btn-teal" id="watch-studio-trailer-btn">WATCH TRAILER →</button>
                </a>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:"24px", overflow:"auto" }}>
          <p className="label" style={{ marginBottom:"16px" }}>DISPATCH LOG</p>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {log.map((entry, i) => (
              <div key={i} style={{ display:"flex", gap:"10px", borderLeft:"2px solid var(--teal)", paddingLeft:"12px" }}>
                <span style={{ color:"var(--muted)", fontSize:"11px", minWidth:"24px" }}>{String(i+1).padStart(2,"0")}</span>
                <span style={{ color:"var(--cream)", fontSize:"12px" }}>{entry}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
      `}</style>
    </main>
  );
}
