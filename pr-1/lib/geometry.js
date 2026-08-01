export function feetToInches(feet) {
  return feet * 12;
}

export function effectiveFootprintForBuffer(tableType, buffer) {
  if (tableType.shape === 'round') {
    const size = tableType.dimensions.diameter + (typeof buffer === 'number' ? buffer : buffer.width) * 2;
    return { width: size, depth: size };
  }
  const widthBuffer = typeof buffer === 'number' ? buffer : buffer.width;
  const depthBuffer = typeof buffer === 'number' ? buffer : buffer.depth;
  return {
    width: tableType.dimensions.width + widthBuffer * 2,
    depth: tableType.dimensions.depth + depthBuffer * 2,
  };
}

export function effectiveFootprint(tableType) {
  return effectiveFootprintForBuffer(tableType, tableType.clearanceBuffer);
}

export function squareGridCells(room, effWidth, effDepth, candidateShape = 'rect', startXIn = 0, startYIn = 0) {
  const roomWidthIn = feetToInches(room.width);
  const roomDepthIn = feetToInches(room.depth);
  const cols = Math.floor((roomWidthIn - startXIn) / effWidth);
  const rows = Math.floor((roomDepthIn - startYIn) / effDepth);

  const positions = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = startXIn + col * effWidth + effWidth / 2;
      const y = startYIn + row * effDepth + effDepth / 2;
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

export function hexGridCells(room, effDiameter, startXIn = 0, startYIn = 0) {
  const radius = effDiameter / 2;
  const roomWidthIn = feetToInches(room.width);
  const roomDepthIn = feetToInches(room.depth);
  const rowHeight = (effDiameter * Math.sqrt(3)) / 2;

  const positions = [];
  let rowIndex = 0;
  for (let y = startYIn + radius; y + radius <= roomDepthIn; y += rowHeight, rowIndex++) {
    const offset = rowIndex % 2 === 0 ? 0 : radius;
    for (let x = startXIn + radius + offset; x + radius <= roomWidthIn; x += effDiameter) {
      if (!circleOverlapsObstacles(room, x, y, radius)) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

// A uniform lattice (squareGridCells) discards an entire candidate cell the
// instant it clips any obstacle at all, even when the obstacle only clips a
// sliver of it - and every cell shares the same row/column pitch, so a
// handful of tables in a mostly-empty room end up sitting on whatever grid
// line survives, however far that is from the furniture actually in the
// room. This is a bottom-left-fill packer instead: each table goes at
// whichever open spot is topmost, then leftmost - hugging obstacles and
// previously-placed tables directly - by tracking a frontier of candidate
// corners seeded from the room origin and every obstacle's own corners, and
// growing it from each table's corners once placed. Only meant for
// rectangular tables in compact mode: round tables already have a tuned
// hex/square choice, and spread mode's whole point is even coverage across
// the room (via squareGridCells + spreadSelect), not tight compaction.
export function compactRectPositions(room, effWidth, effDepth, startXIn = 0, startYIn = 0, maxCount = Infinity) {
  const roomWidthIn = feetToInches(room.width);
  const roomDepthIn = feetToInches(room.depth);
  const EPS = 0.01;

  const candidates = [];
  const seen = new Set();
  function offer(x0, y0) {
    x0 = Math.max(startXIn, x0);
    y0 = Math.max(startYIn, y0);
    if (x0 + effWidth > roomWidthIn + EPS || y0 + effDepth > roomDepthIn + EPS) return;
    const key = `${Math.round(x0 * 10)}:${Math.round(y0 * 10)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ x0, y0 });
  }

  offer(startXIn, startYIn);
  for (const o of room.obstacles || []) {
    const b = obstacleBoundsIn(o);
    offer(b.x1, b.y0);
    offer(b.x0, b.y1);
  }

  const placedFootprints = [];
  const positions = [];

  while (positions.length < maxCount && candidates.length > 0) {
    // Topmost first, then leftmost - matches the existing top-to-bottom,
    // left-to-right convention the uniform grid already used, so a sparse
    // layout still fills starting from near the top of the room.
    candidates.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));

    const pseudoObstacles = placedFootprints.map((p) => ({
      x: p.x0 / 12, y: p.y0 / 12, width: effWidth / 12, depth: effDepth / 12, shape: 'rect',
    }));
    const combinedRoom = { obstacles: [...(room.obstacles || []), ...pseudoObstacles] };

    let chosenIndex = -1;
    for (let i = 0; i < candidates.length; i++) {
      const cx = candidates[i].x0 + effWidth / 2;
      const cy = candidates[i].y0 + effDepth / 2;
      if (!rectOverlapsObstacles(combinedRoom, cx, cy, effWidth, effDepth)) {
        chosenIndex = i;
        break;
      }
    }
    if (chosenIndex === -1) break;

    const { x0, y0 } = candidates[chosenIndex];
    candidates.splice(chosenIndex, 1);
    placedFootprints.push({ x0, y0 });
    positions.push({ x: x0 + effWidth / 2, y: y0 + effDepth / 2 });

    offer(x0 + effWidth, y0);
    offer(x0, y0 + effDepth);
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
// numbers. On the diagonal, that rounding can combine on both axes at once,
// shifting a pinned table almost 2in closer to one specific hex neighbor -
// enough to push a real neighbor from "exactly touching" to "overlapping,"
// wrongly excluding it (and, since hex neighbors sit at the same pitch
// distance in six directions, losing one can cascade into losing another
// down the lattice). No real event setup crew positions tables to sub-inch
// precision anyway, so a few inches of tolerance here is correct for the
// domain, not just a rounding patch.
const TOUCH_TOLERANCE_IN = 3;

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
