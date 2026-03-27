#!/usr/bin/env bash
# AuraDirector — One-command startup
# Usage: ./start.sh
# Note: do NOT use set -e here — fuser returns 1 when no process is on the port,
# which would kill the script prematurely.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$ROOT/backend/.venv"

echo ""
echo "  ██████████████████████████████████████"
echo "  ██  AURA DIRECTOR — STARTUP SCRIPT  ██"
echo "  ██████████████████████████████████████"
echo ""

# ── 1. Python virtual environment ────────────────────────────────────────────
# Use python3.11 — pydantic-core / Pillow have pre-built wheels for 3.11,
# but NOT for 3.14 (PyO3 Rust extension max supported version is 3.13).
PYTHON_BIN="python3.11"

if [ -d "$VENV" ]; then
  VENV_PY=$("$VENV/bin/python" --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
  if [[ "$VENV_PY" != "3.11" ]]; then
    echo "  [1/3] Incompatible venv (Python $VENV_PY) — recreating with Python 3.11..."
    rm -rf "$VENV"
  else
    echo "  [1/3] venv (Python 3.11) OK — skipping creation."
  fi
fi

if [ ! -d "$VENV" ]; then
  echo "  [1/3] Creating Python 3.11 virtual environment..."
  "$PYTHON_BIN" -m venv "$VENV"
  echo "        ✓ venv created at backend/.venv"
fi

echo "  [2/3] Installing Python dependencies (first run only — may take ~2 min)..."
"$VENV/bin/pip" install --upgrade pip
"$VENV/bin/pip" install -r "$ROOT/backend/requirements.txt"
echo "        ✓ Dependencies installed."

# ── 2. Frontend deps ──────────────────────────────────────────────────────────
echo "  [3/3] Checking frontend dependencies..."
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "        Installing npm packages..."
  cd "$ROOT/frontend" && npm install --silent
  echo "        ✓ npm packages installed."
else
  echo "        ✓ node_modules already present."
fi

# ── Clear ports BEFORE launching ─────────────────────────────────────────────
echo "  Clearing ports 8000 and 3000..."
fuser -k 8000/tcp 2>/dev/null && echo "  ⚠ Cleared stale process on :8000" || true
fuser -k 3000/tcp 2>/dev/null && echo "  ⚠ Cleared stale process on :3000" || true
sleep 1

echo ""
echo "  ─────────────────────────────────────────────────"
echo "  Starting servers..."
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:3000"
echo "  ─────────────────────────────────────────────────"
echo "  Press Ctrl+C to stop both servers."
echo ""

# ── 3. Launch both in parallel ────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "  Shutting down…"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# Backend
cd "$ROOT/backend"
"$VENV/bin/uvicorn" main:app --reload --port 8000 &
BACKEND_PID=$!

# Frontend
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

wait
