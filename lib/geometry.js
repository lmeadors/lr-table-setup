export function feetToInches(feet) {
  return feet * 12;
}

export function effectiveFootprintForBuffer(tableType, buffer) {
  if (tableType.shape === 'round') {
    const size = tableType.dimensions.diameter + buffer * 2;
    return { width: size, depth: size };
  }
  return {
    width: tableType.dimensions.width + buffer * 2,
    depth: tableType.dimensions.depth + buffer * 2,
  };
}

export function effectiveFootprint(tableType) {
  return effectiveFootprintForBuffer(tableType, tableType.clearanceBuffer);
}

export function roomAreaSqFt(room) {
  const area = room.width * room.depth;
  const obstacleArea = (room.obstacles || []).reduce((sum, o) => {
    if (o.shape === 'round') {
      const radius = o.width / 2;
      return sum + Math.PI * radius * radius;
    }
    return sum + o.width * o.depth;
  }, 0);
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
  const widthIn = feetToInches(obstacle.width);
  const depthIn = feetToInches(obstacle.depth);
  return {
    x0,
    y0,
    x1: x0 + widthIn,
    y1: y0 + depthIn,
    cx: x0 + widthIn / 2,
    cy: y0 + depthIn / 2,
    radius: widthIn / 2,
  };
}

function rectOverlapsObstacle(obstacle, x0, x1, y0, y1) {
  const b = obstacleBoundsIn(obstacle);
  if (obstacle.shape === 'round') {
    const closestX = Math.max(x0, Math.min(b.cx, x1));
    const closestY = Math.max(y0, Math.min(b.cy, y1));
    const dx = b.cx - closestX;
    const dy = b.cy - closestY;
    return dx * dx + dy * dy < b.radius * b.radius;
  }
  return x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0;
}

function circleOverlapsObstacle(obstacle, cx, cy, radius) {
  const b = obstacleBoundsIn(obstacle);
  if (obstacle.shape === 'round') {
    const dx = cx - b.cx;
    const dy = cy - b.cy;
    const sumRadius = radius + b.radius;
    return dx * dx + dy * dy < sumRadius * sumRadius;
  }
  const closestX = Math.max(b.x0, Math.min(cx, b.x1));
  const closestY = Math.max(b.y0, Math.min(cy, b.y1));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function rectOverlapsObstacles(room, cx, cy, w, d) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - d / 2;
  const y1 = cy + d / 2;
  return (room.obstacles || []).some((o) => rectOverlapsObstacle(o, x0, x1, y0, y1));
}

function circleOverlapsObstacles(room, cx, cy, radius) {
  return (room.obstacles || []).some((o) => circleOverlapsObstacle(o, cx, cy, radius));
}
