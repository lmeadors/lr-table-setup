import { tableCatalog } from './catalog.js';
import { arrange } from './lib/solver.js';
import { renderDiagram, computeScale } from './lib/render.js';
import { roomAreaSqFt } from './lib/geometry.js';
import { themes } from './themes.js';

function applyThemeFromQuery() {
  const themeId = new URLSearchParams(window.location.search).get('theme');
  const theme = themes[themeId];
  if (!theme) return;
  for (const [name, value] of Object.entries(theme.vars)) {
    document.documentElement.style.setProperty(name, value);
  }
}

applyThemeFromQuery();

const tableSelect = document.getElementById('table-type');
const bufferInput = document.getElementById('buffer-override');
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
const presetSelectEl = document.getElementById('preset-select');
const loadPresetBtn = document.getElementById('load-preset');
const presetStatusEl = document.getElementById('preset-status');

let obstacles = [];
let nextObstacleId = 1;
let dragState = null;
let lastStrategy = null;
let lastResult = null;

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
  const tableType = tableCatalog.find((t) => t.id === tableSelect.value);
  const bufferValue = Number(bufferInput.value);
  const buffer = Number.isFinite(bufferValue) && bufferValue >= 0
    ? bufferValue
    : (tableType ? tableType.clearanceBuffer : 0);

  return {
    tableType,
    guestCount: Number(document.getElementById('guest-count').value),
    mode: document.querySelector('input[name="mode"]:checked').value,
    packing: packingSelect.value,
    buffer,
  };
}

function resetBufferToDefault() {
  const tableType = tableCatalog.find((t) => t.id === tableSelect.value);
  if (tableType) {
    bufferInput.value = tableType.clearanceBuffer;
  }
}

function pinnedSeatsTotal() {
  return obstacles.reduce((sum, o) => sum + (o.seats || 0), 0);
}

function pinnedTableCount() {
  return obstacles.filter((o) => o.seats).length;
}

function update() {
  const room = readRoom();
  const { tableType, guestCount, mode, packing, buffer } = readArrangeInputs();

  packingField.hidden = !tableType || tableType.shape !== 'round';

  if (!tableType || !guestCount || !room.width || !room.depth) {
    summaryEl.innerHTML = '';
    renderDiagram(diagramEl, room, tableType, null);
    return;
  }

  const pinnedSeats = pinnedSeatsTotal();
  const pinnedCount = pinnedTableCount();
  const remainingGuestCount = Math.max(0, guestCount - pinnedSeats);

  const result = arrange({ room, tableType, guestCount: remainingGuestCount, mode, packing, buffer, preferredStrategy: lastStrategy });
  lastStrategy = result.strategy;
  lastResult = result;
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
  const { tableType, guestCount, mode, packing, buffer } = readArrangeInputs();
  return {
    room: {
      width: room.width,
      depth: room.depth,
      obstacles: room.obstacles.map(({ x, y, width, depth, label, shape, seats, buffer }) => ({
        x, y, width, depth, label,
        shape: shape === 'round' ? 'round' : 'rect',
        ...(buffer ? { buffer } : {}),
        ...(seats ? { seats } : {}),
      })),
    },
    tableTypeId: tableType ? tableType.id : null,
    guestCount,
    mode,
    packing,
    buffer,
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
    const shape = o.shape === 'round' ? 'round' : 'rect';
    const hasSeats = typeof o.seats === 'number' && o.seats > 0;
    const bufferValue = typeof o.buffer === 'number' && o.buffer >= 0 ? o.buffer : 0;
    parsedObstacles.push({
      id: nextObstacleId++,
      x: o.x,
      y: o.y,
      width: o.width,
      depth: shape === 'round' ? o.width : o.depth,
      label: typeof o.label === 'string' ? o.label : 'Obstacle',
      shape,
      ...(bufferValue > 0 ? { buffer: bufferValue } : {}),
      ...(hasSeats ? { seats: o.seats } : {}),
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
  const buffer = typeof config.buffer === 'number' && config.buffer >= 0
    ? config.buffer
    : tableType.clearanceBuffer;

  document.getElementById('room-width').value = room.width;
  document.getElementById('room-depth').value = room.depth;
  document.getElementById('guest-count').value = config.guestCount;
  tableSelect.value = tableType.id;
  bufferInput.value = buffer;
  document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
  packingSelect.value = packing;

  obstacles = parsedObstacles;
  renderObstacleRows();

  return { ok: true };
}

function setPresetStatus(message, kind) {
  presetStatusEl.textContent = message;
  presetStatusEl.className = `config-status${kind ? ` ${kind}` : ''}`;
}

async function loadPresetManifest() {
  try {
    const response = await fetch('presets/manifest.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    presetSelectEl.innerHTML = manifest
      .map((p) => `<option value="${escapeHtml(p.file)}">${escapeHtml(p.label)}</option>`)
      .join('');
  } catch (err) {
    console.warn('Could not load presets/manifest.json, no starting points available.', err);
    presetSelectEl.innerHTML = '';
  }
}

loadPresetBtn.addEventListener('click', async () => {
  const file = presetSelectEl.value;
  if (!file) {
    setPresetStatus('No starting points available.', 'error');
    return;
  }

  try {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    const result = applyConfig(config);
    if (!result.ok) {
      setPresetStatus(result.error, 'error');
      return;
    }
    setPresetStatus('Loaded.', 'success');
    update();
  } catch (err) {
    setPresetStatus(`Could not load ${file}: ${err.message}`, 'error');
  }
});

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
  obstacleRowsEl.innerHTML = obstacles.map((o) => {
    const isRound = o.shape === 'round';
    return `
    <tr data-id="${o.id}">
      <td><input type="number" step="0.5" min="0" value="${o.x}" data-field="x" /></td>
      <td><input type="number" step="0.5" min="0" value="${o.y}" data-field="y" /></td>
      <td><input type="number" step="0.5" min="0.5" value="${o.width}" data-field="width" /></td>
      <td><input type="number" step="0.5" min="0.5" value="${o.depth}" data-field="depth" ${isRound ? 'disabled title="A round obstacle\'s depth always matches its width (diameter)."' : ''} /></td>
      <td>
        <select data-field="shape">
          <option value="rect"${isRound ? '' : ' selected'}>Rectangle</option>
          <option value="round"${isRound ? ' selected' : ''}>Round</option>
        </select>
      </td>
      <td><input type="number" step="1" min="0" value="${o.buffer || 0}" data-field="buffer" /></td>
      <td><input type="text" value="${escapeHtml(o.label)}" data-field="label" /></td>
      <td><button type="button" class="remove-obstacle" data-id="${o.id}">Remove</button></td>
    </tr>
  `;
  }).join('');
}

function addObstacle(partial) {
  obstacles.push({
    id: nextObstacleId++,
    x: 0,
    y: 0,
    width: 5,
    depth: 5,
    label: 'Obstacle',
    shape: 'rect',
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

  const { tableType, guestCount, mode, packing, buffer } = readArrangeInputs();
  const remainingGuestCount = guestCount ? Math.max(0, guestCount - pinnedSeatsTotal()) : 0;
  const result = tableType && guestCount
    ? arrange({ room, tableType, guestCount: remainingGuestCount, mode, packing, buffer, preferredStrategy: lastStrategy })
    : null;

  renderDiagram(diagramEl, room, tableType, result, preview);
});

diagramEl.addEventListener('click', (event) => {
  const tableEl = event.target.closest('.table');
  if (!tableEl) return;

  const { tableType, buffer: rawBuffer } = readArrangeInputs();
  if (!tableType) return;

  const xFt = Number(tableEl.dataset.x) / 12;
  const yFt = Number(tableEl.dataset.y) / 12;
  const tableWIn = tableType.shape === 'round' ? tableType.dimensions.diameter : tableType.dimensions.width;
  const tableDIn = tableType.shape === 'round' ? tableType.dimensions.diameter : tableType.dimensions.depth;
  const tableWFt = tableWIn / 12;
  const tableDFt = tableDIn / 12;

  // A pinned table is a snapshot of an auto-placed one - it should represent
  // exactly what that table represented a moment ago, not a re-derived
  // default. In spread mode the buffer actually in effect (result.footprint)
  // is usually larger than the raw form input, since spread maximizes
  // spacing beyond the minimum; falling back to the raw input here would
  // silently shrink the table's real clearance the instant it gets pinned.
  const buffer = lastResult
    ? Math.round((lastResult.footprint.width - tableWIn) / 2 * 10) / 10
    : rawBuffer;

  obstacles.push({
    id: nextObstacleId++,
    x: round1(Math.max(0, xFt - tableWFt / 2)),
    y: round1(Math.max(0, yFt - tableDFt / 2)),
    width: round1(tableWFt),
    depth: round1(tableDFt),
    label: `${tableType.label} (pinned)`,
    shape: tableType.shape === 'round' ? 'round' : 'rect',
    seats: tableType.seats,
    buffer,
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
  const row = event.target.closest('tr');
  if (!row) return;
  const obstacle = obstacles.find((o) => o.id === Number(row.dataset.id));
  if (!obstacle) return;

  const field = event.target.dataset.field;
  obstacle[field] = (field === 'label' || field === 'shape') ? event.target.value : Number(event.target.value);

  if (field === 'shape' || (field === 'width' && obstacle.shape === 'round')) {
    obstacle.depth = obstacle.width;
  }

  if (field === 'shape') {
    renderObstacleRows();
  }

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

tableSelect.addEventListener('change', () => {
  resetBufferToDefault();
  update();
});

form.addEventListener('input', update);

async function loadDefaults() {
  try {
    const response = await fetch('defaults.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const defaults = await response.json();
    const result = applyConfig(defaults);
    if (!result.ok) {
      console.warn('defaults.json is invalid, falling back to built-in form defaults:', result.error);
    }
  } catch (err) {
    console.warn('Could not load defaults.json, falling back to built-in form defaults.', err);
  }
}

populateTableCatalog();
resetBufferToDefault();
await Promise.all([loadDefaults(), loadPresetManifest()]);
update();
