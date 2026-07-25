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
  const tableShapes = result
    ? result.tables.map((t) => tableMarkup(t, tableType, scale)).join('')
    : '';
  const previewShape = previewObstacle ? obstacleMarkup(previewObstacle, scale, true) : '';

  container.innerHTML = `
    <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
      ${roomOutline}
      ${obstacleShapes}
      ${tableShapes}
      ${previewShape}
    </svg>
  `;
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
