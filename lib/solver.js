import { effectiveFootprint, buildGrid } from './geometry.js';

export function arrange({ room, tableType, guestCount, mode }) {
  const footprint = effectiveFootprint(tableType);
  const grid = buildGrid(room, footprint.width, footprint.depth);
  const capacity = grid.cells.length;

  const requiredTables = Math.ceil(guestCount / tableType.seats);
  const placedCount = Math.min(requiredTables, capacity);

  const cells = mode === 'spread'
    ? spreadSelect(grid.cells, placedCount)
    : grid.cells.slice(0, placedCount);

  const tables = cells.map((cell) => ({
    x: cell.col * footprint.width + footprint.width / 2,
    y: cell.row * footprint.depth + footprint.depth / 2,
  }));

  const seatsAchieved = placedCount * tableType.seats;

  return {
    tables,
    footprint,
    grid,
    tableCount: placedCount,
    seatsAchieved,
    seatsRequested: guestCount,
    seatsShort: Math.max(0, guestCount - seatsAchieved),
  };
}

function spreadSelect(cells, count) {
  if (count <= 0) return [];
  if (count >= cells.length) return cells;

  const stride = cells.length / count;
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(cells[Math.floor(i * stride)]);
  }
  return result;
}
