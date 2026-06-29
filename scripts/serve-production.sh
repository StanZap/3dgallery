#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

exec uv run python -m backend.app --host 0.0.0.0 --port 8000 --build-frontend "$@"
