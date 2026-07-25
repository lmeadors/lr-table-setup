import { tableCatalog } from './catalog.js';
import { arrange } from './lib/solver.js';
import { renderDiagram, computeScale } from './lib/render.js';
import { roomAreaSqFt, effectiveFootprint } from './lib/geometry.js';

const tableSelect = document.getElementById('table-type');
const packingField = document.getElementById('packing-field');
const packingSelect = document.getElementById('packing');
const form = document.getElementById('arrange-form');
const summaryEl = document.getElementById('summary');
const diagramEl = document.getElementById('diagram');
const obstacleRowsEl = document.getElementById('obstacle-rows');
const addObstacleBtn = document.getElementById('add-obstacle');
const configJsonEl = document.getElementById('config-json');
const loadConfigBtn = document.getElementById('load-config');
const configStatusEl = document.getElementById('config-status');

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

function pinnedSeatsTotal() {
  return obstacles.reduce((sum, o) => sum + (o.seats || 0), 0);
}

function pinnedTableCount() {
  return obstacles.filter((o) => o.seats).length;
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

  const pinnedSeats = pinnedSeatsTotal();
  const pinnedCount = pinnedTableCount();
  const remainingGuestCount = Math.max(0, guestCount - pinnedSeats);

  const result = arrange({ room, tableType, guestCount: remainingGuestCount, mode, packing });
  const roomArea = roomAreaSqFt(room);
  const areaUsed = (result.tableCount * (result.footprint.width * result.footprint.depth)) / 144;

  const totalTableCount = result.tableCount + pinnedCount;
  const totalSeatsAchieved = result.seatsAchieved + pinnedSeats;
  const seatsShort = Math.max(0, guestCount - totalSeatsAchieved);

  summaryEl.innerHTML = `
    <p>${totalTableCount} &times; ${tableType.label}${pinnedCount > 0 ? ` (${pinnedCount} pinned)` : ''}</p>
    <p>${totalSeatsAchieved} of ${guestCount} guests seated${
      seatsShort > 0 ? ` &mdash; short ${seatsShort}` : ''
    }</p>
    <p>Room area: ${roomArea.toFixed(0)} sq ft &middot; used: ${areaUsed.toFixed(0)} sq ft &middot; remaining: ${(roomArea - areaUsed).toFixed(0)} sq ft</p>
  `;

  renderDiagram(diagramEl, room, tableType, result);
  syncConfigJson();
}

function currentConfig() {
  const room = readRoom();
  const { tableType, guestCount, mode, packing } = readArrangeInputs();
  return {
    room: {
      width: room.width,
      depth: room.depth,
      obstacles: room.obstacles.map(({ x, y, width, depth, label, seats }) => ({
        x, y, width, depth, label,
        ...(seats ? { seats } : {}),
      })),
    },
    tableTypeId: tableType ? tableType.id : null,
    guestCount,
    mode,
    packing,
  };
}

function syncConfigJson() {
  if (document.activeElement === configJsonEl) return;
  configJsonEl.value = JSON.stringify(currentConfig(), null, 2);
}

function setConfigStatus(message, kind) {
  configStatusEl.textContent = message;
  configStatusEl.className = `config-status${kind ? ` ${kind}` : ''}`;
}

function applyConfig(config) {
  if (!config || typeof config !== 'object') {
    return { ok: false, error: 'Config must be a JSON object.' };
  }

  const room = config.room;
  if (!room || typeof room.width !== 'number' || typeof room.depth !== 'number' || room.width <= 0 || room.depth <= 0) {
    return { ok: false, error: 'room.width and room.depth must be positive numbers.' };
  }

  const rawObstacles = Array.isArray(room.obstacles) ? room.obstacles : [];
  const parsedObstacles = [];
  for (const o of rawObstacles) {
    if (
      !o || typeof o !== 'object' ||
      typeof o.x !== 'number' || typeof o.y !== 'number' ||
      typeof o.width !== 'number' || typeof o.depth !== 'number'
    ) {
      return { ok: false, error: 'Each obstacle needs numeric x, y, width, depth.' };
    }
    parsedObstacles.push({
      id: nextObstacleId++,
      x: o.x,
      y: o.y,
      width: o.width,
      depth: o.depth,
      label: typeof o.label === 'string' ? o.label : 'Obstacle',
      ...(typeof o.seats === 'number' && o.seats > 0 ? { seats: o.seats } : {}),
    });
  }

  const tableType = tableCatalog.find((t) => t.id === config.tableTypeId);
  if (!tableType) {
    return { ok: false, error: `Unknown tableTypeId: ${JSON.stringify(config.tableTypeId)}` };
  }

  if (typeof config.guestCount !== 'number' || config.guestCount <= 0) {
    return { ok: false, error: 'guestCount must be a positive number.' };
  }

  const mode = config.mode === 'spread' ? 'spread' : 'compact';
  const packing = ['square', 'hex'].includes(config.packing) ? config.packing : 'auto';

  document.getElementById('room-width').value = room.width;
  document.getElementById('room-depth').value = room.depth;
  document.getElementById('guest-count').value = config.guestCount;
  tableSelect.value = tableType.id;
  document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
  packingSelect.value = packing;

  obstacles = parsedObstacles;
  renderObstacleRows();

  return { ok: true };
}

loadConfigBtn.addEventListener('click', () => {
  let parsed;
  try {
    parsed = JSON.parse(configJsonEl.value);
  } catch (err) {
    setConfigStatus(`Invalid JSON: ${err.message}`, 'error');
    return;
  }

  const result = applyConfig(parsed);
  if (!result.ok) {
    setConfigStatus(result.error, 'error');
    return;
  }

  setConfigStatus('Loaded.', 'success');
  update();
});

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
  if (event.target.closest('.table')) return;

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
  const remainingGuestCount = guestCount ? Math.max(0, guestCount - pinnedSeatsTotal()) : 0;
  const result = tableType && guestCount
    ? arrange({ room, tableType, guestCount: remainingGuestCount, mode, packing })
    : null;

  renderDiagram(diagramEl, room, tableType, result, preview);
});

diagramEl.addEventListener('click', (event) => {
  const tableEl = event.target.closest('.table');
  if (!tableEl) return;

  const { tableType } = readArrangeInputs();
  if (!tableType) return;

  const footprint = effectiveFootprint(tableType);
  const xFt = Number(tableEl.dataset.x) / 12;
  const yFt = Number(tableEl.dataset.y) / 12;
  const wFt = footprint.width / 12;
  const dFt = footprint.depth / 12;

  obstacles.push({
    id: nextObstacleId++,
    x: round1(Math.max(0, xFt - wFt / 2)),
    y: round1(Math.max(0, yFt - dFt / 2)),
    width: round1(wFt),
    depth: round1(dFt),
    label: `${tableType.label} (pinned)`,
    seats: tableType.seats,
  });
  renderObstacleRows();
  update();
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
