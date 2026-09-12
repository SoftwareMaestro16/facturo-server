#!/usr/bin/env bash
# PostToolUse hook: lints and formats only the file that was just touched.
#
# The point is cost. Without it the assistant re-reads files to convince itself
# the edit was fine; with it a deterministic tool answers in a few hundred
# milliseconds, and only when something is actually wrong does any text come
# back into the conversation.
set -uo pipefail

FILE=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)

case "$FILE" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

[ -f "$FILE" ] || exit 0

OUTPUT=$(npx --no-install prettier --write "$FILE" 2>&1 && npx --no-install eslint --fix "$FILE" 2>&1)
STATUS=$?

if [ $STATUS -ne 0 ]; then
  # Exit code 2 feeds stderr back to the assistant as something to fix.
  echo "$OUTPUT" >&2
  exit 2
fi

exit 0
