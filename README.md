# Table Setup

Say how big your room is and how many guests you have, and it works out a table arrangement — round or rectangular tables, packed to fit while respecting each table's required clearance buffer. Add obstacles (pillars, a stage, a bar, doors) by dragging on the diagram, and refine them with exact numbers.

Live: https://lmeadors.github.io/lr-table-setup/

## Running locally

No build step, no dependencies. It uses ES modules, so it needs to be served rather than opened as a bare `file://` page:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html`.

See [PLAN.md](PLAN.md) for scope, design decisions, and what's deliberately not built yet.
