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
  const obstacleArea = (room.obstacles || []).reduce((sum, o) => sum + o.width * o.depth, 0);
  return Math.max(0, area - obstacleArea);
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
      if (!rectOverlapsObstacles(room, x, y, effWidth, effDepth)) {
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
      if (!circleOverlapsObstacles(room, x, y, radius)) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

function obstacleBoundsIn(obstacle) {
  const x0 = feetToInches(obstacle.x);
  const y0 = feetToInches(obstacle.y);
  return {
    x0,
    y0,
    x1: x0 + feetToInches(obstacle.width),
    y1: y0 + feetToInches(obstacle.depth),
  };
}

function rectOverlapsObstacles(room, cx, cy, w, d) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - d / 2;
  const y1 = cy + d / 2;
  return (room.obstacles || []).some((o) => {
    const b = obstacleBoundsIn(o);
    return x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0;
  });
}

function circleOverlapsObstacles(room, cx, cy, radius) {
  return (room.obstacles || []).some((o) => {
    const b = obstacleBoundsIn(o);
    const closestX = Math.max(b.x0, Math.min(cx, b.x1));
    const closestY = Math.max(b.y0, Math.min(cy, b.y1));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < radius * radius;
  });
}
