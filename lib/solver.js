import { effectiveFootprintForBuffer, squareGridCells, hexGridCells, compactRectPositions } from './geometry.js';

function isValidBufferOverride(value) {
  if (typeof value === 'number') return value >= 0;
  return !!value && typeof value === 'object' &&
    typeof value.width === 'number' && value.width >= 0 &&
    typeof value.depth === 'number' && value.depth >= 0;
}

export function arrange({ room, tableType, guestCount, mode, packing = 'auto', buffer: bufferOverride, preferredStrategy, startX = 0, startY = 0 }) {
  const requiredTables = Math.ceil(guestCount / tableType.seats);
  const minBuffer = isValidBufferOverride(bufferOverride) ? bufferOverride : tableType.clearanceBuffer;
  const startXIn = startX * 12;
  const startYIn = startY * 12;
  const strategy = choosePackingStrategy(room, tableType, minBuffer, packing, preferredStrategy, startXIn, startYIn);

  let buffer = minBuffer;

  // Capacity isn't guaranteed to shrink monotonically as buffer grows - an
  // irregular room (obstacles carving up the floor) can mean a *larger*
  // buffer shifts the lattice into an alignment that dodges an obstacle
  // corner better, fitting MORE tables than the minimum buffer does. So
  // this always searches for a better buffer in spread mode, even when the
  // minimum buffer alone looks like it can't fit requiredTables -
  // maximizeBuffer's binary search only ever keeps a buffer it has verified
  // actually achieves the required count, so this can only find a better
  // answer than skipping the search, never a worse one.
  if (mode === 'spread' && requiredTables > 0) {
    buffer = maximizeBuffer(room, tableType, strategy, minBuffer, requiredTables, startXIn, startYIn);
  }

  const footprint = effectiveFootprintForBuffer(tableType, buffer);

  // Compact mode for rectangular tables uses true bottom-left-fill
  // compaction (see compactRectPositions) instead of the fixed uniform
  // lattice: the lattice discards a whole candidate cell the instant any
  // obstacle clips it at all, even by a sliver, so a handful of tables in a
  // mostly-empty room end up on a rigid grid line far from the furniture
  // that's actually there. Spread mode keeps the lattice - its whole point
  // is even coverage via spreadSelect's stride sampling, which needs the
  // lattice's uniform-coverage property to mean anything. Round tables keep
  // their existing hex/square choice either way.
  const useCompaction = mode === 'compact' && tableType.shape !== 'round';
  const positions = useCompaction
    ? compactRectPositions(room, footprint.width, footprint.depth, startXIn, startYIn, requiredTables)
    : positionsFor(room, tableType, strategy, footprint, startXIn, startYIn);

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
    strategy,
  };
}

function positionsFor(room, tableType, strategy, footprint, startXIn = 0, startYIn = 0) {
  return strategy === 'hex'
    ? hexGridCells(room, footprint.width, startXIn, startYIn)
    : squareGridCells(room, footprint.width, footprint.depth, tableType.shape, startXIn, startYIn);
}

function choosePackingStrategy(room, tableType, minBuffer, packing, preferredStrategy, startXIn = 0, startYIn = 0) {
  if (tableType.shape !== 'round') return 'square';
  if (packing === 'square') return 'square';
  if (packing === 'hex') return 'hex';

  // Hex packing is denser than square packing on an unbounded plane, but a
  // small room can divide evenly by the table's footprint (zero leftover
  // slack), in which case square already tiles perfectly and hex's tighter
  // row spacing has no gap left to exploit. 'auto' tries both, keeps
  // whichever fits more tables for this specific room.
  const minFootprint = effectiveFootprintForBuffer(tableType, minBuffer);
  const squareCount = squareGridCells(room, minFootprint.width, minFootprint.depth, tableType.shape, startXIn, startYIn).length;
  const hexCount = hexGridCells(room, minFootprint.width, startXIn, startYIn).length;

  // On an exact tie, a small unrelated edit (e.g. pinning one table) can flip
  // which strategy wins by a single cell, triggering a full visual pattern
  // change (hex dots <-> square grid) and reshuffling every other table's
  // position even though capacity didn't actually change. Preferring
  // whichever strategy was already in use keeps small edits from causing
  // that jolt; it only matters on a genuine tie, not when one strategy is
  // actually better.
  if (squareCount === hexCount && (preferredStrategy === 'hex' || preferredStrategy === 'square')) {
    return preferredStrategy;
  }
  return hexCount > squareCount ? 'hex' : 'square';
}

// Binary-searches the largest buffer (>= the table type's minimum clearance)
// for which `requiredCount` tables still fit, so leftover room area becomes
// extra even spacing around every table instead of being left as one unused
// block. Only used for spread mode - compact mode's whole point is leaving
// leftover space as one contiguous block (e.g. for a dance floor), so it
// deliberately keeps the minimum buffer instead.
function maximizeBuffer(room, tableType, strategy, minBuffer, requiredCount, startXIn = 0, startYIn = 0) {
  // minBuffer may be a single number (round tables, or a plain rect override)
  // or a { width, depth } pair (rect tables with per-axis clearance). Either
  // way, the search variable is the *extra* margin added beyond the minimum
  // on every axis at once - that keeps a round table's search identical to
  // before, and grows a rect table's two axes together rather than assuming
  // a single scalar means the same thing on both.
  const isPerAxis = minBuffer && typeof minBuffer === 'object';
  const baseWidth = isPerAxis ? minBuffer.width : minBuffer;
  const baseDepth = isPerAxis ? minBuffer.depth : minBuffer;
  const build = (extra) => isPerAxis ? { width: baseWidth + extra, depth: baseDepth + extra } : baseWidth + extra;

  let lo = 0;
  let hi = Math.min(room.width, room.depth) * 12;

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const footprint = effectiveFootprintForBuffer(tableType, build(mid));
    const count = positionsFor(room, tableType, strategy, footprint, startXIn, startYIn).length;
    if (count >= requiredCount) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return build(lo);
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
