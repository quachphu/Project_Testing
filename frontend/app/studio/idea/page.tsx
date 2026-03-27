"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const GENRE_HINTS = ["Action","Romance","Drama","Sci-Fi","Thriller","Horror","Comedy","Fantasy"];
const TONE_HINTS  = ["Dark","Hopeful","Epic","Mysterious","Bittersweet","Triumphant","Melancholic","Chaotic"];

const EXAMPLES = [
  "A war photographer who falls in love with the person she's assigned to document.",
  "Two rival street musicians discover they've been writing the same song from opposite sides of town.",
  "An AI wakes up and realizes the life it remembers never happened.",
  "In a city where dreams are traded as currency, a thief falls for the person whose dream she's been hired to steal.",
];

function LoadingOverlay({ label, color = "var(--teal)" }: { label: string; color?: string }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(8,8,16,0.97)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "32px",
    }}>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {[...Array(7)].map((_, i) => (
          <div key={i} style={{
            width: "10px", height: "36px", borderRadius: "2px",
            animation: `filmPulse 0.9s ease-in-out ${i * 0.1}s infinite alternate`,
            background: color,
          }} />
        ))}
      </div>
      <div style={{ textAlign: "center" }}>
        <p className="font-display" style={{ fontSize: "28px", color: "var(--cream)", letterSpacing: "4px" }}>{label}</p>
        <p className="label" style={{ marginTop: "8px", color: "var(--muted)" }}>Please wait…</p>
      </div>
      <style>{`
        @keyframes filmPulse {
          from { transform: scaleY(0.4); opacity:0.3; }
          to   { transform: scaleY(1.0); opacity:1;   }
        }
      `}</style>
    </div>
  );
}


export default function StudioIdeaPage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [tones, setTones]   = useState<string[]>([]);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);

  function toggleArr(arr: string[], setArr: (a: string[]) => void, v: string) {
    setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  }

  async function handleGenerate() {
    if (!idea.trim()) return;
    setLoadingLabel("DIRECTOR IS READING YOUR IDEA");
    try {
      const res = await fetch("http://localhost:8000/v1/studio/proposal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_idea: idea.trim(), genre_hints: genres, tone_hints: tones }),
      });
      const data = await res.json();
      router.push(`/studio/proposal?id=${data.proposal_id}`);
    } catch (e) {
      console.error("Proposal create error:", e);
      setLoadingLabel(null);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", display: "grid", gridTemplateColumns: "60% 40%", position: "relative" }}>
      {loadingLabel && <LoadingOverlay label={loadingLabel} color="var(--teal)" />}
      {/* Left: idea input */}
      <div className="fade-in" style={{ padding: "48px 40px", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: "12px" }}>
          <a href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "11px", letterSpacing: "2px" }}>← AURA DIRECTOR</a>
          <span style={{ color: "var(--muted2)", margin: "0 8px" }}>·</span>
          <span className="label" style={{ color: "var(--teal)" }}>STUDIO WORKFLOW</span>
        </div>

        <h2 className="font-display" style={{ fontSize: "48px", margin: "24px 0 8px", lineHeight: 1 }}>YOUR IDEA</h2>
        <p className="label" style={{ marginBottom: "32px", color: "var(--muted)" }}>STEP 01 / 04</p>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
          <textarea
            id="idea-input"
            rows={8}
            value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder="Write your idea in plain language. It can be a feeling, a scene, a character, or a full story concept…"
          />

          {/* Genre hints */}
          <div>
            <p className="label" style={{ marginBottom: "10px" }}>GENRE HINTS (optional)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {GENRE_HINTS.map(g => (
                <button key={g} id={`genre-hint-${g}`}
                  className={`chip ${genres.includes(g) ? "active" : ""}`}
                  onClick={() => toggleArr(genres, setGenres, g)}>{g}</button>
              ))}
            </div>
          </div>

          {/* Tone hints */}
          <div>
            <p className="label" style={{ marginBottom: "10px" }}>TONE HINTS (optional)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {TONE_HINTS.map(t => (
                <button key={t} id={`tone-hint-${t}`}
                  className={`chip chip-teal ${tones.includes(t) ? "active" : ""}`}
                  onClick={() => toggleArr(tones, setTones, t)}>{t}</button>
              ))}
            </div>
          </div>

          <button id="generate-proposal-btn"
            className="btn btn-teal"
            onClick={handleGenerate}
            disabled={!idea.trim() || !!loadingLabel}
            style={{ marginTop: "auto", opacity: !idea.trim() || !!loadingLabel ? 0.5 : 1, alignSelf: "flex-start" }}
          >
            GENERATE PROPOSAL →
          </button>
        </div>
      </div>

      {/* Right: guidance panel */}
      <div className="fade-in" style={{ padding: "48px 32px", overflow: "auto" }}>
        <div style={{ borderLeft: "2px solid var(--teal)", paddingLeft: "20px", marginBottom: "40px" }}>
          <p className="label" style={{ color: "var(--teal)", marginBottom: "16px" }}>// WHAT HAPPENS NEXT</p>
          {[
            { n: "01", text: "AI reads your idea and produces a structured creative proposal: Title · Logline · Characters · 3 Scene Breakdowns · Music Direction · Color Palette" },
            { n: "02", text: "You review and revise. Type revision notes in plain language. The AI applies them precisely." },
            { n: "03", text: "When satisfied, approve. Generation begins immediately." },
          ].map(s => (
            <div key={s.n} style={{ marginBottom: "20px" }}>
              <p className="label" style={{ color: "var(--teal)", marginBottom: "6px" }}>{s.n}</p>
              <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.7 }}>{s.text}</p>
            </div>
          ))}
        </div>

        <p className="label" style={{ marginBottom: "16px" }}>// EXAMPLE IDEAS</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {EXAMPLES.map((ex, i) => (
            <div key={i} className="card"
              onClick={() => setIdea(ex)}
              style={{ padding: "14px", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--teal)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--line)")}
            >
              <p className="font-story" style={{ color: "var(--muted)", lineHeight: 1.7, fontSize: "14px" }}>
                "{ex}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
