# Table Setup Tool — v1 Plan

## Context

First pass at this plan bundled four separate projects into one: a manual canvas editor, a full arbitrary-polygon packing solver, a white-label config system, and an implied future multi-tenant SaaS. That's multi-week human-engineering scope. This isn't being built by a team over weeks — it's being built by Claude Code in a session or two. If the plan still requires weeks, the scope is wrong, not the estimate.

This rewrite cuts v1 down to exactly the question that started this: "here's my room, I have N people, seat them." Everything else — canvas drawing, image tracing, obstacles, anchor furniture, white-labeling, persistence — is real, but deferred until v1 proves the core math is worth building on.

v1 shipped, then evolved past its original scope through use: hex packing for round tables (auto-selected against square, since hex isn't universally denser), and obstacles (pillars, stage, bar, doors — drag-to-place on the diagram, refine by number) which subsumed and replaced the original L-shape/notch room concept entirely. An L-shape is now just a rectangle room with one obstacle in a corner. Hosted free and public on GitHub Pages: https://lmeadors.github.io/lr-table-setup/

## Scope for v1

- Room shape: rectangle only, entered as numbers (width, depth) — no drawing or tracing
- Obstacles: any number of rectangular exclusion zones (pillar, stage, bar, door, etc.), placed by dragging on the diagram and refined with exact x/y/width/depth/label fields
- One table type per run, picked from a small editable catalog
- Two arrangement modes: compact (cluster the required tables into the smallest block against one side, maximizing contiguous open floor space) and spread (evenly distribute the same tables across the full room)
- For round tables, packing is auto-selected between square and hex grids (whichever fits more), with a manual override
- Output: a text summary (table count, seats achieved vs. requested, shortfall if the room's too small) plus a simple SVG diagram of the room, obstacles, and table positions
- No persistence beyond the current page load, no accounts, no branding/config system, no image upload
- No build step — plain HTML/CSS/vanilla JS, same static-file convention as `parking/` and `wifi-plan/` in the legacy-ranch repo this was extracted from

## Data model

- `Room`: `{ width, depth, obstacles: [{ x, y, width, depth, label }] }` — feet
- `TableType`: `{ id, label, shape: 'round' | 'rectangular', dimensions, seats, clearanceBuffer }` — a plain array in `catalog.js`; adding a new table/chair config later means adding an object to that array, no code changes
- `ArrangeRequest`: `{ room, tableType, guestCount, mode: 'compact' | 'spread', packing: 'auto' | 'square' | 'hex' }`
- `ArrangeResult`: `{ tables: [{x, y}], seatsAchieved, seatsRequested, seatsShort, footprint, tableCount }`

## File layout

```
table-setup/
  README.md
  PLAN.md
  index.html
  catalog.js        # editable array of TableType presets
  app.js             # wires form inputs -> solver -> render
  lib/
    geometry.js       # effective footprint math, square/hex grid-fit checks against room + obstacles
    solver.js          # compact/spread packing, auto/square/hex packing choice
    render.js           # draws the SVG diagram of room, obstacles, tables, drag preview
```

## Key implementation pieces

1. Room input — two number fields (width, depth). Just a form, no canvas.
2. Obstacles — drag on the SVG diagram (real `PointerEvent`s, works for mouse/touch/pen) to rough in a rectangle; it's added to an `obstacles` list with numeric x/y/width/depth/label fields shown below for exact refinement or removal. A "+ Add obstacle" button covers keyboard-only entry.
3. Table catalog — `catalog.js` exports an array of `TableType`s; a `<select>` is populated from it. No catalog-editing UI — open the file, add an entry.
4. Solver (`lib/solver.js`):
   - effective footprint = table dimensions + 2x `clearanceBuffer` on each axis
   - `requiredTables = ceil(guestCount / tableType.seats)`
   - candidate positions come from `geometry.js`'s `squareGridCells` or `hexGridCells`, both of which exclude any cell overlapping the room boundary or any obstacle rectangle
   - for round tables, `packing: 'auto'` computes both square and hex candidate sets and keeps whichever has more valid positions — hex is only denser when the room has leftover slack the tighter row spacing can use; a room whose dimensions divide evenly by the table's effective footprint gets zero benefit from hex, so "always use hex" would be wrong
   - compact mode: take the first `requiredTables` candidates (row-major, so unused cells form a contiguous open block automatically); spread mode: evenly stride across all candidates
   - if `requiredTables > capacity`: place as many as fit and return `seatsShort = guestCount - capacity * tableType.seats` — never silently fail or overpack
5. Render (`lib/render.js`) — draw the room outline as a plain SVG rect, each obstacle as a labeled rect, each table as a circle or rect; also draws a dashed preview rect during an in-progress obstacle drag
6. No persistence — recompute on every input change, nothing saved between page loads

## Not building now (deferred out of v1 on purpose)

- Arbitrary polygon rooms, drawing, or image-tracing — dimension entry only (obstacles cover irregular room shapes now)
- Dragging to move/resize an *existing* obstacle or table — only initial placement is drag-based; adjustments are numeric
- Circular/non-rectangular obstacles — a rectangle is a safe bounding-box approximation of a round pillar
- Anchor/fixed furniture and mixed table types in one arrangement (e.g. a rectangular head table plus round guest tables — the most common real wedding layout, genuinely deferred, not forgotten)
- Aisle/egress walkway width constraints (clearance buffer covers chair pull-out only, not service/exit paths)
- Saved events, accounts, any persistence beyond the current page
- White-labeling, branding config, multi-tenant anything
- Export to PNG/PDF (screenshot the SVG for now)

## Verification

- Rectangular room (e.g. 40ft x 60ft), 60-inch round table (8 seats, 30-inch buffer) from the catalog, 120 guests — confirm correct table count and a sane compact diagram
- Switch to spread mode — confirm layout changes, table count and seats stay identical
- Enter a guest count too large for the room — confirm it reports achievable capacity and a shortfall instead of erroring or overlapping tables
- Force hex packing on a room whose dimensions divide evenly by the table footprint — confirm it's allowed to (and does) fit *fewer* tables than square, since auto should have picked square there
- Drag an obstacle onto the diagram — confirm no table renders inside it, room area drops accordingly, and the numeric row lets you refine or remove it
- Add a new table type to `catalog.js` — confirm it appears in the picker with no other code changes
