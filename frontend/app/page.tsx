"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main
      className="fade-in"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "var(--bg)",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "64px" }}>
        <h1
          className="font-display"
          style={{ fontSize: "clamp(48px, 8vw, 96px)", color: "var(--cream)", lineHeight: 1 }}
        >
          AURA DIRECTOR
        </h1>
        <p className="label" style={{ marginTop: "12px", letterSpacing: "4px" }}>
          Cinematic Visualization Platform
        </p>
        <p
          style={{
            marginTop: "16px",
            color: "var(--muted)",
            maxWidth: "480px",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          Turn story ideas into 20–30 second cinematic teaser videos.
          AI as a pre-production tool — not a film replacement.
        </p>
      </div>

      {/* Mode Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "24px",
          maxWidth: "760px",
          width: "100%",
        }}
      >
        {/* Instant Create */}
        <div
          className="card"
          style={{
            padding: "40px 32px",
            borderTop: "3px solid var(--amber)",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div>
            <p className="label" style={{ color: "var(--amber)", marginBottom: "8px" }}>
              MODE 01
            </p>
            <h2 className="font-display" style={{ fontSize: "36px", color: "var(--cream)", letterSpacing: "2px" }}>
              INSTANT CREATE
            </h2>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.8 }}>
            Idea → Video in minutes. Pick your style, genre, and story — the AI handles the rest.
          </p>
          <div style={{ color: "var(--muted)", fontSize: "11px", letterSpacing: "1px" }}>
            <p>✦ Style + Genre picker</p>
            <p>✦ Story spark input</p>
            <p>✦ Auto generation pipeline</p>
          </div>
          <p className="label" style={{ color: "var(--muted2)" }}>For creators who want speed.</p>
          <Link href="/instant/brief" id="btn-instant">
            <button className="btn btn-amber" style={{ width: "100%" }}>
              START NOW →
            </button>
          </Link>
        </div>

        {/* Studio Workflow */}
        <div
          className="card"
          style={{
            padding: "40px 32px",
            borderTop: "3px solid var(--teal)",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div>
            <p className="label" style={{ color: "var(--teal)", marginBottom: "8px" }}>
              MODE 02
            </p>
            <h2 className="font-display" style={{ fontSize: "36px", color: "var(--cream)", letterSpacing: "2px" }}>
              STUDIO WORKFLOW
            </h2>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.8 }}>
            Deliberate pre-production. Review and revise the AI&apos;s proposal collaboratively before generating.
          </p>
          <div style={{ color: "var(--muted)", fontSize: "11px", letterSpacing: "1px" }}>
            <p>✦ Structured creative proposal</p>
            <p>✦ Revision loop with AI</p>
            <p>✦ Approval-gated generation</p>
          </div>
          <p className="label" style={{ color: "var(--muted2)" }}>For filmmakers who want craft.</p>
          <Link href="/studio/idea" id="btn-studio">
            <button className="btn btn-teal" style={{ width: "100%" }}>
              OPEN STUDIO →
            </button>
          </Link>
        </div>
      </div>

      {/* Footer note */}
      <p className="label" style={{ marginTop: "64px", color: "var(--muted2)", textAlign: "center" }}>
        Gemini · Veo · Lyria · Imagen — LA Hackathon 2026 · UCLA
      </p>
    </main>
  );
}
