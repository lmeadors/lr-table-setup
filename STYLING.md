# Styling Table Setup

All colors and the base font are controlled by CSS custom properties on `:root`, prefixed `--ts-` so they don't collide with your own site's variables. Nothing else about the layout is themeable by design — this keeps theming to "make it match your brand," not a general CSS override surface.

Preview the built-in presets live, and copy their CSS, at [theme-gallery.html](theme-gallery.html).

## Variable reference

| Variable | Controls | Default |
|---|---|---|
| `--ts-font-family` | All text, including labels inside the room diagram | `system-ui, sans-serif` |
| `--ts-body-bg` | Page background | `transparent` |
| `--ts-text-color` | Body text | `#1a1a1a` |
| `--ts-hint-color` | Helper text under the diagram and config box | `#555` |
| `--ts-border-color` | Fieldset and input borders | `#ccc` |
| `--ts-success-color` | "Loaded." message after a successful config import | `#2f7a3f` |
| `--ts-error-color` | Invalid JSON / bad config error message | `#a13d3d` |
| `--ts-room-fill` | Room background inside the diagram | `#f5f5f5` |
| `--ts-room-stroke` | Room outline | `#333` |
| `--ts-diagram-border` | Border around the whole diagram box | `#ddd` |
| `--ts-table-fill` | Table shape color | `#7aa6c2` |
| `--ts-table-stroke` | Table outline | `#2c4a5e` |
| `--ts-table-hover-fill` | Table color on hover (the pin affordance) | `#5c8aa8` |
| `--ts-table-shadow-color` | The buffer halo around each table | `#2c4a5e` |
| `--ts-obstacle-fill` | Obstacle rectangle fill (pillar, stage, bar, door...) | `#d98c8c` |
| `--ts-obstacle-stroke` | Obstacle outline | `#a13d3d` |
| `--ts-obstacle-label-color` | Text label inside an obstacle | `#6b2323` |
| `--ts-obstacle-row-border` | Border around each row in the Obstacles list | `#eee` |

Pinned tables (obstacles created by clicking a table) reuse `--ts-table-fill`/`--ts-table-stroke`, not the obstacle colors, since they represent a table, not a physical obstruction.

## Embedding with a built-in theme (iframe)

Simplest option, zero CSS to write. Point the iframe at `index.html` with a `?theme=` query param:

```html
<iframe
  src="https://lmeadors.github.io/lr-table-setup/index.html?theme=midnight"
  style="width: 100%; height: 900px; border: 0;"
  title="Table layout planner"
></iframe>
```

Built-in theme names: `default`, `midnight`, `blush`, `slate` (see the gallery for what each looks like). The iframe is a separate document, so your page's own CSS can't reach inside it — this is the tradeoff for the isolation an iframe gives you.

## Embedding inline (matches your page's CSS cascade)

Copy the tool's files into your site and set the variables in your own stylesheet before the tool's markup loads:

```css
:root {
  --ts-font-family: "Your Brand Font", sans-serif;
  --ts-table-fill: #2a6b5e;
  --ts-table-stroke: #123c33;
  /* ...override only what you need; anything unset keeps its default */
}
```

You don't need to use a preset at all — override any subset of the 17 variables directly. The theme gallery's presets are just a convenient starting point, not the only way to theme it.

## What isn't themeable

Layout (spacing, fieldset arrangement, diagram sizing) and the SVG halo's blur radius are fixed — they're mechanical/functional, not brand-specific. If you need to change those, you're forking the CSS directly rather than theming through variables.
