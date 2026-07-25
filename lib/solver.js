import { effectiveFootprintForBuffer, squareGridCells, hexGridCells } from './geometry.js';

export function arrange({ room, tableType, guestCount, mode, packing = 'auto', buffer: bufferOverride }) {
  const requiredTables = Math.ceil(guestCount / tableType.seats);
  const minBuffer = typeof bufferOverride === 'number' && bufferOverride >= 0 ? bufferOverride : tableType.clearanceBuffer;
  const strategy = choosePackingStrategy(room, tableType, minBuffer, packing);

  let buffer = minBuffer;
  const minBufferCapacity = positionsFor(room, tableType, strategy, effectiveFootprintForBuffer(tableType, minBuffer)).length;

  if (mode === 'spread' && minBufferCapacity >= requiredTables && requiredTables > 0) {
    buffer = maximizeBuffer(room, tableType, strategy, minBuffer, requiredTables);
  }

  const footprint = effectiveFootprintForBuffer(tableType, buffer);
  const positions = positionsFor(room, tableType, strategy, footprint);

  const capacity = positions.length;
  const placedCount = Math.min(requiredTables, capacity);

  const tables = mode === 'spread'
    ? spreadSelect(positions, placedCount)
    : positions.slice(0, placedCount);

  const seatsAchieved = placedCount * tableType.seats;

  return {
    tables,
    footprint,
    tableCount: placedCount,
    seatsAchieved,
    seatsRequested: guestCount,
    seatsShort: Math.max(0, guestCount - seatsAchieved),
  };
}

function positionsFor(room, tableType, strategy, footprint) {
  return strategy === 'hex'
    ? hexGridCells(room, footprint.width)
    : squareGridCells(room, footprint.width, footprint.depth);
}

function choosePackingStrategy(room, tableType, minBuffer, packing) {
  if (tableType.shape !== 'round') return 'square';
  if (packing === 'square') return 'square';
  if (packing === 'hex') return 'hex';

  // Hex packing is denser than square packing on an unbounded plane, but a
  // small room can divide evenly by the table's footprint (zero leftover
  // slack), in which case square already tiles perfectly and hex's tighter
  // row spacing has no gap left to exploit. 'auto' tries both, keeps
  // whichever fits more tables for this specific room.
  const minFootprint = effectiveFootprintForBuffer(tableType, minBuffer);
  const squareCount = squareGridCells(room, minFootprint.width, minFootprint.depth).length;
  const hexCount = hexGridCells(room, minFootprint.width).length;
  return hexCount > squareCount ? 'hex' : 'square';
}

// Binary-searches the largest buffer (>= the table type's minimum clearance)
// for which `requiredCount` tables still fit, so leftover room area becomes
// extra even spacing around every table instead of being left as one unused
// block. Only used for spread mode - compact mode's whole point is leaving
// leftover space as one contiguous block (e.g. for a dance floor), so it
// deliberately keeps the minimum buffer instead.
function maximizeBuffer(room, tableType, strategy, minBuffer, requiredCount) {
  let lo = minBuffer;
  let hi = minBuffer + Math.min(room.width, room.depth) * 12;

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const footprint = effectiveFootprintForBuffer(tableType, mid);
    const count = positionsFor(room, tableType, strategy, footprint).length;
    if (count >= requiredCount) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return lo;
}

function spreadSelect(positions, count) {
  if (count <= 0) return [];
  if (count >= positions.length) return positions;

  const stride = positions.length / count;
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(positions[Math.floor(i * stride)]);
  }
  return result;
}
