---
name: token-budget
description: How this project keeps the cost of an assisted session down — rtk, generated contracts, hooks, narrow agents — and what to do when a session starts burning context. Use when setting up a machine, or when a session feels expensive.
---

# Keeping a session cheap

Two separate things cost tokens: what the assistant **reads**, and what tools
**print back**. This project attacks both.

## 1. rtk — compressing what commands print back

[`rtk`](https://github.com/rtk-ai/rtk) is a CLI proxy that filters and
compresses command output before the assistant sees it. A test run of 155 lines
becomes 3. It claims 60–90% reduction on common development commands and covers
over 100 of them: git, test runners, linters, builds, docker, package managers.

When a command **fails**, rtk keeps the full output and hands back a recall id,
so nothing is lost exactly when detail matters:

```
FAILED: 2/15 tests [full output: rtk recall 3f9c2a81d4e7]
```

### Install

```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
rtk --version
```

Homebrew: `brew install rtk`. Windows: `winget install rtk-ai.rtk`.
The installer verifies a SHA-256 checksum and refuses to install without one.

Behind a proxy that blocks the GitHub API, pin the version instead of letting
the script look it up:

```bash
RTK_VERSION=v0.49.0 sh install.sh
```

### Wire it into Claude Code

From the repository root:

```bash
rtk init          # writes the hook into this project's .claude/settings.json
rtk init -g       # or into the global config, for every project at once
```

The hook rewrites Bash commands before they run: `git status` becomes
`rtk git status`. Restart Claude Code afterwards. Check the effect with
`rtk gain`.

**Do this on your own machine.** The hook records the path to the binary as it
exists there, so the generated block is not something to copy between machines.

### Limits worth knowing

- It only touches the **Bash** tool. The built-in Read, Grep and Glob tools
  bypass it entirely, so it does not help with reading source files.
- Commands that must not be filtered go in `exclude_commands`:

```toml
# ~/.config/rtk/config.toml
[hooks]
exclude_commands = ["curl", "playwright"]

[retriever]
mode = "sqlite"
```

## 2. Generating the contract instead of writing it

The client generates its entire data layer from this server's OpenAPI document.
Nobody writes a request wrapper or copies a response type. That removes the
single largest repetitive writing task in a two-repository product, and with it
the tokens spent producing and reviewing it.

`npm run openapi:export` here, `npm run api:generate` in the client.

## 3. Hooks that answer instead of the assistant checking

`.claude/hooks/post-edit-check.sh` formats and lints the touched file after
every edit. Without it the assistant re-reads files to satisfy itself the edit
landed. A deterministic tool answering in 300ms is far cheaper, and only speaks
up when something is actually wrong.

`.claude/hooks/session-brief.sh` prints the repository's shape at session start.
Otherwise every fresh session spends thousands of tokens rediscovering it, and
occasionally guesses wrong.

## 4. Narrow agents

`.claude/agents/` defines agents with a small tool set and a small brief each.
A security review agent that can only read never loads the machinery for
writing. A model-only agent never opens the controller layer.

## 5. Habits that matter more than tooling

- **Scope the task.** "Add the counterparty endpoint" costs a fraction of
  "improve the counterparty module".
- **Start a fresh session for unrelated work.** Carrying an hour of invoice
  context into a billing change pays for that context on every turn.
- **Point at the file.** Naming `src/modules/invoices/model/invoice-totals.ts`
  is cheaper than describing what it does and letting it be searched for.
- **Keep the rules where they are needed.** `CLAUDE.md` holds the rules; the
  detailed procedures live in these skills and load only when relevant.
