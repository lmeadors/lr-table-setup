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

export function buildGrid(room, effWidth, effDepth) {
  const roomWidthIn = feetToInches(room.width);
  const roomDepthIn = feetToInches(room.depth);
  const cols = Math.floor(roomWidthIn / effWidth);
  const rows = Math.floor(roomDepthIn / effDepth);

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!cellInNotch(room, col, row, cols, rows)) {
        cells.push({ row, col });
      }
    }
  }
  return { cols, rows, cells };
}

function cellInNotch(room, col, row, cols, rows) {
  if (room.shape !== 'l-shape' || !room.notch) return false;

  const notchCols = Math.min(cols, Math.ceil((room.notch.width / room.width) * cols));
  const notchRows = Math.min(rows, Math.ceil((room.notch.depth / room.depth) * rows));

  const inTop = row < notchRows;
  const inBottom = row >= rows - notchRows;
  const inLeft = col < notchCols;
  const inRight = col >= cols - notchCols;

  switch (room.notch.corner) {
    case 'top-left':
      return inTop && inLeft;
    case 'top-right':
      return inTop && inRight;
    case 'bottom-left':
      return inBottom && inLeft;
    case 'bottom-right':
      return inBottom && inRight;
    default:
      return false;
  }
}

export function roomAreaSqFt(room) {
  const area = room.width * room.depth;
  if (room.shape === 'l-shape' && room.notch) {
    return area - room.notch.width * room.notch.depth;
  }
  return area;
}
