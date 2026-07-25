export function feetToInches(feet) {
  return feet * 12;
}

export function effectiveFootprint(tableType) {
  const buffer = tableType.clearanceBuffer;
  if (tableType.shape === 'round') {
    const size = tableType.dimensions.diameter + buffer * 2;
    return { width: size, depth: size };
  }
  return {
    width: tableType.dimensions.width + buffer * 2,
    depth: tableType.dimensions.depth + buffer * 2,
  };
}

export function roomAreaSqFt(room) {
  const area = room.width * room.depth;
  if (room.shape === 'l-shape' && room.notch) {
    return area - room.notch.width * room.notch.depth;
  }
  return area;
}

export function squareGridCells(room, effWidth, effDepth) {
  const roomWidthIn = feetToInches(room.width);
  const roomDepthIn = feetToInches(room.depth);
  const cols = Math.floor(roomWidthIn / effWidth);
  const rows = Math.floor(roomDepthIn / effDepth);

  const positions = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * effWidth + effWidth / 2;
      const y = row * effDepth + effDepth / 2;
      if (!rectOverlapsNotch(room, x, y, effWidth, effDepth)) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

export function hexGridCells(room, effDiameter) {
  const radius = effDiameter / 2;
  const roomWidthIn = feetToInches(room.width);
  const roomDepthIn = feetToInches(room.depth);
  const rowHeight = (effDiameter * Math.sqrt(3)) / 2;

  const positions = [];
  let rowIndex = 0;
  for (let y = radius; y + radius <= roomDepthIn; y += rowHeight, rowIndex++) {
    const offset = rowIndex % 2 === 0 ? 0 : radius;
    for (let x = radius + offset; x + radius <= roomWidthIn; x += effDiameter) {
      if (!circleOverlapsNotch(room, x, y, radius)) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

function notchBounds(room) {
  const roomWidthIn = feetToInches(room.width);
  const roomDepthIn = feetToInches(room.depth);
  const notchWidthIn = feetToInches(room.notch.width);
  const notchDepthIn = feetToInches(room.notch.depth);

  let x0;
  let y0;
  switch (room.notch.corner) {
    case 'top-right':
      x0 = roomWidthIn - notchWidthIn;
      y0 = 0;
      break;
    case 'bottom-left':
      x0 = 0;
      y0 = roomDepthIn - notchDepthIn;
      break;
    case 'bottom-right':
      x0 = roomWidthIn - notchWidthIn;
      y0 = roomDepthIn - notchDepthIn;
      break;
    case 'top-left':
    default:
      x0 = 0;
      y0 = 0;
      break;
  }
  return { x0, y0, x1: x0 + notchWidthIn, y1: y0 + notchDepthIn };
}

function rectOverlapsNotch(room, cx, cy, w, d) {
  if (room.shape !== 'l-shape' || !room.notch) return false;
  const n = notchBounds(room);
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - d / 2;
  const y1 = cy + d / 2;
  return x0 < n.x1 && x1 > n.x0 && y0 < n.y1 && y1 > n.y0;
}

function circleOverlapsNotch(room, cx, cy, radius) {
  if (room.shape !== 'l-shape' || !room.notch) return false;
  const n = notchBounds(room);
  const closestX = Math.max(n.x0, Math.min(cx, n.x1));
  const closestY = Math.max(n.y0, Math.min(cy, n.y1));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}
