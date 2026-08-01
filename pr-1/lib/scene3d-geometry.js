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
export const PLAYER_RADIUS_FT = 1.0;
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

  // Rect: whichever physical dimension is longer is the seating-edge axis
  // (chairs spread along it); the shorter one is the pushback axis, and its
  // paired clearance key is the chair clearance. Not hardcoded to `width` -
  // catalog.js's *-rotated table types swap which physical dimension is
  // which, and the clearanceBuffer keys swap right along with them.
  const longIsWidth = input.widthFt >= input.depthFt;
  const longFt = longIsWidth ? input.widthFt : input.depthFt;
  const shortFt = longIsWidth ? input.depthFt : input.widthFt;
  const shortClearanceFt = longIsWidth ? input.clearanceDepthFt : input.clearanceWidthFt;
  const offset = shortFt / 2 + shortClearanceFt / 2;

  const front = Math.floor(input.seats / 2);
  const back = Math.ceil(input.seats / 2);
  return [
    ...edgeChairs(front, longFt, offset, longIsWidth, 1),
    ...edgeChairs(back, longFt, offset, longIsWidth, -1),
  ];
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

// Room boundary, every obstacle (expanded by its own buffer, same convention
// as lib/geometry.js's obstacleBoundsIn), and every auto-placed table (using
// result.footprint - the solver's own buffer-inflated size - as its
// collider, so chair-occupied space is covered without modeling individual
// chairs). Pinned tables need no special handling: they're already covered
// by the general obstacle loop above. All returned bodies are in feet.
export function computeCollisionBodies(room, tableType, result) {
  const bodies = [{ type: 'room', width: room.width, depth: room.depth }];

  for (const o of room.obstacles || []) {
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
    const footprintWidthFt = result.footprint.width / 12;
    const footprintDepthFt = result.footprint.depth / 12;
    for (const t of result.tables) {
      const cx = t.x / 12;
      const cz = t.y / 12;
      if (tableType.shape === 'round') {
        bodies.push({ type: 'circle', cx, cz, radius: footprintWidthFt / 2 });
      } else {
        bodies.push({
          type: 'rect',
          x0: cx - footprintWidthFt / 2,
          x1: cx + footprintWidthFt / 2,
          z0: cz - footprintDepthFt / 2,
          z1: cz + footprintDepthFt / 2,
        });
      }
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
