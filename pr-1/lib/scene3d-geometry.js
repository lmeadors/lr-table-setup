// Pure math for the 3D walkthrough - no THREE.js/DOM import, so this is
// testable directly in plain Node. Mirrors the split between lib/geometry.js
// (math) and lib/render.js (rendering). Everything here operates in feet;
// room/obstacles already are, but tableType.dimensions/clearanceBuffer and
// every result.tables[]/result.footprint value from lib/solver.js are in
// inches - callers (lib/scene3d.js) convert at the boundary before calling in.

export const WALL_HEIGHT_FT = 10;
export const WALL_THICKNESS_FT = 0.5;
export const OBSTACLE_HEIGHT_FT = 8;
export const TABLE_TOP_HEIGHT_FT = 2.5;
export const CHAIR_SEAT_FT = 1.5;
export const CHAIR_SEAT_HEIGHT_FT = 1.5;
export const CHAIR_BACK_HEIGHT_FT = 1.5;
export const EYE_HEIGHT_FT = 5.5;
export const PLAYER_RADIUS_FT = 0.75; // ~18in shoulder width
export const MOVE_SPEED_FT_PER_SEC = 8;

// Places seats around a round table or along the two long edges of a rect
// table. `input` is a normalized, already-feet-converted shape built by the
// caller (see chairInputForTableType/chairInputForPinnedObstacle in
// lib/scene3d.js) - this function doesn't know about tableType or obstacle
// shapes at all.
//
//   round: { shape: 'round', diameterFt, clearanceFt, seats }
//   rect:  { shape: 'rect', widthFt, depthFt, clearanceWidthFt, clearanceDepthFt, seats }
//
// Returns [{ x, z, facingRad }] in table-local coordinates (table center at
// origin) - facingRad is a Y-axis rotation (0 = facing +x, increasing toward
// +z) pointing each chair back toward the table center.
export function computeChairTransforms(input) {
  if (!input || !input.seats || input.seats <= 0) return [];

  if (input.shape === 'round') {
    const radius = input.diameterFt / 2;
    const chairDist = radius + input.clearanceFt / 2;
    const angleStep = (2 * Math.PI) / input.seats;
    const chairs = [];
    for (let i = 0; i < input.seats; i++) {
      const angle = i * angleStep;
      chairs.push({
        x: Math.cos(angle) * chairDist,
        z: Math.sin(angle) * chairDist,
        facingRad: angle + Math.PI,
      });
    }
    return chairs;
  }

  const { longIsWidth, longFt, shortFt, shortClearanceFt } = rectSeatingAxis(input);
  const offset = shortFt / 2 + shortClearanceFt / 2;

  const front = Math.floor(input.seats / 2);
  const back = Math.ceil(input.seats / 2);
  return [
    ...edgeChairs(front, longFt, offset, longIsWidth, 1),
    ...edgeChairs(back, longFt, offset, longIsWidth, -1),
  ];
}

// Rect: whichever physical dimension is longer is the seating-edge axis
// (chairs spread along it); the shorter one is the pushback axis, and its
// paired clearance key is the chair clearance. Not hardcoded to `width` -
// catalog.js's *-rotated table types swap which physical dimension is
// which, and the clearanceBuffer keys swap right along with them.
function rectSeatingAxis(input) {
  const longIsWidth = input.widthFt >= input.depthFt;
  return {
    longIsWidth,
    longFt: longIsWidth ? input.widthFt : input.depthFt,
    shortFt: longIsWidth ? input.depthFt : input.widthFt,
    shortClearanceFt: longIsWidth ? input.clearanceDepthFt : input.clearanceWidthFt,
  };
}

function edgeChairs(count, longFt, offset, longIsWidth, side) {
  const chairs = [];
  for (let i = 0; i < count; i++) {
    const posAlongLong = -longFt / 2 + ((i + 0.5) * longFt) / count;
    const x = longIsWidth ? posAlongLong : side * offset;
    const z = longIsWidth ? side * offset : posAlongLong;
    const facingRad = longIsWidth
      ? (side > 0 ? -Math.PI / 2 : Math.PI / 2)
      : (side > 0 ? Math.PI : 0);
    chairs.push({ x, z, facingRad });
  }
  return chairs;
}

// tableType.dimensions/clearanceBuffer are inches; result.footprint is the
// solver's own buffer-inflated size (also inches), reflecting spread mode's
// maximized spacing rather than the raw catalog clearanceBuffer. Converts
// both to the feet-based shape computeChairTransforms/occupiedFootprint
// expect.
export function chairInputForTableType(tableType, footprint) {
  if (tableType.shape === 'round') {
    const diameterFt = tableType.dimensions.diameter / 12;
    const clearanceFt = (footprint.width / 12 - diameterFt) / 2;
    return { shape: 'round', diameterFt, clearanceFt, seats: tableType.seats };
  }
  const widthFt = tableType.dimensions.width / 12;
  const depthFt = tableType.dimensions.depth / 12;
  return {
    shape: 'rect',
    widthFt,
    depthFt,
    clearanceWidthFt: (footprint.width / 12 - widthFt) / 2,
    clearanceDepthFt: (footprint.depth / 12 - depthFt) / 2,
    seats: tableType.seats,
  };
}

// Pinned-table obstacles (an obstacle with seats > 0 - see render.js's
// obstacle-pinned-table case) aren't tableType objects: they only carry one
// scalar buffer applied to both axes (same over-buffering tradeoff app.js's
// own pin-to-obstacle click handler already accepts) and their own `seats`,
// independent of any catalog entry's seat count (e.g. a 4-seat head-table
// segment built from an 8ft table body that normally seats 8).
export function chairInputForPinnedObstacle(obstacle) {
  const clearanceFt = (obstacle.buffer || 0) / 12;
  if (obstacle.shape === 'round') {
    return { shape: 'round', diameterFt: obstacle.width, clearanceFt, seats: obstacle.seats };
  }
  return {
    shape: 'rect',
    widthFt: obstacle.width,
    depthFt: obstacle.depth,
    clearanceWidthFt: clearanceFt,
    clearanceDepthFt: clearanceFt,
    seats: obstacle.seats,
  };
}

// The buffer-inflated footprint (result.footprint, or an obstacle's own
// buffer) is the solver's per-table reservation for that table's own chair
// pushback space - it isn't a shared walking aisle, and packing maximizes
// density by placing adjacent footprints exactly tangent to each other (see
// findSpawnPoint's comment). Colliding against the full footprint everywhere
// means the walkthrough can have literally zero gap between neighboring
// tables. This computes a tighter collider from the real table+chair
// geometry instead - the chair's own transform plus half a chair depth for
// the seat/backrest - so the walkthrough only blocks the floor space chairs
// actually occupy, leaving whatever real gap exists (if any) walkable.
export function occupiedFootprint(chairInput) {
  if (!chairInput.seats || chairInput.seats <= 0) {
    return chairInput.shape === 'round'
      ? { shape: 'round', radiusFt: chairInput.diameterFt / 2 }
      : { shape: 'rect', halfWidthFt: chairInput.widthFt / 2, halfDepthFt: chairInput.depthFt / 2 };
  }
  if (chairInput.shape === 'round') {
    const chairDist = chairInput.diameterFt / 2 + chairInput.clearanceFt / 2;
    return { shape: 'round', radiusFt: chairDist + CHAIR_SEAT_FT / 2 };
  }
  const { longIsWidth, longFt, shortFt, shortClearanceFt } = rectSeatingAxis(chairInput);
  const halfLong = longFt / 2;
  const pushbackOffset = shortFt / 2 + shortClearanceFt / 2 + CHAIR_SEAT_FT / 2;
  return longIsWidth
    ? { shape: 'rect', halfWidthFt: halfLong, halfDepthFt: pushbackOffset }
    : { shape: 'rect', halfWidthFt: pushbackOffset, halfDepthFt: halfLong };
}

function occupiedBody(occupied, cx, cz) {
  if (occupied.shape === 'round') {
    return { type: 'circle', cx, cz, radius: occupied.radiusFt };
  }
  return {
    type: 'rect',
    x0: cx - occupied.halfWidthFt,
    x1: cx + occupied.halfWidthFt,
    z0: cz - occupied.halfDepthFt,
    z1: cz + occupied.halfDepthFt,
  };
}

// Room boundary, every non-table obstacle (expanded by its own buffer, same
// convention as lib/geometry.js's obstacleBoundsIn - these are actually
// solid the whole buffer out, e.g. a bar or DJ booth), and every table -
// pinned or auto-placed - using its real chair-occupied footprint rather
// than the buffer-inflated one. All returned bodies are in feet.
export function computeCollisionBodies(room, tableType, result) {
  const bodies = [{ type: 'room', width: room.width, depth: room.depth }];

  for (const o of room.obstacles || []) {
    if (o.seats > 0) {
      const occupied = occupiedFootprint(chairInputForPinnedObstacle(o));
      bodies.push(occupiedBody(occupied, o.x + o.width / 2, o.y + o.depth / 2));
      continue;
    }
    const bufferFt = (o.buffer || 0) / 12;
    if (o.shape === 'round') {
      bodies.push({
        type: 'circle',
        cx: o.x + o.width / 2,
        cz: o.y + o.depth / 2,
        radius: o.width / 2 + bufferFt,
      });
    } else {
      bodies.push({
        type: 'rect',
        x0: o.x - bufferFt,
        x1: o.x + o.width + bufferFt,
        z0: o.y - bufferFt,
        z1: o.y + o.depth + bufferFt,
      });
    }
  }

  if (result && tableType) {
    const occupied = occupiedFootprint(chairInputForTableType(tableType, result.footprint));
    for (const t of result.tables) {
      bodies.push(occupiedBody(occupied, t.x / 12, t.y / 12));
    }
  }

  return bodies;
}

// Axis-separated sliding collision: try the full move, then X-only, then
// Z-only, so walking at an angle into a wall/obstacle slides instead of
// stopping dead.
export function resolveMove(position, delta, colliders, playerRadiusFt) {
  const full = { x: position.x + delta.x, z: position.z + delta.z };
  if (!collides(full, colliders, playerRadiusFt)) return full;

  const xOnly = { x: position.x + delta.x, z: position.z };
  if (!collides(xOnly, colliders, playerRadiusFt)) return xOnly;

  const zOnly = { x: position.x, z: position.z + delta.z };
  if (!collides(zOnly, colliders, playerRadiusFt)) return zOnly;

  return { x: position.x, z: position.z };
}

function collides(pos, colliders, r) {
  return colliders.some((body) => bodyCollides(pos, r, body));
}

// Room center is the natural spawn point, but a packed/near-capacity layout
// can leave a table sitting right on it - spiral outward on rings of
// growing radius until an unobstructed point turns up. Starting inside a
// collider isn't just a bad spawn: resolveMove's full/X-only/Z-only probes
// can all still land inside the same body, which reads as "WASD does
// nothing" rather than "I'm stuck".
export function findSpawnPoint(room, colliders, playerRadiusFt) {
  const cx = room.width / 2;
  const cz = room.depth / 2;
  if (!collides({ x: cx, z: cz }, colliders, playerRadiusFt)) return { x: cx, z: cz };

  const step = playerRadiusFt;
  const maxRadius = Math.hypot(room.width, room.depth) / 2 + step;
  for (let radius = step; radius <= maxRadius; radius += step) {
    const samples = Math.max(8, Math.round((2 * Math.PI * radius) / step));
    for (let i = 0; i < samples; i++) {
      const angle = (2 * Math.PI * i) / samples;
      const pos = { x: cx + radius * Math.cos(angle), z: cz + radius * Math.sin(angle) };
      if (!collides(pos, colliders, playerRadiusFt)) return pos;
    }
  }
  return { x: cx, z: cz };
}

function bodyCollides(pos, r, body) {
  if (body.type === 'room') {
    return pos.x - r < 0 || pos.x + r > body.width || pos.z - r < 0 || pos.z + r > body.depth;
  }
  if (body.type === 'circle') {
    const dx = pos.x - body.cx;
    const dz = pos.z - body.cz;
    return dx * dx + dz * dz < (r + body.radius) ** 2;
  }
  // rect
  const closestX = Math.max(body.x0, Math.min(pos.x, body.x1));
  const closestZ = Math.max(body.z0, Math.min(pos.z, body.z1));
  const dx = pos.x - closestX;
  const dz = pos.z - closestZ;
  return dx * dx + dz * dz < r * r;
}
