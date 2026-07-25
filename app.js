import { tableCatalog } from './catalog.js';
import { arrange } from './lib/solver.js';
import { renderDiagram } from './lib/render.js';
import { roomAreaSqFt } from './lib/geometry.js';

const shapeSelect = document.getElementById('room-shape');
const notchFields = document.getElementById('notch-fields');
const tableSelect = document.getElementById('table-type');
const packingField = document.getElementById('packing-field');
const packingSelect = document.getElementById('packing');
const form = document.getElementById('arrange-form');
const summaryEl = document.getElementById('summary');
const diagramEl = document.getElementById('diagram');

function populateTableCatalog() {
  tableSelect.innerHTML = tableCatalog
    .map((t) => `<option value="${t.id}">${t.label}</option>`)
    .join('');
}

function readRoom() {
  const shape = shapeSelect.value;
  const room = {
    shape,
    width: Number(document.getElementById('room-width').value),
    depth: Number(document.getElementById('room-depth').value),
  };
  if (shape === 'l-shape') {
    room.notch = {
      width: Number(document.getElementById('notch-width').value),
      depth: Number(document.getElementById('notch-depth').value),
      corner: document.getElementById('notch-corner').value,
    };
  }
  return room;
}

function update() {
  const room = readRoom();
  const tableType = tableCatalog.find((t) => t.id === tableSelect.value);
  const guestCount = Number(document.getElementById('guest-count').value);
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const packing = packingSelect.value;

  packingField.hidden = !tableType || tableType.shape !== 'round';

  if (!tableType || !guestCount || !room.width || !room.depth) {
    summaryEl.innerHTML = '';
    diagramEl.innerHTML = '';
    return;
  }

  const result = arrange({ room, tableType, guestCount, mode, packing });
  const roomArea = roomAreaSqFt(room);
  const areaUsed = result.tableCount * (result.footprint.width * result.footprint.depth) / 144;

  summaryEl.innerHTML = `
    <p>${result.tableCount} &times; ${tableType.label}</p>
    <p>${result.seatsAchieved} of ${guestCount} guests seated${
      result.seatsShort > 0 ? ` &mdash; short ${result.seatsShort}` : ''
    }</p>
    <p>Room area: ${roomArea.toFixed(0)} sq ft &middot; used: ${areaUsed.toFixed(0)} sq ft &middot; remaining: ${(roomArea - areaUsed).toFixed(0)} sq ft</p>
  `;

  renderDiagram(diagramEl, room, tableType, result);
}

shapeSelect.addEventListener('change', () => {
  notchFields.hidden = shapeSelect.value !== 'l-shape';
  update();
});

form.addEventListener('input', update);

populateTableCatalog();
notchFields.hidden = shapeSelect.value !== 'l-shape';
update();
