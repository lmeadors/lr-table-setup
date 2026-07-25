import { tableCatalog } from './catalog.js';
import { arrange } from './lib/solver.js';
import { renderDiagram, computeScale } from './lib/render.js';
import { roomAreaSqFt } from './lib/geometry.js';

const tableSelect = document.getElementById('table-type');
const packingField = document.getElementById('packing-field');
const packingSelect = document.getElementById('packing');
const form = document.getElementById('arrange-form');
const summaryEl = document.getElementById('summary');
const diagramEl = document.getElementById('diagram');
const obstacleRowsEl = document.getElementById('obstacle-rows');
const addObstacleBtn = document.getElementById('add-obstacle');

let obstacles = [];
let nextObstacleId = 1;
let dragState = null;

function populateTableCatalog() {
  tableSelect.innerHTML = tableCatalog
    .map((t) => `<option value="${t.id}">${t.label}</option>`)
    .join('');
}

function readRoom() {
  return {
    width: Number(document.getElementById('room-width').value),
    depth: Number(document.getElementById('room-depth').value),
    obstacles,
  };
}

function readArrangeInputs() {
  return {
    tableType: tableCatalog.find((t) => t.id === tableSelect.value),
    guestCount: Number(document.getElementById('guest-count').value),
    mode: document.querySelector('input[name="mode"]:checked').value,
    packing: packingSelect.value,
  };
}

function update() {
  const room = readRoom();
  const { tableType, guestCount, mode, packing } = readArrangeInputs();

  packingField.hidden = !tableType || tableType.shape !== 'round';

  if (!tableType || !guestCount || !room.width || !room.depth) {
    summaryEl.innerHTML = '';
    renderDiagram(diagramEl, room, tableType, null);
    return;
  }

  const result = arrange({ room, tableType, guestCount, mode, packing });
  const roomArea = roomAreaSqFt(room);
  const areaUsed = (result.tableCount * (result.footprint.width * result.footprint.depth)) / 144;

  summaryEl.innerHTML = `
    <p>${result.tableCount} &times; ${tableType.label}</p>
    <p>${result.seatsAchieved} of ${guestCount} guests seated${
      result.seatsShort > 0 ? ` &mdash; short ${result.seatsShort}` : ''
    }</p>
    <p>Room area: ${roomArea.toFixed(0)} sq ft &middot; used: ${areaUsed.toFixed(0)} sq ft &middot; remaining: ${(roomArea - areaUsed).toFixed(0)} sq ft</p>
  `;

  renderDiagram(diagramEl, room, tableType, result);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function renderObstacleRows() {
  obstacleRowsEl.innerHTML = obstacles.map((o) => `
    <div class="obstacle-row" data-id="${o.id}">
      <label>X (ft)<input type="number" step="0.5" min="0" value="${o.x}" data-field="x" /></label>
      <label>Y (ft)<input type="number" step="0.5" min="0" value="${o.y}" data-field="y" /></label>
      <label>Width (ft)<input type="number" step="0.5" min="0.5" value="${o.width}" data-field="width" /></label>
      <label>Depth (ft)<input type="number" step="0.5" min="0.5" value="${o.depth}" data-field="depth" /></label>
      <label>Label<input type="text" value="${escapeHtml(o.label)}" data-field="label" /></label>
      <button type="button" class="remove-obstacle" data-id="${o.id}">Remove</button>
    </div>
  `).join('');
}

function addObstacle(partial) {
  obstacles.push({
    id: nextObstacleId++,
    x: 0,
    y: 0,
    width: 5,
    depth: 5,
    label: 'Obstacle',
    ...partial,
  });
  renderObstacleRows();
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function normalizeDragRect(x0, y0, x1, y1, room) {
  const left = Math.max(0, Math.min(x0, x1));
  const top = Math.max(0, Math.min(y0, y1));
  const right = Math.min(room.width, Math.max(x0, x1));
  const bottom = Math.min(room.depth, Math.max(y0, y1));
  return {
    x: round1(left),
    y: round1(top),
    width: round1(Math.max(0, right - left)),
    depth: round1(Math.max(0, bottom - top)),
  };
}

function pointerToFeet(event, room, scale, containerRect) {
  return {
    xFt: (event.clientX - containerRect.left) / scale / 12,
    yFt: (event.clientY - containerRect.top) / scale / 12,
  };
}

diagramEl.addEventListener('pointerdown', (event) => {
  const room = readRoom();
  if (!room.width || !room.depth) return;

  const svg = diagramEl.querySelector('svg');
  if (!svg) return;

  const containerRect = svg.getBoundingClientRect();
  const scale = computeScale(room);
  const { xFt, yFt } = pointerToFeet(event, room, scale, containerRect);

  dragState = { room, scale, containerRect, startXFt: xFt, startYFt: yFt };
  diagramEl.setPointerCapture(event.pointerId);
});

diagramEl.addEventListener('pointermove', (event) => {
  if (!dragState) return;
  const { room, scale, containerRect, startXFt, startYFt } = dragState;
  const { xFt, yFt } = pointerToFeet(event, room, scale, containerRect);
  const preview = normalizeDragRect(startXFt, startYFt, xFt, yFt, room);

  const { tableType, guestCount, mode, packing } = readArrangeInputs();
  const result = tableType && guestCount
    ? arrange({ room, tableType, guestCount, mode, packing })
    : null;

  renderDiagram(diagramEl, room, tableType, result, preview);
});

diagramEl.addEventListener('pointerup', (event) => {
  if (!dragState) return;
  const { room, scale, containerRect, startXFt, startYFt } = dragState;
  const { xFt, yFt } = pointerToFeet(event, room, scale, containerRect);
  const rect = normalizeDragRect(startXFt, startYFt, xFt, yFt, room);
  dragState = null;

  if (rect.width >= 0.5 && rect.depth >= 0.5) {
    addObstacle(rect);
  }
  update();
});

obstacleRowsEl.addEventListener('input', (event) => {
  const row = event.target.closest('.obstacle-row');
  if (!row) return;
  const obstacle = obstacles.find((o) => o.id === Number(row.dataset.id));
  if (!obstacle) return;

  const field = event.target.dataset.field;
  obstacle[field] = field === 'label' ? event.target.value : Number(event.target.value);
  update();
});

obstacleRowsEl.addEventListener('click', (event) => {
  if (!event.target.classList.contains('remove-obstacle')) return;
  obstacles = obstacles.filter((o) => o.id !== Number(event.target.dataset.id));
  renderObstacleRows();
  update();
});

addObstacleBtn.addEventListener('click', () => {
  addObstacle({});
  update();
});

form.addEventListener('input', update);

populateTableCatalog();
update();
