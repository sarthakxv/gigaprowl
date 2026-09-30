#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/.playwright/cli.config.json"

# Cursor agent shells often point this at an empty sandbox cache.
if [[ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" || "${PLAYWRIGHT_BROWSERS_PATH}" == *cursor-sandbox-cache* ]]; then
  case "$(uname -s)" in
    Darwin)
      export PLAYWRIGHT_BROWSERS_PATH="${HOME}/Library/Caches/ms-playwright"
      ;;
    *)
      export PLAYWRIGHT_BROWSERS_PATH="${XDG_CACHE_HOME:-$HOME/.cache}/ms-playwright"
      ;;
  esac
fi

args=("$@")
has_config="false"
for arg in "${args[@]+"${args[@]}"}"; do
  case "$arg" in
    --config|--config=*)
      has_config="true"
      ;;
  esac
done

if [[ "$has_config" != "true" && -f "$CONFIG" ]]; then
  injected="false"
  new_args=()
  for arg in "${args[@]+"${args[@]}"}"; do
    new_args+=("$arg")
    if [[ "$injected" != "true" && ( "$arg" == "open" || "$arg" == "attach" ) ]]; then
      new_args+=(--config "$CONFIG")
      injected="true"
    fi
  done
  args=("${new_args[@]+"${new_args[@]}"}")
fi

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
SKILL_PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

if [[ -x "$SKILL_PWCLI" ]]; then
  exec "$SKILL_PWCLI" "${args[@]+"${args[@]}"}"
elif command -v playwright-cli >/dev/null 2>&1; then
  exec playwright-cli "${args[@]+"${args[@]}"}"
else
  exec npx --yes --package @playwright/mcp playwright-cli "${args[@]+"${args[@]}"}"
fi
