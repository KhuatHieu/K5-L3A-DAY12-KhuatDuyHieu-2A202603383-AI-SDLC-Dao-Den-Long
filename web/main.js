// Browser renderer. All gameplay runs in src/sim.js at a fixed 60 Hz; this file only draws + reads input.
import * as THREE from 'three';
import { configure, createGame, step, drainEvents, timeLeft, EXTRA, mulberry32 } from '../src/sim.js';

const contract = await (await fetch('/game.contract.json')).json();
configure(contract.tuning);
const T = contract.tuning;
const $ = (id) => document.getElementById(id);

// ---------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const NIGHT = new THREE.Color(0x120822), DAWNISH = new THREE.Color(0x3a2a55);
scene.background = NIGHT.clone();
scene.fog = new THREE.FogExp2(0x1a0b2e, 0.035);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
const hemi = new THREE.HemisphereLight(0x6a5a9a, 0x1a1020, 0.9);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9fa8ff, 0.35);
moon.position.set(-30, 50, -20);
scene.add(moon);

// ---------- static world (visual only)
const island = new THREE.Group();
const top = new THREE.Mesh(new THREE.CylinderGeometry(EXTRA.island_radius, EXTRA.island_radius - 2, 2, 64),
  new THREE.MeshStandardMaterial({ color: 0x2e4a3a, roughness: 1 }));
top.position.y = -1;
const rock = new THREE.Mesh(new THREE.ConeGeometry(EXTRA.island_radius - 2, 26, 32),
  new THREE.MeshStandardMaterial({ color: 0x3a2f45, roughness: 1, flatShading: true }));
rock.rotation.x = Math.PI; rock.position.y = -15;
island.add(top, rock);
scene.add(island);
// sea of clouds
const cloudMat = new THREE.MeshStandardMaterial({ color: 0x4a3a6e, roughness: 1, flatShading: true });
const deco = mulberry32(7); // decorative randomness, independent of gameplay RNG
for (let i = 0; i < 70; i++) {
  const a = deco() * Math.PI * 2, r = 50 + deco() * 90;
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + deco() * 7, 0), cloudMat);
  m.position.set(Math.cos(a) * r, -12 - deco() * 8, Math.sin(a) * r);
  m.scale.y = 0.45;
  scene.add(m);
}
// trees & stones (decor; avoid lantern ring)
const treeMat = new THREE.MeshStandardMaterial({ color: 0x1f3b33, flatShading: true });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2a20 });
for (let i = 0; i < 28; i++) {
  const a = deco() * Math.PI * 2, r = 28 + deco() * 10;
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.4), trunkMat); trunk.position.y = 0.7;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.2 + deco(), 3 + deco() * 2, 7), treeMat); crown.position.y = 3;
  t.add(trunk, crown);
  t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  scene.add(t);
}
// cloud whales — creative, visual-only (never in sim/headless)
const whales = [];
for (let i = 0; i < 3; i++) {
  const w = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), new THREE.MeshStandardMaterial({ color: 0x8f86c9, emissive: 0x2a2050, flatShading: true }));
  body.scale.set(2.2, 0.9, 1);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 6), body.material);
  tail.rotation.z = Math.PI / 2; tail.position.x = -7.5;
  w.add(body, tail);
  scene.add(w);
  whales.push({ w, r: 60 + i * 18, sp: 0.04 + i * 0.015, ph: i * 2.1 });
}

// ---------- Mây (player)
const may = new THREE.Group();
const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 12), new THREE.MeshStandardMaterial({ color: 0x5b7fc7 }));
robe.position.y = 0.65;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf3cfa8 }));
head.position.y = 1.5;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0xe0c27a, flatShading: true })); // nón lá
hat.position.y = 1.85;
const tinyLantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a1e, emissiveIntensity: 2 }));
tinyLantern.position.set(0, 1.45, 0.82);
const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), new THREE.MeshBasicMaterial({ color: 0x222222 }));
string.position.set(0, 1.62, 0.82);
may.add(robe, head, hat, tinyLantern, string);
const mayLight = new THREE.PointLight(0xffa64d, 6, 9, 1.6);
mayLight.position.y = 1.6;
may.add(mayLight);
scene.add(may);

// ---------- dynamic meshes
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,230,150,1)'); gr.addColorStop(0.3, 'rgba(255,190,90,.6)'); gr.addColorStop(1, 'rgba(255,160,60,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false });

let lanternViews = [], moteViews = new Map(), shadeViews = new Map();
function buildLanterns(g) {
  for (const v of lanternViews) scene.remove(v.group);
  lanternViews = g.lanterns.map((L) => {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2), new THREE.MeshStandardMaterial({ color: 0x4a3326 }));
    pole.position.y = 1.6;
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x6a3a2a, emissive: 0xff7a1a, emissiveIntensity: 0.05 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 12), lampMat);
    lamp.position.y = 3.6;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x8a2a1a }));
    roof.position.y = 4.4;
    const light = new THREE.PointLight(0xffa040, 0, 26, 1.4);
    light.position.y = 3.6;
    const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 64),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    const prog = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.3, 32, 1, 0, 0.001),
      new THREE.MeshBasicMaterial({ color: 0xffd28a, side: THREE.DoubleSide }));
    prog.rotation.x = -Math.PI / 2; prog.position.y = 0.04;
    group.add(pole, lamp, roof, light, ring, prog);
    group.position.set(L.pos[0], 0, L.pos[2]);
    scene.add(group);
    return { group, lampMat, light, ring, prog, lastDep: -1 };
  });
}
function moteView() {
  const s = new THREE.Sprite(glowMat); s.scale.setScalar(0.9);
  scene.add(s); return s;
}
function shadeView() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a0828, emissive: 0x3a0f5a, emissiveIntensity: 0.6, roughness: 0.3, flatShading: true });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), mat);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xd9b3ff });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1), eyeM), e2 = e1.clone();
  e1.position.set(0.25, 0.2, 0.75); e2.position.set(-0.25, 0.2, 0.75);
  g.add(body, e1, e2);
  scene.add(g);
  return { g, body, mat };
}

// pulse rings fx
const fx = [];
function pulseFx(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos[0], 0.2, pos[2]);
  scene.add(m); fx.push({ m, t: 0 });
}

// ---------- audio (synthesized, no external files)
let actx = null;
function beep(freq, dur = 0.12, type = 'sine', vol = 0.15, slide = 0) {
  if (!actx) return;
  const o = actx.createOscillator(), gn = actx.createGain(), t0 = actx.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(gn).connect(actx.destination); o.start(t0); o.stop(t0 + dur);
}
const SFX = {
  mote_picked: () => beep(880 + Math.random() * 200, 0.1, 'sine', 0.08, 1.5),
  deposit: () => beep(440, 0.2, 'triangle', 0.12, 1.3),
  lantern_lit: () => { beep(523, 0.4, 'triangle', 0.15); setTimeout(() => beep(784, 0.6, 'triangle', 0.15), 120); },
  pulse: () => beep(300, 0.5, 'sine', 0.2, 3),
  player_hit: () => beep(160, 0.35, 'sawtooth', 0.1, 0.5),
  shade_spawned: () => beep(90, 0.6, 'square', 0.04, 0.7),
};

// ---------- input
const keys = new Set();
let camYaw = 0, dragging = false, lastX = 0;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (!actx) actx = new AudioContext();
  if (mode !== 'play' && (e.code === 'Enter' || e.code === 'KeyR' || e.code === 'Space')) newGame();
  else if (e.code === 'KeyR') newGame();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => { if (dragging) { camYaw -= (e.clientX - lastX) * 0.3; lastX = e.clientX; } });
$('overlay').addEventListener('click', () => { if (!actx) actx = new AudioContext(); newGame(); });

function readFrame() {
  const k = (c) => keys.has(c);
  const z = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  const x = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0); // screen-right is −x at yaw 0 (see README)
  return { move: [x, z], cam_yaw_deg: camYaw, jump: k('Space'), interact: k('KeyE'), pulse: k('KeyQ') };
}

// ---------- game state
let g = null, mode = 'menu', seed = (Date.now() & 0x7fffffff);
function newGame() {
  g = createGame({ seed: seed++ });
  buildLanterns(g);
  for (const v of moteViews.values()) scene.remove(v); moteViews.clear();
  for (const v of shadeViews.values()) scene.remove(v.g); shadeViews.clear();
  mode = 'play';
  $('overlay').style.display = 'none';
  acc = 0;
}
function showOverlay(title, body, key) {
  $('overlay').innerHTML = `<h1>${title}</h1><p>${body}</p><div class="k">${key}</div>`;
  $('overlay').style.display = 'flex';
}
showOverlay('Đảo Đèn Lồng',
  'Đêm nay sương đen đã nuốt hết ánh sáng của Đảo Bến. Hãy giúp <b>Mây</b> gom đom đóm và thắp lại <b>5 Đèn Lồng Lớn</b> trước bình minh. ' +
  'Coi chừng <b>Bóng Mực</b> — chúng sợ ánh đèn.',
  'Nhấn Enter hoặc bấm chuột để bắt đầu');

// ---------- loop
let acc = 0, last = performance.now(), facing = 0, flashT = 0;
function sync(dt, now) {
  const p = g.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const [mx, mz] = g.input.move;
  if (mx || mz) {
    const th = (g.input.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th), wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const target = Math.atan2(wx, wz);
    let d = target - facing; d = Math.atan2(Math.sin(d), Math.cos(d));
    facing += d * Math.min(1, dt * 12);
  }
  may.rotation.y = facing;
  mayLight.intensity = 4 + p.carried * 1.5;
  mayLight.distance = 7 + p.carried * 1.2;
  may.visible = !(p.invuln > 0 && Math.floor(now / 80) % 2);

  // lanterns
  let lit = 0;
  g.lanterns.forEach((L, i) => {
    const v = lanternViews[i];
    v.group.position.set(L.pos[0], 0, L.pos[2]);
    if (L.lit) lit++;
    const k = L.lit ? 1 : L.deposited / T.lantern_cost;
    v.light.intensity += ((L.lit ? 40 : k * 6) - v.light.intensity) * Math.min(1, dt * 3);
    v.lampMat.emissiveIntensity = L.lit ? 2.2 + Math.sin(now / 300 + i) * 0.2 : 0.05 + k * 0.6;
    v.ring.material.opacity = L.lit ? 0.35 : 0;
    if (v.lastDep !== L.deposited) {
      v.lastDep = L.deposited;
      v.prog.geometry.dispose();
      v.prog.geometry = new THREE.RingGeometry(1.0, 1.3, 32, 1, 0, Math.max(0.001, Math.min(1, k) * Math.PI * 2));
    }
  });
  // island brightens as lanterns are lit
  const f = lit / T.lantern_count_night1;
  scene.fog.density = 0.035 - f * 0.022;
  scene.background.copy(NIGHT).lerp(DAWNISH, f);
  scene.fog.color.copy(scene.background);
  hemi.intensity = 0.9 + f * 0.9;

  // motes
  const seen = new Set();
  for (const m of g.motes) {
    seen.add(m.id);
    let s = moteViews.get(m.id);
    if (!s) { s = moteView(); moteViews.set(m.id, s); }
    const ph = parseInt(m.id.slice(1), 10);
    s.position.set(m.pos[0] + Math.sin(now / 700 + ph) * 0.2, 0.9 + Math.sin(now / 400 + ph) * 0.25, m.pos[2] + Math.cos(now / 800 + ph) * 0.2);
  }
  for (const [id, s] of moteViews) if (!seen.has(id)) { scene.remove(s); moteViews.delete(id); }
  // shades
  const seenS = new Set();
  for (const s of g.shades) {
    seenS.add(s.id);
    let v = shadeViews.get(s.id);
    if (!v) { v = shadeView(); shadeViews.set(s.id, v); }
    v.g.position.set(s.pos[0], s.pos[1] + Math.sin(now / 250 + s.id.length) * 0.15, s.pos[2]);
    v.g.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    const stunned = s.stun > 0;
    v.mat.emissive.setHex(stunned ? 0x8a8aa0 : 0x3a0f5a);
    v.g.scale.setScalar(stunned ? 0.7 : 1 + Math.sin(now / 180) * 0.05);
  }
  for (const [id, v] of shadeViews) if (!seenS.has(id)) { scene.remove(v.g); shadeViews.delete(id); }

  // camera
  const th = (camYaw * Math.PI) / 180;
  const fx_ = Math.sin(th), fz = Math.cos(th);
  camera.position.lerp(new THREE.Vector3(p.pos[0] - fx_ * 9, p.pos[1] + 5.5, p.pos[2] - fz * 9), Math.min(1, dt * 8));
  camera.lookAt(p.pos[0], p.pos[1] + 1.4, p.pos[2]);

  // HUD
  const tl = timeLeft(g), mm = Math.floor(tl / 60), ss = Math.floor(tl % 60);
  const cdk = 1 - p.pulseCd / Math.round(T.pulse_cooldown_s * 60);
  $('hud').innerHTML =
    `Ngọn lửa: <b>${'🔥'.repeat(Math.max(0, p.flames))}</b><br>` +
    `Đom đóm: <b>${p.carried}/${T.carry_capacity}</b><br>` +
    `Đèn đã thắp: <b>${lit}/${T.lantern_count_night1}</b><br>` +
    `Bình minh sau: <b>${mm}:${String(ss).padStart(2, '0')}</b><br>` +
    `Điểm: <b>${g.score}</b><br>` +
    `Tỏa sáng (Q, −${T.pulse_cost} đom đóm)<div id="cd"><div style="width:${(cdk * 100).toFixed(0)}%;opacity:${p.carried >= T.pulse_cost ? 1 : 0.3}"></div></div>`;
  let hint = '';
  for (const L of g.lanterns) {
    if (L.lit) continue;
    if (Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]) <= T.interact_radius)
      hint = p.carried > 0 ? `E: nạp đom đóm vào đèn ${L.id} (${L.deposited}/${T.lantern_cost})` : `Đèn ${L.id} cần ${T.lantern_cost - L.deposited} đom đóm nữa`;
  }
  if (!hint && p.carried >= T.carry_capacity) hint = 'Túi đầy — mang đom đóm về đèn!';
  $('hint').textContent = hint;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (keys.has('ArrowLeft')) camYaw += 120 * dt;
  if (keys.has('ArrowRight')) camYaw -= 120 * dt;
  if (g && mode === 'play') {
    acc += dt;
    while (acc >= 1 / 60 && g.state === 'playing') {
      step(g, readFrame());
      acc -= 1 / 60;
      for (const e of drainEvents(g)) {
        SFX[e.name]?.();
        if (e.name === 'pulse') pulseFx(g.player.pos);
        if (e.name === 'player_hit') { $('flash').style.opacity = 0.5; flashT = 0.15; }
      }
    }
    if (g.state !== 'playing') {
      mode = 'over';
      const won = g.state === 'won';
      const lit = g.lanterns.filter((L) => L.lit).length;
      if (won) { beep(523, 0.3, 'triangle'); setTimeout(() => beep(659, 0.3, 'triangle'), 150); setTimeout(() => beep(784, 0.7, 'triangle'), 300); }
      else beep(200, 0.8, 'sine', 0.15, 0.4);
      showOverlay(won ? 'Đảo đã sáng lại!' : 'Sương đen đã thắng…',
        won ? `Mây đã thắp đủ ${lit} Đèn Lồng Lớn. Điểm: <b>${g.score}</b>`
          : `${g.player.flames <= 0 ? 'Mây đã hết ngọn lửa.' : 'Bình minh đến khi đảo còn tối.'} Đèn đã thắp: ${lit}/5. Điểm: <b>${g.score}</b>`,
        'Nhấn R / Enter để chơi lại');
    }
  }
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) $('flash').style.opacity = 0; }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    const s = 1 + (f.t / 0.4) * T.pulse_radius;
    f.m.scale.setScalar(s); f.m.material.opacity = Math.max(0, 0.9 - f.t / 0.4);
    if (f.t > 0.4) { scene.remove(f.m); fx.splice(i, 1); }
  }
  for (const w of whales) {
    const a = now / 1000 * w.sp + w.ph;
    w.w.position.set(Math.cos(a) * w.r, -6 + Math.sin(now / 1500 + w.ph) * 1.5, Math.sin(a) * w.r);
    w.w.rotation.y = -a;
  }
  if (g) sync(dt, now);
  else { camera.position.set(Math.sin(now / 5000) * 30, 18, Math.cos(now / 5000) * 30); camera.lookAt(0, 0, 0); }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
// ?play autostarts; ?lit=N pre-lights N lanterns (visual check only, used for screenshots)
const qs = new URLSearchParams(location.search);
if (qs.has('play')) {
  newGame();
  const n = Number(qs.get('lit') || 0);
  g.lanterns.slice(0, n).forEach((L) => { L.lit = true; L.deposited = T.lantern_cost; });
  if (n) { g.player.pos = [g.lanterns[0].pos[0], 0, g.lanterns[0].pos[2] - 7]; }
}
