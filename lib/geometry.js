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
    const bufferFt = (o.buffer || 0) / 12;
    const w = o.width + bufferFt * 2;
    const d = o.depth + bufferFt * 2;
    if (o.shape === 'round') {
      const radius = w / 2;
      return sum + Math.PI * radius * radius;
    }
    return sum + w * d;
  }, 0);
  return Math.max(0, area - obstacleArea);
}

export function squareGridCells(room, effWidth, effDepth, candidateShape = 'rect') {
  const roomWidthIn = feetToInches(room.width);
  const roomDepthIn = feetToInches(room.depth);
  const cols = Math.floor(roomWidthIn / effWidth);
  const rows = Math.floor(roomDepthIn / effDepth);

  const positions = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * effWidth + effWidth / 2;
      const y = row * effDepth + effDepth / 2;
      // The grid pitch (effWidth/effDepth) is a rectangle either way - that's
      // just candidate spacing. But the actual overlap test against
      // obstacles has to match what the candidate really is: a round table
      // tested against its bounding square would get wrongly excluded near
      // an obstacle's corner/edge where the true circle would clear it.
      const blocked = candidateShape === 'round'
        ? circleOverlapsObstacles(room, x, y, effWidth / 2)
        : rectOverlapsObstacles(room, x, y, effWidth, effDepth);
      if (!blocked) {
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

// obstacle.width/depth is always its real physical footprint - never has
// the buffer baked in. obstacle.buffer (inches) is however much clearance
// it needs, added here at collision-check time instead. That keeps a
// pinned table's stored size meaning what it says (an 8ft table is 8ft,
// not a pre-inflated exclusion zone), and lets any obstacle - not just
// pinned tables - optionally carry its own required clearance.
function obstacleBoundsIn(obstacle) {
  const bufferIn = obstacle.buffer || 0;
  const x0 = feetToInches(obstacle.x) - bufferIn;
  const y0 = feetToInches(obstacle.y) - bufferIn;
  const widthIn = feetToInches(obstacle.width) + bufferIn * 2;
  const depthIn = feetToInches(obstacle.depth) + bufferIn * 2;
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

// Hex (and square) packing places lattice neighbors at exactly the touching
// distance - not overlapping, by construction, which is how every table on
// the lattice can coexist with its neighbors at all. Pinning a table rounds
// its stored position to 0.1ft (1.2in) so the Obstacles list shows clean
// numbers, which is plenty to push a real neighbor from "exactly touching"
// to "overlapping by a fraction of an inch," wrongly excluding it. No real
// event setup crew positions tables to sub-inch precision anyway, so a
// small tolerance here is correct for the domain, not just a rounding patch.
const TOUCH_TOLERANCE_IN = 1;

function rectOverlapsObstacle(obstacle, x0, x1, y0, y1) {
  const b = obstacleBoundsIn(obstacle);
  if (obstacle.shape === 'round') {
    const closestX = Math.max(x0, Math.min(b.cx, x1));
    const closestY = Math.max(y0, Math.min(b.cy, y1));
    const dx = b.cx - closestX;
    const dy = b.cy - closestY;
    const effectiveRadius = Math.max(0, b.radius - TOUCH_TOLERANCE_IN);
    return dx * dx + dy * dy < effectiveRadius * effectiveRadius;
  }
  return (
    x0 < b.x1 - TOUCH_TOLERANCE_IN && x1 > b.x0 + TOUCH_TOLERANCE_IN &&
    y0 < b.y1 - TOUCH_TOLERANCE_IN && y1 > b.y0 + TOUCH_TOLERANCE_IN
  );
}

function circleOverlapsObstacle(obstacle, cx, cy, radius) {
  const b = obstacleBoundsIn(obstacle);
  if (obstacle.shape === 'round') {
    const dx = cx - b.cx;
    const dy = cy - b.cy;
    const sumRadius = Math.max(0, radius + b.radius - TOUCH_TOLERANCE_IN);
    return dx * dx + dy * dy < sumRadius * sumRadius;
  }
  const closestX = Math.max(b.x0, Math.min(cx, b.x1));
  const closestY = Math.max(b.y0, Math.min(cy, b.y1));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const effectiveRadius = Math.max(0, radius - TOUCH_TOLERANCE_IN);
  return dx * dx + dy * dy < effectiveRadius * effectiveRadius;
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
