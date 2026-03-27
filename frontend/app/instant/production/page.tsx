"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/* ─── Agent definitions ─────────────────────────────────────────────────── */
const AGENTS = [
  { id: "director",   label: "DIRECTOR",       desc: "World Bible · Story architecture",     color: "#c4a35a" },
  { id: "cinemato",   label: "CINEMATOGRAPHER", desc: "Scene prompts · Visual composition",   color: "#5a8fc4" },
  { id: "composer",   label: "COMPOSER",        desc: "Lyria score · BPM orchestration",      color: "#8f5ac4" },
  { id: "continuity", label: "CONTINUITY",      desc: "Embedding drift · Character lock",     color: "#5ac49e" },
];

const STATUS_AGENT: Record<string, string> = {
  planning: "director", ingredients: "cinemato", scenes: "cinemato",
  scoring: "composer",  assembling: "continuity",
};

const STATUS_LABEL: Record<string, string> = {
  pending:     "Initializing…",
  planning:    "Director building World Bible…",
  ingredients: "Generating character references (3 angles in parallel)…",
  scenes:      "Veo 3.1 generating all scenes simultaneously…",
  scoring:     "Lyria 3 composing score…",
  assembling:  "Assembling final teaser…",
  complete:    "TRAILER READY",
  error:       "Error encountered",
};

/* ─── Skeleton Placeholder ──────────────────────────────────────────────── */
function VideoSkeleton({ label }: { label: string }) {
  return (
    <div style={{
      aspectRatio: "9/16", background: "#0d1117", border: "1px solid #1e2430",
      borderRadius: "4px", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "12px", position: "relative",
      overflow: "hidden",
    }}>
      {/* shimmer */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
        animation: "shimmer 1.8s infinite",
      }} />
      <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2px solid #2a3040",
        borderTop: "2px solid #c4a35a", animation: "spin 1s linear infinite" }} />
      <span style={{ fontSize: "10px", letterSpacing: "2px", color: "#4a5060", fontFamily: "DM Mono, monospace" }}>{label}</span>
      <style>{`
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
export default function InstantProductionPage() {
  const params   = useSearchParams();
  const missionId = params.get("id") || "";

  const [mission,    setMission]    = useState<any>(null);
  const [log,        setLog]        = useState<Array<{text: string; time: string}>>([
    { text: "Mission initiated.", time: new Date().toLocaleTimeString() }
  ]);
  const [sceneUrls,  setSceneUrls]  = useState<Record<number, string>>({});
  const [charUrls,   setCharUrls]   = useState<Array<{name: string; url: string}>>([]);
  const [audioUrl,   setAudioUrl]   = useState<string | null>(null);
  const [beatCount,  setBeatCount]  = useState(3);
  const wsRef  = useRef<WebSocket | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const pushLog = (text: string) =>
    setLog(prev => [...prev, { text, time: new Date().toLocaleTimeString() }]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    if (!missionId) return;
    const ws = new WebSocket(`ws://localhost:8000/ws/mission/${missionId}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      switch (msg.type) {
        case "status":
          if (msg.data) {
            setMission(msg.data);
            const label = STATUS_LABEL[msg.data.status] || msg.data.status;
            pushLog(label);
          }
          break;

        case "bible_ready":
          pushLog(`World Bible complete — ${msg.characters} character(s) cast.`);
          if (msg.characters) setBeatCount(3); // always 3 beats
          break;

        case "char_ready":
          pushLog(`Character locked: ${msg.char}`);
          setCharUrls(prev => [...prev, { name: msg.char, url: msg.url }]);
          break;

        case "ingredient_ready":
          // sub-angle images, no log noise
          break;

        case "scene_ready":
          pushLog(`Scene ${msg.index + 1} rendered ✓`);
          setSceneUrls(prev => ({ ...prev, [msg.index]: msg.url }));
          break;

        case "audio_ready":
          pushLog("Music score composed ✓");
          setAudioUrl(msg.url);
          break;

        case "complete":
          setMission(msg.data);
          pushLog("🎬 Trailer assembled — ready for premiere!");
          break;

        case "error":
          pushLog(`⚠ ${msg.msg || (msg.data && msg.data.error_msg) || "unknown error"}`);
          if (msg.data) setMission(msg.data);
          break;
      }
    };

    return () => ws.close();
  }, [missionId]);

  const status      = mission?.status || "pending";
  const activeAgent = STATUS_AGENT[status] || "";
  const isComplete  = status === "complete";
  const isError     = status === "error";

  return (
    <main style={{ minHeight: "100vh", background: "#080b10", color: "#e8e0d0", fontFamily: "DM Mono, monospace", display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ── */}
      <div style={{ borderBottom: "1px solid #1e2430", padding: "14px 32px", display: "flex", alignItems: "center", gap: "16px" }}>
        <a href="/" style={{ textDecoration: "none", color: "#6a7080", fontSize: "11px", letterSpacing: "2px" }}>← AURA DIRECTOR</a>
        <span style={{ color: "#1e2430" }}>|</span>
        <span style={{ fontSize: "11px", letterSpacing: "3px", color: "#c4a35a" }}>PRODUCTION FLOOR</span>
        <span style={{ marginLeft: "auto", fontSize: "11px", color: "#3a4050", letterSpacing: "1.5px" }}>
          {missionId.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", flex: 1 }}>
        {/* ══ Left: main canvas ══════════════════════════════════════════════ */}
        <div style={{ padding: "28px 32px", borderRight: "1px solid #1e2430", overflow: "auto" }}>

          {/* Agent cards 2×2 */}
          <p style={{ fontSize: "9px", letterSpacing: "2.5px", color: "#4a5060", marginBottom: "12px" }}>ACTIVE AGENTS</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "28px" }}>
            {AGENTS.map(a => {
              const active = activeAgent === a.id;
              return (
                <div key={a.id} style={{
                  padding: "16px 18px",
                  background: active ? "#0d1520" : "#0a0d13",
                  border: `1px solid ${active ? a.color + "55" : "#1e2430"}`,
                  borderLeft: `3px solid ${active ? a.color : "#1e2430"}`,
                  borderRadius: "4px", transition: "all 400ms ease",
                  opacity: isComplete ? 1 : active ? 1 : 0.5,
                  boxShadow: active ? `0 0 24px ${a.color}18` : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <div style={{
                      width: "7px", height: "7px", borderRadius: "50%",
                      background: active ? a.color : "#2a3040",
                      boxShadow: active ? `0 0 8px ${a.color}` : "none",
                      animation: active ? "pulse 1.2s infinite" : "none",
                    }} />
                    <span style={{ fontSize: "12px", letterSpacing: "2px", color: active ? a.color : "#6a7080" }}>{a.label}</span>
                  </div>
                  <p style={{ fontSize: "10px", color: "#4a5060" }}>{a.desc}</p>
                  {active && <p style={{ marginTop: "8px", fontSize: "9px", letterSpacing: "1.5px", color: a.color }}>● PROCESSING</p>}
                </div>
              );
            })}
          </div>

          {/* Pipeline status */}
          <div style={{ padding: "18px", background: "#0a0d13", border: "1px solid #1e2430", borderRadius: "4px", marginBottom: "28px" }}>
            <p style={{ fontSize: "9px", letterSpacing: "2px", color: "#4a5060", marginBottom: "6px" }}>PIPELINE STATUS</p>
            <p style={{ fontSize: "20px", letterSpacing: "2px", color: isError ? "#c45a5a" : isComplete ? "#5ac49e" : "#c4a35a" }}>
              {STATUS_LABEL[status] || status.toUpperCase()}
            </p>
            {mission?.error_msg && (
              <p style={{ marginTop: "8px", fontSize: "11px", color: "#c45a5a", lineHeight: 1.5 }}>{mission.error_msg}</p>
            )}
          </div>

          {/* Character reference images */}
          {charUrls.length > 0 && (
            <div style={{ marginBottom: "28px" }}>
              <p style={{ fontSize: "9px", letterSpacing: "2.5px", color: "#4a5060", marginBottom: "12px" }}>CHARACTER REFERENCES</p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {charUrls.map((c, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <img src={c.url} alt={c.name}
                      style={{ width: "80px", height: "110px", objectFit: "cover", borderRadius: "3px",
                        border: "1px solid #5a8fc455", display: "block" }} />
                    <span style={{ fontSize: "9px", color: "#5a8fc4", letterSpacing: "1px", marginTop: "4px", display: "block" }}>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scene grid — shows placeholders + live video as scenes land */}
          <div>
            <p style={{ fontSize: "9px", letterSpacing: "2.5px", color: "#4a5060", marginBottom: "12px" }}>
              SCENES {Object.keys(sceneUrls).length > 0 && `— ${Object.keys(sceneUrls).length}/${beatCount} READY`}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {Array.from({ length: beatCount }, (_, i) => {
                const url = sceneUrls[i];
                return url ? (
                  <div key={i} className="fade-in" style={{ position: "relative" }}>
                    <video src={url} controls autoPlay muted loop playsInline
                      style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover",
                        borderRadius: "4px", border: "1px solid #5ac49e55", display: "block" }} />
                    <div style={{ position: "absolute", top: "8px", left: "8px",
                      background: "#5ac49e", color: "#080b10", fontSize: "9px",
                      letterSpacing: "1.5px", padding: "2px 6px", borderRadius: "2px" }}>
                      SCENE {i + 1}
                    </div>
                  </div>
                ) : (
                  <VideoSkeleton key={i} label={`SCENE ${i + 1}`} />
                );
              })}
            </div>
          </div>

          {/* Audio player when ready */}
          {audioUrl && (
            <div className="fade-in" style={{ marginTop: "20px", padding: "16px", background: "#100a1a",
              border: "1px solid #8f5ac455", borderRadius: "4px" }}>
              <p style={{ fontSize: "9px", letterSpacing: "2px", color: "#8f5ac4", marginBottom: "8px" }}>LYRIA SCORE</p>
              <audio src={audioUrl} controls style={{ width: "100%", height: "32px" }} />
            </div>
          )}

          {/* Final trailer */}
          {isComplete && mission?.final_url && (
            <div className="fade-in" style={{ marginTop: "28px", padding: "32px",
              background: "linear-gradient(135deg, #0d1020, #101820)",
              border: "1px solid #c4a35a", borderRadius: "4px", textAlign: "center" }}>
              <p style={{ fontSize: "32px", letterSpacing: "4px", color: "#c4a35a", marginBottom: "16px" }}>
                🎬 TRAILER READY
              </p>
              <a href={mission.final_url} target="_blank" rel="noopener noreferrer">
                <button id="watch-trailer-btn" style={{
                  background: "#c4a35a", color: "#080b10", border: "none",
                  padding: "12px 28px", fontSize: "12px", letterSpacing: "2.5px",
                  cursor: "pointer", borderRadius: "2px", fontFamily: "DM Mono, monospace",
                }}>
                  WATCH TRAILER →
                </button>
              </a>
            </div>
          )}
        </div>

        {/* ══ Right: dispatch log + thinking ════════════════════════════════ */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <p style={{ fontSize: "9px", letterSpacing: "2px", color: "#4a5060", marginBottom: "12px" }}>AGENT DISPATCH LOG</p>
            <div ref={logRef} style={{ display: "flex", flexDirection: "column", gap: "7px", maxHeight: "380px", overflowY: "auto" }}>
              {log.map((entry, i) => (
                <div key={i} className="fade-in" style={{ display: "flex", gap: "10px", borderLeft: "2px solid #1e2430", paddingLeft: "10px" }}>
                  <span style={{ color: "#3a4050", fontSize: "10px", minWidth: "24px" }}>{String(i+1).padStart(2,"0")}</span>
                  <div>
                    <span style={{ color: "#c0b8a8", fontSize: "11px" }}>{entry.text}</span>
                    <span style={{ color: "#3a4050", fontSize: "9px", display: "block" }}>{entry.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Thinking tokens */}
          {(mission?.thinking_tokens ?? 0) > 0 && (
            <div style={{ padding: "14px", background: "#0a0d13", border: "1px solid #1e2430", borderRadius: "4px" }}>
              <p style={{ fontSize: "9px", letterSpacing: "2px", color: "#4a5060" }}>DIRECTOR THINKING</p>
              <p style={{ color: "#c4a35a", fontSize: "22px", marginTop: "4px" }}>
                {(mission.thinking_tokens).toLocaleString()} <span style={{ fontSize: "12px" }}>tokens</span>
              </p>
            </div>
          )}

          {/* Scene progress mini */}
          {status === "scenes" && (
            <div style={{ padding: "14px", background: "#0a1018", border: "1px solid #5a8fc433", borderRadius: "4px" }}>
              <p style={{ fontSize: "9px", letterSpacing: "2px", color: "#5a8fc4", marginBottom: "10px" }}>VEO 3.1 PARALLEL</p>
              {Array.from({ length: beatCount }, (_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%",
                    background: sceneUrls[i] ? "#5ac49e" : "#c4a35a",
                    boxShadow: sceneUrls[i] ? "0 0 8px #5ac49e" : "0 0 8px #c4a35a",
                    animation: sceneUrls[i] ? "none" : "pulse 1.2s infinite",
                  }} />
                  <span style={{ fontSize: "10px", color: sceneUrls[i] ? "#5ac49e" : "#c4a35a" }}>
                    Scene {i+1} — {sceneUrls[i] ? "✓ DONE" : "Rendering…"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.25;} }
        .fade-in { animation: fadeIn 0.5s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      `}</style>
    </main>
  );
}
