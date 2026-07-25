import { effectiveFootprint, squareGridCells, hexGridCells } from './geometry.js';

export function arrange({ room, tableType, guestCount, mode, packing = 'auto' }) {
  const footprint = effectiveFootprint(tableType);
  const positions = choosePositions(room, tableType, footprint, packing);

  const capacity = positions.length;
  const requiredTables = Math.ceil(guestCount / tableType.seats);
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

function choosePositions(room, tableType, footprint, packing) {
  const square = squareGridCells(room, footprint.width, footprint.depth);
  if (tableType.shape !== 'round') return square;

  if (packing === 'square') return square;

  const hex = hexGridCells(room, footprint.width);
  if (packing === 'hex') return hex;

  // Hex packing is denser than square packing on an unbounded plane, but a
  // small room can divide evenly by the table's footprint (zero leftover
  // slack), in which case square already tiles perfectly and hex's tighter
  // row spacing has no gap left to exploit. 'auto' tries both, keeps
  // whichever fits more tables for this specific room.
  return hex.length > square.length ? hex : square;
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
