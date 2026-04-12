#!/usr/bin/env bash
set -euo pipefail

if command -v pnpm >/dev/null 2>&1; then
  pnpm lint
elif command -v npm >/dev/null 2>&1; then
  npm run lint
else
  echo "No supported package manager found for lint step."
  exit 1
fi
