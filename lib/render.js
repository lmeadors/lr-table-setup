const MAX_WIDTH_PX = 700;
const MAX_HEIGHT_PX = 500;

export function computeScale(room) {
  const roomWidthIn = room.width * 12;
  const roomDepthIn = room.depth * 12;
  return Math.min(MAX_WIDTH_PX / roomWidthIn, MAX_HEIGHT_PX / roomDepthIn);
}

export function renderDiagram(container, room, tableType, result, previewObstacle) {
  const scale = computeScale(room);
  const svgWidth = room.width * 12 * scale;
  const svgHeight = room.depth * 12 * scale;

  const roomOutline = `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" class="room-outline" />`;
  const obstacleShapes = (room.obstacles || [])
    .map((o) => obstacleMarkup(o, scale))
    .join('');
  const previewShape = previewObstacle ? obstacleMarkup(previewObstacle, scale, true) : '';

  let shadowFilter = '';
  let tableShadows = '';
  let tableShapes = '';
  if (result && tableType) {
    // Always the catalog's own clearance for this table type - a fixed
    // reference guide, not whatever buffer was actually used to place these
    // tables (spread mode's maximized spacing, or a user override). That way
    // the halo shows how the layout compares to the recommended spacing:
    // overlapping halos mean tighter-than-recommended, a visible gap beyond
    // them means looser. A loose Gaussian blur is fine here - it's a guide,
    // not a precise boundary.
    const bufferPx = tableType.clearanceBuffer * scale;

    if (bufferPx > 0) {
      const stdDev = Math.max(0.5, bufferPx / 2.5);
      shadowFilter = `<filter id="buffer-shadow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="${stdDev.toFixed(2)}" /></filter>`;
      tableShadows = result.tables.map((t) => tableShadowMarkup(t, tableType, bufferPx, scale)).join('');
    }
    tableShapes = result.tables.map((t) => tableMarkup(t, tableType, scale)).join('');
  }

  container.innerHTML = `
    <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
      <defs>${shadowFilter}</defs>
      ${roomOutline}
      ${tableShadows}
      ${obstacleShapes}
      ${tableShapes}
      ${previewShape}
    </svg>
  `;
}

function tableShadowMarkup(table, tableType, bufferPx, scale) {
  const x = table.x * scale;
  const y = table.y * scale;

  if (tableType.shape === 'round') {
    const r = (tableType.dimensions.diameter / 2) * scale + bufferPx;
    return `<circle cx="${x}" cy="${y}" r="${r}" class="table-shadow" filter="url(#buffer-shadow)" />`;
  }

  const w = tableType.dimensions.width * scale + bufferPx * 2;
  const h = tableType.dimensions.depth * scale + bufferPx * 2;
  return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${bufferPx}" ry="${bufferPx}" class="table-shadow" filter="url(#buffer-shadow)" />`;
}

function obstacleMarkup(obstacle, scale, isPreview = false) {
  const pinned = !isPreview && obstacle.seats;
  if (pinned && obstacle.tableWidth && obstacle.tableDepth) {
    return pinnedTableMarkup(obstacle, scale);
  }

  const x = obstacle.x * 12 * scale;
  const y = obstacle.y * 12 * scale;
  const w = obstacle.width * 12 * scale;
  const h = obstacle.depth * 12 * scale;
  const cls = isPreview ? 'obstacle obstacle-preview' : 'obstacle';
  const label = !isPreview && obstacle.label
    ? `<text x="${x + w / 2}" y="${y + h / 2}" class="obstacle-label" text-anchor="middle" dominant-baseline="middle">${escapeXml(obstacle.label)}</text>`
    : '';

  if (obstacle.shape === 'round') {
    return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}" class="${cls}" />${label}`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}" />${label}`;
}

// A pinned table's obstacle.width/depth is its full buffered footprint (what
// actually needs to stay clear for collision purposes), but rendering that
// footprint as one solid shape makes it look like it blocks far more room
// than a real table does. Auto-placed tables get a small solid shape plus a
// soft fading halo for the buffer; a pinned table should look the same way,
// not like one big solid blob the size of the whole exclusion zone.
function pinnedTableMarkup(obstacle, scale) {
  const x = obstacle.x * 12 * scale;
  const y = obstacle.y * 12 * scale;
  const w = obstacle.width * 12 * scale;
  const h = obstacle.depth * 12 * scale;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tw = obstacle.tableWidth * 12 * scale;
  const td = obstacle.tableDepth * 12 * scale;

  if (obstacle.shape === 'round') {
    const halo = `<circle cx="${cx}" cy="${cy}" r="${w / 2}" class="table-shadow" filter="url(#buffer-shadow)" />`;
    const shape = `<circle cx="${cx}" cy="${cy}" r="${tw / 2}" class="obstacle-pinned-table" />`;
    return halo + shape;
  }

  const bufferPx = (w - tw) / 2;
  const halo = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${bufferPx}" ry="${bufferPx}" class="table-shadow" filter="url(#buffer-shadow)" />`;
  const shape = `<rect x="${cx - tw / 2}" y="${cy - td / 2}" width="${tw}" height="${td}" class="obstacle-pinned-table" />`;
  return halo + shape;
}

function tableMarkup(table, tableType, scale) {
  const x = table.x * scale;
  const y = table.y * scale;
  const data = `data-x="${table.x}" data-y="${table.y}"`;

  if (tableType.shape === 'round') {
    const r = (tableType.dimensions.diameter / 2) * scale;
    return `<circle cx="${x}" cy="${y}" r="${r}" class="table" ${data} />`;
  }

  const w = tableType.dimensions.width * scale;
  const h = tableType.dimensions.depth * scale;
  return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" class="table" ${data} />`;
}

function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[c]));
}
