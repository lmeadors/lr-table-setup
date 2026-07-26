# Table Setup

Say how big your room is and how many guests you have, and it works out a table arrangement — round or rectangular tables, packed to fit while respecting each table's required clearance buffer. Add obstacles (pillars, a stage, a bar, doors) by dragging on the diagram, and refine them with exact numbers.

Live: https://lmeadors.github.io/lr-table-setup/

## Running locally

No build step, no dependencies. It uses ES modules, so it needs to be served rather than opened as a bare `file://` page:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html`.

## Changing the starting defaults

The values the form loads with (room size, obstacles, table type, guest count, mode, packing, buffer) live in [defaults.json](defaults.json), in the same shape as the Configuration (JSON) box in the app itself. Edit it directly — no code changes needed. If it's missing or invalid, the app falls back to the values baked into `index.html`'s form fields.

## Starting points

The "Starting point" dropdown above the Configuration box lets you jump straight to a saved layout instead of building one from scratch. It's driven by [presets/manifest.json](presets/manifest.json), a list of `{ id, label, file }` entries — `file` is any config JSON (same shape as `defaults.json`), fetched relative to the site root. To add one, drop a new config file anywhere in the repo and add an entry pointing to it; no code changes needed.

## Embedding and styling

To fit it into another site, see [STYLING.md](STYLING.md) — CSS custom properties for theming, plus iframe and inline embed recipes. Preview built-in themes and copy their CSS at [theme-gallery.html](theme-gallery.html).

See [PLAN.md](PLAN.md) for scope, design decisions, and what's deliberately not built yet.
