## Memory & error tracking

This repo tracks its own memory and error log in-repo instead of the global `~/.claude/.../memory/` auto-memory system:
- `MEMORY.md` — durable facts about the user, feedback on working style, project context, and references. Write here instead of the home-directory memory store when working in this repo.
- `ERRORS.md` — defects found in skills/code and notable runtime failures, so they aren't silently rediscovered.
