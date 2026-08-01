// clearanceBuffer is either a single number (applied equally to both axes -
// used for round tables, where there's no distinction) or a { width, depth }
// object keyed to match `dimensions` directly. Rectangular tables only seat
// guests along their long edges, so the axis that separates those edges
// (chair-pushback clearance) can need a very different buffer than the axis
// that separates the unseated short ends (just walking clearance). Keying by
// dimension name rather than by "side"/"end" means a rotated entry - which
// swaps which physical dimension is width vs. depth - just swaps the two
// numbers too, instead of needing separate geometry-code handling.
export const tableCatalog = [
  {
    id: 'round-60',
    label: '60" Round (seats 8)',
    shape: 'round',
    dimensions: { diameter: 60 },
    seats: 8,
    clearanceBuffer: 30,
  },
  {
    id: 'round-72',
    label: '72" Round (seats 10)',
    shape: 'round',
    dimensions: { diameter: 72 },
    seats: 10,
    clearanceBuffer: 30,
  },
  {
    id: 'rect-8ft',
    label: '8ft Rectangular (seats 8)',
    shape: 'rectangular',
    dimensions: { width: 96, depth: 30 },
    seats: 8,
    clearanceBuffer: { width: 12, depth: 24 },
  },
  {
    id: 'rect-8ft-rotated',
    label: '8ft Rectangular, rotated (seats 8)',
    shape: 'rectangular',
    dimensions: { width: 30, depth: 96 },
    seats: 8,
    clearanceBuffer: { width: 24, depth: 12 },
  },
  {
    id: 'rect-6ft',
    label: '6ft Rectangular (seats 6)',
    shape: 'rectangular',
    dimensions: { width: 72, depth: 30 },
    seats: 6,
    clearanceBuffer: { width: 12, depth: 24 },
  },
  {
    id: 'rect-6ft-rotated',
    label: '6ft Rectangular, rotated (seats 6)',
    shape: 'rectangular',
    dimensions: { width: 30, depth: 72 },
    seats: 6,
    clearanceBuffer: { width: 24, depth: 12 },
  },
];
