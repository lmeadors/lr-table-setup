# Table Setup

Browser-based table-layout planner for Legacy Ranch, a Montana wedding/event venue. Core interaction: give it a room size and guest count, it works out a table arrangement (round or rectangular, packed to respect each table's clearance buffer) — auto-arrangement first, with manual adjustment (obstacles, pinning tables in place) layered on top, not a manual drawing tool first.

Live: https://lmeadors.github.io/lr-table-setup/ (GitHub Pages, deploys on push to `main`)

## Stack and constraints

- Vanilla JS ES modules, no build step, no dependencies — except Three.js, loaded via a CDN import map for the 3D Walkthrough only (see `lib/scene3d.js`); nothing else in the app depends on it, and it's not fetched unless that feature is opened.
- Keep it that way — no bundler, no framework, no TypeScript — unless explicitly asked to change it.
- Built to be white-labelable eventually (see PLAN.md), so avoid hardcoding Legacy-Ranch-specific assumptions into the core solver/render code; venue-specific stuff belongs in `defaults.json`/`presets/`, not `lib/`.

## File layout

- `index.html` / `app.js` — form wiring: reads inputs, calls the solver, renders the result, owns the Obstacles table and Configuration (JSON) round-trip.
- `catalog.js` — editable array of table types (shape, dimensions, seats, clearance buffer). Adding a table means adding an entry here, no other code changes.
- `lib/geometry.js` — footprint/collision math (square + hex grid candidate generation, obstacle overlap tests). Obstacle `width`/`depth` is always real physical size; `buffer` (inches) is applied at collision-check time, never baked into stored dimensions.
- `lib/solver.js` — `arrange()`: compact vs. spread packing, auto/square/hex strategy choice, buffer maximization in spread mode.
- `lib/render.js` — SVG diagram rendering (room, obstacles, tables, halos).
- `lib/scene3d-geometry.js` — pure math for the 3D walkthrough (chair placement, collision bodies), feet-based, no Three.js/DOM import; mirrors the `lib/geometry.js` split.
- `lib/scene3d.js` — Three.js first-person walkthrough renderer/controller, dynamically imported only when the 3D Walkthrough button is clicked.
- `defaults.json` — the config the form loads with on page load; same shape as the Configuration (JSON) box.
- `presets/manifest.json` — selectable starting-point configs (the "Starting point" dropdown); entries are `{ id, label, file }`, `file` fetched relative to site root.
- `themes.js` / `theme-gallery.html` — CSS custom property theming for embedding elsewhere; see STYLING.md.
- `PLAN.md` — scope and what's deliberately deferred (arbitrary polygon rooms, image tracing, persistence, multi-tenant branding). Check before assuming a missing feature is an oversight.

## Working notes specific to this repo

- Test changes to `lib/*.js` or `app.js` by actually loading the page in a browser (`python3 -m http.server`), not just `node --check` — the solver/geometry math has produced several real bugs (off-by-one collision tolerances, non-monotonic buffer search, stale grid alignment after pinning) that only showed up empirically.
- Browser caches ES modules aggressively — always hard-refresh (Cmd+Shift+R) after deploying or when testing locally, including after only editing a `lib/*.js` file.
- After pushing, verify the GitHub Pages deploy actually picked up the change (`gh run list -R lmeadors/lr-table-setup --limit 1`, then `curl` the deployed file for the specific changed content) before telling the user it's live.

## Memory & error tracking

This repo tracks its own memory and error log in-repo instead of the global `~/.claude/.../memory/` auto-memory system:
- `MEMORY.md` — durable facts about the user, feedback on working style, project context, and references. Write here instead of the home-directory memory store when working in this repo.
- `ERRORS.md` — defects found in skills/code and notable runtime failures, so they aren't silently rediscovered.
