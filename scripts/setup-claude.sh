#!/usr/bin/env bash
# One-time setup of the assisted-development toolchain on a developer machine.
#
# Installs rtk, the CLI proxy that compresses command output before an assistant
# reads it, and wires it into this project's Claude Code hooks. See
# .claude/skills/token-budget/SKILL.md for what it does and what it does not.
set -euo pipefail

RTK_PINNED_VERSION="${RTK_VERSION:-v0.49.0}"

if command -v rtk >/dev/null 2>&1; then
  echo "rtk already installed: $(rtk --version)"
else
  echo "Installing rtk ${RTK_PINNED_VERSION}..."
  # The installer verifies a SHA-256 checksum and refuses to proceed without one.
  # The version is pinned rather than looked up, because the lookup goes through
  # the GitHub API and is rate limited.
  curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh \
    | RTK_VERSION="$RTK_PINNED_VERSION" sh
  export PATH="$HOME/.local/bin:$PATH"
fi

echo
echo "Wiring rtk into this project's Claude Code hooks..."
# Writes into .claude/settings.local.json, which is not tracked: the hook records
# the path to the binary as it exists on this machine.
rtk init

echo
echo "Done. Restart Claude Code, then check the effect with: rtk gain"
