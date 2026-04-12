#!/usr/bin/env bash
set -euo pipefail

if command -v pnpm >/dev/null 2>&1; then
  pnpm test
elif command -v npm >/dev/null 2>&1; then
  npm test
else
  echo "No supported package manager found for test step."
  exit 1
fi
