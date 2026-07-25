const MAX_WIDTH_PX = 700;
const MAX_HEIGHT_PX = 500;

export function renderDiagram(container, room, tableType, result) {
  const roomWidthIn = room.width * 12;
  const roomDepthIn = room.depth * 12;
  const scale = Math.min(MAX_WIDTH_PX / roomWidthIn, MAX_HEIGHT_PX / roomDepthIn);

  const svgWidth = roomWidthIn * scale;
  const svgHeight = roomDepthIn * scale;

  const roomOutline = buildRoomOutline(room, scale);
  const tableShapes = result.tables
    .map((table) => tableMarkup(table, tableType, scale))
    .join('');

  container.innerHTML = `
    <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
      ${roomOutline}
      ${tableShapes}
    </svg>
  `;
}

function buildRoomOutline(room, scale) {
  const w = room.width * 12 * scale;
  const d = room.depth * 12 * scale;

  if (room.shape !== 'l-shape' || !room.notch) {
    return `<rect x="0" y="0" width="${w}" height="${d}" class="room-outline" />`;
  }

  const nw = room.notch.width * 12 * scale;
  const nd = room.notch.depth * 12 * scale;
  return `<polygon points="${notchPoints(room.notch.corner, w, d, nw, nd)}" class="room-outline" />`;
}

function notchPoints(corner, w, d, nw, nd) {
  switch (corner) {
    case 'top-right':
      return `0,0 ${w - nw},0 ${w - nw},${nd} ${w},${nd} ${w},${d} 0,${d}`;
    case 'top-left':
      return `${nw},0 ${w},0 ${w},${d} 0,${d} 0,${nd} ${nw},${nd}`;
    case 'bottom-right':
      return `0,0 ${w},0 ${w},${d - nd} ${w - nw},${d - nd} ${w - nw},${d} 0,${d}`;
    case 'bottom-left':
    default:
      return `0,0 ${w},0 ${w},${d} ${nw},${d} ${nw},${d - nd} 0,${d - nd}`;
  }
}

function tableMarkup(table, tableType, scale) {
  const x = table.x * scale;
  const y = table.y * scale;

  if (tableType.shape === 'round') {
    const r = (tableType.dimensions.diameter / 2) * scale;
    return `<circle cx="${x}" cy="${y}" r="${r}" class="table" />`;
  }

  const w = tableType.dimensions.width * scale;
  const h = tableType.dimensions.depth * scale;
  return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" class="table" />`;
}
