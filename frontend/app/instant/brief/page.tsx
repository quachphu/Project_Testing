"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const STYLES = [
  { id: "Anime",      emoji: "⛩", desc: "Expressive · Cel-shading · Dynamic" },
  { id: "Real Life",  emoji: "🎬", desc: "Cinematic · Film grain · Anamorphic" },
  { id: "Cartoon",    emoji: "💥", desc: "Bold · Saturated · Spider-Verse" },
  { id: "Video Game", emoji: "🎮", desc: "In-engine · Hero framing · Epic" },
  { id: "Cinematic",  emoji: "🎥", desc: "Hollywood · Shallow DOF · Graded" },
  { id: "Pixel Art",  emoji: "👾", desc: "16-bit · Retro · Chiptune" },
  { id: "Ghibli",     emoji: "🌿", desc: "Hand-painted · Soft light · Lush" },
  { id: "Superhero",  emoji: "⚡", desc: "Bold · Dynamic · MCU-scale" },
];
const GENRES = ["Action","Romance","Comedy","Thriller","Drama","Horror","Sci-Fi","Fantasy"];
const BLENDS = [
  "Action × Romance","Comedy × Action","Romance × Drama","Horror × Romance",
  "Sci-Fi × Drama","Comedy × Romance","Thriller × Sci-Fi","Fantasy × Comedy",
];
const TONES = ["Hopeful","Dark","Bittersweet","Triumphant","Melancholic","Chaotic","Mysterious","Epic"];
const EXAMPLE_STORIES = [
  "A bounty hunter and her target fall in love during a 48-hour high-stakes chase across a neon-lit city.",
  "Two rival street musicians discover they've been writing the same song from opposite sides of town.",
  "A war photographer who falls in love with the person she's assigned to document.",
  "In a world where memory can be erased, a detective falls for someone who has forgotten him.",
  "An astronaut returning from a 10-year mission finds Earth has moved on — and so has everyone she loved.",
];

/* ── Cinematic loading overlay ─────────────────────────────────────────────── */
function LoadingOverlay({ label }: { label: string }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(8,8,16,0.97)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "32px",
    }}>
      {/* Film strip spinner */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {[...Array(7)].map((_, i) => (
          <div key={i} style={{
            width: "10px", height: "36px",
            background: "var(--amber)",
            borderRadius: "2px",
            animation: `filmPulse 0.9s ease-in-out ${i * 0.1}s infinite alternate`,
          }} />
        ))}
      </div>
      <div style={{ textAlign: "center" }}>
        <p className="font-display" style={{ fontSize: "28px", color: "var(--cream)", letterSpacing: "4px" }}>
          {label}
        </p>
        <p className="label" style={{ marginTop: "8px", color: "var(--muted)" }}>
          Please wait…
        </p>
      </div>
      <style>{`
        @keyframes filmPulse {
          from { transform: scaleY(0.4); opacity:0.3; background: var(--muted2); }
          to   { transform: scaleY(1.0); opacity:1;   background: var(--amber); }
        }
      `}</style>
    </div>
  );
}

export default function InstantBriefPage() {
  const router = useRouter();
  const [act, setAct] = useState<1 | 2 | 3>(1);
  const [style, setStyle] = useState("");
  const [genre, setGenre] = useState("");
  const [tone, setTone] = useState("Hopeful");
  const [story, setStory] = useState("");
  const [duration, setDuration] = useState(30);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);

  function goToAct(n: 1 | 2 | 3, label: string) {
    setLoadingLabel(label);
    setTimeout(() => { setAct(n); setLoadingLabel(null); }, 600);
  }

  const beats = story.trim().length > 10
    ? [
        { label: "ACT I", hint: "Setup & world" },
        { label: "ACT II", hint: "Rising tension" },
        { label: "ACT III", hint: "Climax & release" },
      ]
    : null;

  const [apiError, setApiError] = useState<string | null>(null);

  async function handleRollCamera() {
    if (!style || !genre || !story.trim()) return;
    setApiError(null);
    setLoadingLabel("INITIATING PIPELINE");
    try {
      const res = await fetch("http://localhost:8000/v1/instant/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, genre, tone, story: story.trim(), duration }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(`Backend error: ${data.detail || res.statusText}`);
        setLoadingLabel(null);
        return;
      }
      if (!data.mission_id) {
        setApiError("No mission ID returned — check backend logs.");
        setLoadingLabel(null);
        return;
      }
      router.push(`/instant/production?id=${data.mission_id}`);
    } catch (e) {
      console.error("Pipeline init error:", e);
      setApiError("Cannot reach backend at localhost:8000. Is it running?");
      setLoadingLabel(null);
    }
  }

  return (
    <main className="fade-in" style={{ minHeight: "100vh", background: "var(--bg)", padding: "0" }}>
      {loadingLabel && <LoadingOverlay label={loadingLabel} />}
      {/* Error toast */}
      {apiError && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          zIndex: 9998, background: "#2a0a0a", border: "1px solid #c0392b",
          color: "#e74c3c", padding: "14px 24px", borderRadius: "4px",
          fontFamily: "DM Mono, monospace", fontSize: "12px", maxWidth: "500px",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span>⚠</span>
          <span>{apiError}</span>
          <button onClick={() => setApiError(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: "16px" }}>×</button>
        </div>
      )}
      {/* Top bar */}
      <div style={{ borderBottom: "1px solid var(--line)", padding: "16px 32px", display: "flex", alignItems: "center", gap: "24px" }}>
        <a href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "11px", letterSpacing: "2px" }}>← AURA DIRECTOR</a>
        <span className="label" style={{ color: "var(--amber)" }}>INSTANT CREATE</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          {[1,2,3].map(n => (
            <button key={n} onClick={() => setAct(n as 1|2|3)}
              style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: act === n ? "var(--amber)" : "var(--bg3)",
                border: "1px solid var(--line2)",
                color: act === n ? "#080810" : "var(--muted)",
                cursor: "pointer", fontFamily: "DM Mono", fontSize: "11px",
              }}
            >{n}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>

        {/* ACT 1 — Style */}
        {act === 1 && (
          <div className="fade-in">
            <p className="label" style={{ color: "var(--amber)", marginBottom: "8px" }}>ACT I</p>
            <h2 className="font-display" style={{ fontSize: "48px", marginBottom: "32px" }}>CHOOSE YOUR VISUAL STYLE</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
              {STYLES.map(s => (
                <div key={s.id} id={`style-${s.id.replace(" ","_")}`}
                  className={`card ${style === s.id ? "card-selected" : ""}`}
                  onClick={() => setStyle(s.id)}
                  style={{ padding: "32px 20px", cursor: "pointer", textAlign: "center", position: "relative" }}
                >
                  {style === s.id && (
                    <div style={{ position: "absolute", top: "10px", right: "10px", color: "var(--amber)", fontSize: "16px" }}>✓</div>
                  )}
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>{s.emoji}</div>
                  <div className="font-display" style={{ fontSize: "20px", marginBottom: "8px" }}>{s.id}</div>
                  <div style={{ color: "var(--muted)", fontSize: "11px" }}>{s.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "32px", textAlign: "right" }}>
              <button className="btn btn-amber"
                onClick={() => style && goToAct(2, "LOADING GENRE & TONE")}
                disabled={!style} id="act1-next">
                NEXT: GENRE →
              </button>
            </div>
          </div>
        )}

        {/* ACT 2 — Genre + Tone */}
        {act === 2 && (
          <div className="fade-in">
            <p className="label" style={{ color: "var(--amber)", marginBottom: "8px" }}>ACT II</p>
            <h2 className="font-display" style={{ fontSize: "48px", marginBottom: "32px" }}>GENRE & TONE</h2>

            <p className="label" style={{ marginBottom: "12px" }}>Genres</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
              {GENRES.map(g => (
                <button key={g} id={`genre-${g}`} className={`chip ${genre === g ? "active" : ""}`}
                  onClick={() => setGenre(g)}>{g}</button>
              ))}
            </div>

            <p className="label" style={{ marginBottom: "12px" }}>Blends</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "32px" }}>
              {BLENDS.map(g => (
                <button key={g} id={`genre-blend-${g.replace(" × ","x")}`}
                  className={`chip ${genre === g ? "active" : ""}`}
                  onClick={() => setGenre(g)}>{g}</button>
              ))}
            </div>

            <p className="label" style={{ marginBottom: "12px" }}>Tone</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "32px" }}>
              {TONES.map(t => (
                <button key={t} id={`tone-${t}`} className={`chip chip-teal ${tone === t ? "active" : ""}`}
                  onClick={() => setTone(t)}>{t}</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", alignItems: "center" }}>
              <button className="btn btn-outline" onClick={() => goToAct(1, "RETURNING TO STYLE")}>← BACK</button>
              <button className="btn btn-amber"
                onClick={() => genre && goToAct(3, "LOADING STORY CANVAS")}
                disabled={!genre} id="act2-next">
                NEXT: YOUR STORY →
              </button>
            </div>
          </div>
        )}

        {/* ACT 3 — Story */}
        {act === 3 && (
          <div className="fade-in">
            <p className="label" style={{ color: "var(--amber)", marginBottom: "8px" }}>ACT III</p>
            <h2 className="font-display" style={{ fontSize: "48px", marginBottom: "32px" }}>YOUR STORY SPARK</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "32px" }}>
              {/* Left: story canvas */}
              <div>
                <textarea
                  id="story-input"
                  rows={7}
                  value={story}
                  onChange={e => setStory(e.target.value.slice(0, 400))}
                  placeholder="Write your story spark in plain language. A feeling, a scene, a character, or a full concept…"
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                  <span className="label">{story.length}/400</span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span className="label">DURATION</span>
                    {[20, 30].map(d => (
                      <button key={d} id={`duration-${d}`}
                        className={`chip ${duration === d ? "active" : ""}`}
                        onClick={() => setDuration(d)}>{d}s</button>
                    ))}
                  </div>
                </div>

                {/* 3-beat preview */}
                {beats && (
                  <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    {beats.map(b => (
                      <div key={b.label} className="card" style={{ padding: "16px", borderTop: "2px solid var(--amber)" }}>
                        <p className="label" style={{ color: "var(--amber)", marginBottom: "4px" }}>{b.label}</p>
                        <p style={{ color: "var(--muted)", fontSize: "12px" }}>{b.hint}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: examples */}
              <div>
                <p className="label" style={{ marginBottom: "16px" }}>EXAMPLE SPARKS</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {EXAMPLE_STORIES.map((ex, i) => (
                    <div key={i}
                      onClick={() => setStory(ex)}
                      style={{
                        padding: "14px", border: "1px solid var(--line)", cursor: "pointer",
                        color: "var(--muted)", fontSize: "12px", lineHeight: 1.6,
                        fontFamily: "Playfair Display, serif", fontStyle: "italic",
                        transition: "border-color 200ms",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--amber)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--line)")}
                    >
                      "{ex}"
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", alignItems: "center", marginTop: "32px" }}>
              <button className="btn btn-outline" onClick={() => goToAct(2, "RETURNING TO GENRE")}>← BACK</button>
              <button
                id="roll-camera-btn"
                className="btn btn-amber"
                onClick={handleRollCamera}
                disabled={!story.trim() || !!loadingLabel}
                style={{ opacity: !story.trim() || !!loadingLabel ? 0.5 : 1 }}
              >
                🎬 ROLL CAMERA
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
