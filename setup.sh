#!/usr/bin/env bash
set -e

echo "=== HealthSync Setup ==="

# Check prerequisites
command -v python3 >/dev/null 2>&1 || { echo "Error: python3 is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Error: npm is required but not installed."; exit 1; }

echo "Python: $(python3 --version)"
echo "Node:   $(node --version)"
echo "npm:    $(npm --version)"
echo ""

# Backend setup
echo "--- Installing Python dependencies ---"
pip3 install -r requirements.txt

# Frontend setup
echo ""
echo "--- Installing frontend dependencies ---"
cd frontend
npm install
cd ..

echo ""
echo "=== Setup complete ==="
echo ""
echo "To run the backend:  cd backend && python3 -m uvicorn main:app --reload"
echo "To run the frontend: cd frontend && npm run dev"
echo ""
echo "Optional: set ANTHROPIC_API_KEY env var for AI chat features"
echo "Optional: set TAVILY_API_KEY env var for provider routing search"
