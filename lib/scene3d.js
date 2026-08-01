import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {
  WALL_HEIGHT_FT,
  WALL_THICKNESS_FT,
  OBSTACLE_HEIGHT_FT,
  TABLE_TOP_HEIGHT_FT,
  CHAIR_SEAT_FT,
  CHAIR_SEAT_HEIGHT_FT,
  CHAIR_BACK_HEIGHT_FT,
  EYE_HEIGHT_FT,
  PLAYER_RADIUS_FT,
  MOVE_SPEED_FT_PER_SEC,
  computeChairTransforms,
  computeCollisionBodies,
  chairInputForTableType,
  chairInputForPinnedObstacle,
  findSpawnPoint,
  resolveMove,
} from './scene3d-geometry.js';

const TABLETOP_THICKNESS_FT = 0.15;
const LEG_RADIUS_FT = 0.1;

function themeColor(varName, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return new THREE.Color().setStyle(raw || fallback);
}

function buildChair(material) {
  const group = new THREE.Group();

  const seat = new THREE.Mesh(new THREE.BoxGeometry(CHAIR_SEAT_FT, 0.15, CHAIR_SEAT_FT), material);
  seat.position.y = CHAIR_SEAT_HEIGHT_FT;
  group.add(seat);

  // Chair faces local +X by default (toward table center before rotation);
  // the backrest sits behind that, on the local -X edge.
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, CHAIR_BACK_HEIGHT_FT, CHAIR_SEAT_FT), material);
  back.position.set(-CHAIR_SEAT_FT / 2 + 0.05, CHAIR_SEAT_HEIGHT_FT + CHAIR_BACK_HEIGHT_FT / 2, 0);
  group.add(back);

  return group;
}

// shape: 'round' | 'rect'; diameterFt for round, widthFt/depthFt for rect;
// chairInput is the normalized shape computeChairTransforms expects (or null
// to render a bare table with no chairs). Returns a group centered on the
// table's own center, at floor level (y=0) - callers position it in world
// space via group.position.set(x, 0, z).
function buildTable(shape, dims, chairInput, mats) {
  const group = new THREE.Group();

  const topGeo = shape === 'round'
    ? new THREE.CylinderGeometry(dims.diameterFt / 2, dims.diameterFt / 2, TABLETOP_THICKNESS_FT, 32)
    : new THREE.BoxGeometry(dims.widthFt, TABLETOP_THICKNESS_FT, dims.depthFt);
  const top = new THREE.Mesh(topGeo, mats.table);
  top.position.y = TABLE_TOP_HEIGHT_FT;
  group.add(top);

  const legHeight = TABLE_TOP_HEIGHT_FT - TABLETOP_THICKNESS_FT / 2;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(LEG_RADIUS_FT, LEG_RADIUS_FT, legHeight, 12), mats.table);
  leg.position.y = legHeight / 2;
  group.add(leg);

  if (chairInput) {
    for (const chair of computeChairTransforms(chairInput)) {
      const chairGroup = buildChair(mats.chair);
      chairGroup.position.set(chair.x, 0, chair.z);
      // Three.js rotation.y=θ maps local +X to (cosθ,0,-sinθ); chair's
      // facingRad is defined the opposite way round (facing vector =
      // (cos,0,sin)), so the sign flips here.
      chairGroup.rotation.y = -chair.facingRad;
      group.add(chairGroup);
    }
  }

  return group;
}

function buildRoom(scene, room, mats) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.width, room.depth), mats.room);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(room.width / 2, 0, room.depth / 2);
  scene.add(floor);

  const t = WALL_THICKNESS_FT;
  const walls = [
    [-t, room.width + t, -t, 0], // north
    [-t, room.width + t, room.depth, room.depth + t], // south
    [-t, 0, -t, room.depth + t], // west
    [room.width, room.width + t, -t, room.depth + t], // east
  ];
  for (const [x0, x1, z0, z1] of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, WALL_HEIGHT_FT, z1 - z0), mats.wall);
    mesh.position.set((x0 + x1) / 2, WALL_HEIGHT_FT / 2, (z0 + z1) / 2);
    scene.add(mesh);
  }
}

function buildObstacles(scene, room, mats) {
  for (const o of room.obstacles || []) {
    if (o.seats > 0) {
      const shape = o.shape === 'round' ? 'round' : 'rect';
      const group = buildTable(shape, { diameterFt: o.width, widthFt: o.width, depthFt: o.depth }, chairInputForPinnedObstacle(o), mats);
      group.position.set(o.x + o.width / 2, 0, o.y + o.depth / 2);
      scene.add(group);
      continue;
    }
    const mesh = o.shape === 'round'
      ? new THREE.Mesh(new THREE.CylinderGeometry(o.width / 2, o.width / 2, OBSTACLE_HEIGHT_FT, 24), mats.obstacle)
      : new THREE.Mesh(new THREE.BoxGeometry(o.width, OBSTACLE_HEIGHT_FT, o.depth), mats.obstacle);
    mesh.position.set(o.x + o.width / 2, OBSTACLE_HEIGHT_FT / 2, o.y + o.depth / 2);
    scene.add(mesh);
  }
}

function buildAutoTables(scene, tableType, result, mats) {
  if (!result || !tableType) return;
  const chairInput = chairInputForTableType(tableType, result.footprint);
  const shape = tableType.shape === 'round' ? 'round' : 'rect';
  const dims = shape === 'round'
    ? { diameterFt: tableType.dimensions.diameter / 12 }
    : { widthFt: tableType.dimensions.width / 12, depthFt: tableType.dimensions.depth / 12 };
  for (const t of result.tables) {
    const group = buildTable(shape, dims, chairInput, mats);
    group.position.set(t.x / 12, 0, t.y / 12);
    scene.add(group);
  }
}

function disposeObject(obj) {
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
  }
}

// container: DOM element the canvas/HUD prompt mount into.
// room/tableType/result: same three inputs renderDiagram already takes.
// Returns { dispose() } - stops the render loop, removes listeners, exits
// pointer lock, and clears everything this call added to `container`.
export function openWalkthrough(container, room, tableType, result) {
  const mats = {
    room: new THREE.MeshStandardMaterial({ color: themeColor('--ts-room-fill', '#f5f5f5'), side: THREE.DoubleSide }),
    wall: new THREE.MeshStandardMaterial({ color: themeColor('--ts-room-stroke', '#333333') }),
    table: new THREE.MeshStandardMaterial({ color: themeColor('--ts-table-fill', '#7aa6c2') }),
    chair: new THREE.MeshStandardMaterial({ color: themeColor('--ts-table-stroke', '#2c4a5e') }),
    obstacle: new THREE.MeshStandardMaterial({ color: themeColor('--ts-obstacle-fill', '#d98c8c') }),
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c10);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(room.width * 0.3, 30, room.depth * 0.3);
  scene.add(sun);

  buildRoom(scene, room, mats);
  buildObstacles(scene, room, mats);
  buildAutoTables(scene, tableType, result, mats);

  const colliders = computeCollisionBodies(room, tableType, result);
  const spawn = findSpawnPoint(room, colliders, PLAYER_RADIUS_FT);

  const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 500);
  camera.position.set(spawn.x, EYE_HEIGHT_FT, spawn.z);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  container.appendChild(renderer.domElement);

  const controls = new PointerLockControls(camera, renderer.domElement);

  const promptEl = document.createElement('div');
  promptEl.className = 'walkthrough-lock-prompt';
  promptEl.textContent = 'Click to enable mouse-look';
  container.appendChild(promptEl);

  const onCanvasClick = () => controls.lock();
  renderer.domElement.addEventListener('click', onCanvasClick);
  const onLock = () => { promptEl.hidden = true; };
  const onUnlock = () => { promptEl.hidden = false; };
  controls.addEventListener('lock', onLock);
  controls.addEventListener('unlock', onUnlock);

  const move = { forward: false, back: false, left: false, right: false };
  function setMoveState(code, value) {
    if (code === 'KeyW' || code === 'ArrowUp') move.forward = value;
    if (code === 'KeyS' || code === 'ArrowDown') move.back = value;
    if (code === 'KeyA' || code === 'ArrowLeft') move.left = value;
    if (code === 'KeyD' || code === 'ArrowRight') move.right = value;
  }
  const onKeyDown = (e) => setMoveState(e.code, true);
  const onKeyUp = (e) => setMoveState(e.code, false);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const timer = new THREE.Timer();
  timer.connect(document);

  const rightVec = new THREE.Vector3();
  const forwardVec = new THREE.Vector3();
  const moveVec = new THREE.Vector3();

  let disposed = false;
  let rafId = null;

  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    timer.update();
    const dt = timer.getDelta();

    if (controls.isLocked) {
      // Same column-0/cross-product derivation PointerLockControls itself
      // uses for moveForward()/moveRight(), so WASD tracks the look
      // direction exactly the way the library's own API would move it -
      // reimplemented (not called directly) because moveForward/moveRight
      // apply the move immediately, bypassing collision.
      rightVec.setFromMatrixColumn(camera.matrix, 0);
      forwardVec.crossVectors(camera.up, rightVec);

      moveVec.set(0, 0, 0);
      if (move.forward) moveVec.add(forwardVec);
      if (move.back) moveVec.sub(forwardVec);
      if (move.right) moveVec.add(rightVec);
      if (move.left) moveVec.sub(rightVec);
      if (moveVec.lengthSq() > 0) {
        moveVec.normalize().multiplyScalar(MOVE_SPEED_FT_PER_SEC * dt);
      }

      const next = resolveMove(
        { x: camera.position.x, z: camera.position.z },
        { x: moveVec.x, z: moveVec.z },
        colliders,
        PLAYER_RADIUS_FT,
      );
      camera.position.x = next.x;
      camera.position.z = next.z;
    }

    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(animate);

  function handleResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', handleResize);

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId != null) cancelAnimationFrame(rafId);

    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', handleResize);
    renderer.domElement.removeEventListener('click', onCanvasClick);
    controls.removeEventListener('lock', onLock);
    controls.removeEventListener('unlock', onUnlock);

    if (controls.isLocked) controls.unlock();
    controls.dispose();
    timer.dispose();

    scene.traverse(disposeObject);
    renderer.dispose();

    if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    if (promptEl.parentNode === container) container.removeChild(promptEl);
  }

  return { dispose };
}
