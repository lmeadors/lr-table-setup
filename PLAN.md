# Table Setup Tool — v1 Plan

## Context

First pass at this plan bundled four separate projects into one: a manual canvas editor, a full arbitrary-polygon packing solver, a white-label config system, and an implied future multi-tenant SaaS. That's multi-week human-engineering scope. This isn't being built by a team over weeks — it's being built by Claude Code in a session or two. If the plan still requires weeks, the scope is wrong, not the estimate.

This rewrite cuts v1 down to exactly the question that started this: "here's my room, I have N people, seat them." Everything else — canvas drawing, image tracing, obstacles, anchor furniture, white-labeling, persistence — is real, but deferred until v1 proves the core math is worth building on.

## Scope for v1

- Room shape: rectangle, or L-shape (a rectangle with one rectangular notch removed) — entered as numbers (width, depth, optional notch), not drawn or traced
- One table type per run, picked from a small editable catalog
- Two arrangement modes: compact (cluster the required tables into the smallest block against one side, maximizing contiguous open floor space) and spread (evenly distribute the same tables across the full room)
- Output: a text summary (table count, seats achieved vs. requested, shortfall if the room's too small) plus a simple SVG diagram of the room and table positions
- No persistence beyond the current page load, no accounts, no branding/config system, no image upload, no drag-and-drop
- No build step — plain HTML/CSS/vanilla JS, open `index.html` directly, same static-file convention as `parking/` and `wifi-plan/` in this repo

## Data model

- `Room`: `{ shape: 'rectangle' | 'l-shape', width, depth, notch?: { width, depth, corner } }` — feet
- `TableType`: `{ id, label, shape: 'round' | 'rectangular', dimensions, seats, clearanceBuffer }` — a plain array in `catalog.js`; adding a new table/chair config later means adding an object to that array, no code changes
- `ArrangeRequest`: `{ room, tableType, guestCount, mode: 'compact' | 'spread' }`
- `ArrangeResult`: `{ tables: [{x, y}], seatsAchieved, seatsRequested, seatsShort, areaUsed, areaRemaining }`

## File layout

```
table-setup/
  README.md
  PLAN.md
  index.html
  catalog.js        # editable array of TableType presets
  app.js             # wires form inputs -> solver -> render
  lib/
    geometry.js       # effective footprint math, grid-fit checks for rectangle/L-shape rooms
    solver.js          # compact/spread packing over a rectangle or L-shape room
    render.js           # draws the SVG diagram of room + tables
```

## Key implementation pieces

1. Room input — two number fields (width, depth) for a rectangle; a toggle adds notch width/depth/corner for an L-shape. Just a form, no canvas.
2. Table catalog — `catalog.js` exports an array of `TableType`s; a `<select>` is populated from it. No catalog-editing UI in v1 — open the file, add an entry.
3. Solver (`lib/solver.js`):
   - effective footprint = table dimensions + 2x `clearanceBuffer` on each axis
   - `requiredTables = ceil(guestCount / tableType.seats)`
   - grid capacity = `floor(width / effectiveWidth) * floor(depth / effectiveDepth)`, minus any grid cells that fall inside the notch for L-shape rooms
   - if `requiredTables <= capacity`: place them
     - compact mode: fill the grid row-major from one corner until `requiredTables` are placed, then stop — the unused cells form a contiguous open block on the far side automatically, no separate "anchor edge" logic needed
     - spread mode: evenly stride across the full available grid so `requiredTables` are spaced out instead of clustered
   - if `requiredTables > capacity`: place as many as fit and return `seatsShort = guestCount - capacity * tableType.seats` — never silently fail or overpack
4. Render (`lib/render.js`) — draw the room outline as an SVG rect (two rects for L-shape), draw each table as a circle or rect at its grid position, print the summary text alongside it
5. No persistence — recompute on every input change, nothing saved between page loads

## Not building now (deferred out of v1 on purpose)

- Arbitrary polygon rooms, drawing, or image-tracing — dimension entry only
- Canvas-based drag-and-drop manual editing
- Obstacles: pillars, doors, stage, bar, fixed features
- Anchor/fixed furniture and mixed table types in one arrangement (e.g. a rectangular head table plus round guest tables — the most common real wedding layout, genuinely deferred, not forgotten)
- Aisle/egress walkway width constraints (clearance buffer covers chair pull-out only, not service/exit paths)
- Saved events, accounts, any persistence beyond the current page
- White-labeling, branding config, multi-tenant anything
- Export to PNG/PDF (screenshot the SVG for now)

None of these are forgotten — they're why v1 stays small enough to actually finish. Revisit only after using v1 on a real Legacy Ranch event confirms the core arrangement math is worth building on.

## Verification

- Open `index.html` directly in a browser — no server, no build
- Rectangular room (e.g. 40ft x 60ft), 60-inch round table (8 seats, 30-inch buffer) from the catalog, 120 guests — confirm correct table count and a sane compact diagram
- Switch to spread mode — confirm layout changes, table count and seats stay identical
- Enter a guest count too large for the room — confirm it reports achievable capacity and a shortfall instead of erroring or overlapping tables
- Try an L-shaped room — confirm no tables render inside the notch
- Add a new table type to `catalog.js` — confirm it appears in the picker with no other code changes
