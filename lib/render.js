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
  const x = obstacle.x * 12 * scale;
  const y = obstacle.y * 12 * scale;
  const w = obstacle.width * 12 * scale;
  const h = obstacle.depth * 12 * scale;
  const pinned = !isPreview && obstacle.seats;
  const cls = isPreview ? 'obstacle obstacle-preview' : `obstacle${pinned ? ' obstacle-pinned-table' : ''}`;
  const label = !isPreview && obstacle.label
    ? `<text x="${x + w / 2}" y="${y + h / 2}" class="obstacle-label" text-anchor="middle" dominant-baseline="middle">${escapeXml(obstacle.label)}</text>`
    : '';

  if (obstacle.shape === 'round') {
    return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}" class="${cls}" />${label}`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}" />${label}`;
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
