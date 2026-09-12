#!/usr/bin/env bash
# PreToolUse hook: refuses writes to files that must never be committed, and
# refuses to let a real-looking secret be written into a tracked file.
#
# A secret in git history is not fixable by deleting it later — the key has to
# be rotated. Cheaper to block the write.
set -uo pipefail

PAYLOAD=$(cat)

FILE=$(printf '%s' "$PAYLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)
CONTENT=$(printf '%s' "$PAYLOAD" | python3 -c 'import json,sys; d=json.load(sys.stdin).get("tool_input",{}); print(d.get("content","") or d.get("new_string",""))' 2>/dev/null)

case "$FILE" in
  *.env|*.env.local|*.env.production)
    echo "Refusing to write $FILE. Secrets live in the deploy environment; document the variable in .env.example instead." >&2
    exit 2
    ;;
esac

# A long random-looking assignment in tracked source is almost always a pasted
# credential. .env.example placeholders say change_me and are allowed through.
if printf '%s' "$CONTENT" | grep -Eq '(SECRET|PASSWORD|TOKEN|API_KEY)[[:space:]]*[:=][[:space:]]*.?[A-Za-z0-9/+_-]{24,}'; then
  if ! printf '%s' "$CONTENT" | grep -q 'change_me'; then
    echo "This edit looks like it contains a real secret. Read it from config instead of writing it into $FILE." >&2
    exit 2
  fi
fi

exit 0
