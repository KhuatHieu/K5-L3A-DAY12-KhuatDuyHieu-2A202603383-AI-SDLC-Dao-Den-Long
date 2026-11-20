// Browser renderer + UI. All gameplay rules live in src/sim.js (fixed 60 Hz); this file draws, reads input, plays audio.
import * as THREE from 'three';
import { configure, createGame, step, drainEvents, timeLeft, windWarning, shadeState, capacityOf, winNeed, NIGHTS, STD, mulberry32, createBenchGame } from '../src/sim.js';

const contract = await (await fetch('/game.contract.json')).json();
configure(contract.tuning);
const T = contract.tuning;
const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);

// ---------- palette (Ticket-02)
const P = {
  sky: 0x0E1430, fog: 0x1B2350, grass: 0x2F5D50, sand: 0xC9B48A, wood: 0x6B4A2F, sea: 0x12384A,
  lampOn: 0xFFB347, lampCore: 0xFFE9B0, lampOff: 0x5B5F6E, moteCore: 0xFFF6C2, moteHalo: 0xFFE58A,
  shade: 0x120A1A, shadeRim: 0x7A3CFF, shadeStun: 0x3A3450, robe: 0xE8E2D0, scarf: 0xC8102E, gold: 0xF2C14E, drifter: 0x8FA3B8,
};

// ---------- settings (persisted; storage may be unavailable)
const settings = { vol: 0.6, sens: 0.3, cb: false }; // cb = colour-blind friendly palette (Ticket-03 §6)
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch {}
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch {} };
const rimColor = () => (settings.cb ? 0x00B3FF : P.shadeRim);
const applyCb = () => { document.body.classList.toggle('cb', settings.cb); for (const v of views.shades.values()) { v.rim.material.color.setHex(rimColor()); v.eyeM.color.setHex(rimColor()); } };

// ---------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(P.sky);
scene.fog = new THREE.Fog(P.fog, 25, 120);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const ambient = new THREE.AmbientLight(0xb8c0ff, 0.15);
const moon = new THREE.DirectionalLight(0x9fb0ff, 0.35);
moon.position.set(-30, 60, -20);
scene.add(ambient, moon);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshLambertMaterial({ color: P.sea }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -14;
scene.add(sea);
const deco = mulberry32(7); // decorative randomness only (never gameplay)
const cloudMat = new THREE.MeshLambertMaterial({ color: 0x2a5068, flatShading: true });
for (let i = 0; i < 60; i++) {
  const a = deco() * Math.PI * 2, r = 70 + deco() * 120;
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(5 + deco() * 8, 0), cloudMat);
  m.position.set(35 + Math.cos(a) * r, -12 - deco() * 4, Math.sin(a) * r); m.scale.y = 0.4; scene.add(m);
}
// cloud whales — creative, visual only
const whales = [];
for (let i = 0; i < 3; i++) {
  const w = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0x8f9fc9, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), mat); body.scale.set(2.2, 0.9, 1);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 6), mat); tail.rotation.z = Math.PI / 2; tail.position.x = -7.5;
  w.add(body, tail); scene.add(w); whales.push({ w, r: 90 + i * 20, sp: 0.03 + i * 0.01, ph: i * 2.1 });
}

// ---------- level geometry (rebuilt per night)
let level = new THREE.Group(); scene.add(level);
const matGrass = new THREE.MeshLambertMaterial({ color: P.grass });
const matSand = new THREE.MeshLambertMaterial({ color: P.sand });
const matWood = new THREE.MeshLambertMaterial({ color: P.wood });
const matRock = new THREE.MeshLambertMaterial({ color: 0x2b3350, flatShading: true });
function islandDisc(cx, cz, r, h = 0) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 48), matGrass); top.position.y = h - 0.5;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.6, r - 1, 1.4, 48), matSand); rim.position.y = h - 1.3;
  const rock = new THREE.Mesh(new THREE.ConeGeometry(r - 1, r * 0.7, 10), matRock); rock.rotation.x = Math.PI; rock.position.y = h - 2 - r * 0.35;
  g.add(top, rim, rock); g.position.set(cx, 0, cz); return g;
}
function pad(p) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.25, 24), new THREE.MeshBasicMaterial({ color: P.gold }));
  m.position.set(p[0], p[1] + 0.12, p[2]); return m;
}
function trees(n, place) {
  const tm = new THREE.MeshLambertMaterial({ color: 0x23473d, flatShading: true });
  const geo = new THREE.ConeGeometry(1.3, 4, 7), tg = new THREE.CylinderGeometry(0.2, 0.3, 1.2);
  for (let i = 0; i < n; i++) {
    const p = place(); if (!p) continue;
    const c = new THREE.Mesh(geo, tm); c.position.set(p[0], p[1] + 3, p[2]);
    const t = new THREE.Mesh(tg, matWood); t.position.set(p[0], p[1] + 0.6, p[2]);
    level.add(c, t);
  }
}
function buildLevel(night) {
  scene.remove(level); level = new THREE.Group(); scene.add(level);
  const N = NIGHTS[night];
  if (night === 1) {
    level.add(islandDisc(0, 0, 40));
    trees(26, () => { const a = deco() * 6.283, r = 36 + deco() * 3; return [Math.cos(a) * r, 0, Math.sin(a) * r]; });
  } else if (night === 2) {
    level.add(islandDisc(0, 0, 28), islandDisc(70, 0, 28));
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), matWood); bridge.position.set(35, -0.15, 0); level.add(bridge);
    for (let x = 26.5; x <= 44; x += 1.2) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 4.1), new THREE.MeshLambertMaterial({ color: 0x4a3320 })); s.position.set(x, -0.1, 0); level.add(s); }
    trees(30, () => { const a = deco() * 6.283, r = 25 + deco() * 2, c = deco() < 0.5 ? 0 : 70; const p = [c + Math.cos(a) * r, 0, Math.sin(a) * r]; return Math.abs(p[2]) < 4 ? null : p; });
  } else {
    level.add(islandDisc(0, 0, 45));
    const tier1 = new THREE.Shape();
    tier1.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false); tier1.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(tier1, { depth: 3, bevelEnabled: false, curveSegments: 32 }), [matGrass, matRock]);
    t1.rotation.x = -Math.PI / 2; level.add(t1); // shape y<0 → world z>0
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 40), [matRock, matGrass, matRock]); t2.position.y = 3; level.add(t2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 16), matWood); tower.position.y = 10; level.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 2.5, 8), new THREE.MeshLambertMaterial({ color: 0x7a2a1a })); roof.position.y = 15.2; level.add(roof);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8, 0, 6.283, 0, 1.8), new THREE.MeshLambertMaterial({ color: P.gold })); bell.position.y = 13; level.add(bell);
    for (const a of [30, 150]) {
      const r = (a * Math.PI) / 180, ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, Math.hypot(6, 3)), matSand);
      ramp.position.set(Math.cos(r) * 27, 1.4, Math.sin(r) * 27);
      ramp.rotation.order = 'YXZ'; ramp.rotation.y = Math.atan2(Math.cos(r), Math.sin(r)); ramp.rotation.x = Math.atan2(3, 6);
      level.add(ramp);
    }
    trees(24, () => { const a = deco() * 6.283, r = 38 + deco() * 5; return [Math.cos(a) * r, 0, Math.sin(a) * r]; });
  }
  for (const p of N.pads) level.add(pad(p.pos));
}

// ---------- Mây
const may = new THREE.Group();
const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 12), new THREE.MeshLambertMaterial({ color: P.robe })); robe.position.y = 0.65;
const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 16), new THREE.MeshLambertMaterial({ color: P.scarf })); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.25;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshLambertMaterial({ color: 0xf3cfa8 })); head.position.y = 1.55;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.5, 18), new THREE.MeshLambertMaterial({ color: P.sand, flatShading: true })); hat.position.y = 1.9; // nón lá
const tiny = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: P.lampOn })); tiny.position.set(0, 1.5, 0.82);
may.add(robe, scarf, head, hat, tiny);
const mayLight = new THREE.PointLight(P.lampOn, 6, 10, 1.6); mayLight.position.y = 1.6; may.add(mayLight);
scene.add(may);

// ---------- dynamic views
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#FFF6C2'); gr.addColorStop(0.3, 'rgba(255,229,138,.7)'); gr.addColorStop(1, 'rgba(255,229,138,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const moteMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false });
const dropMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd28a });
const views = { lanterns: [], motes: new Map(), shades: new Map(), drifters: new Map(), charms: [] };
function clearViews() {
  for (const v of views.lanterns) scene.remove(v.group);
  for (const m of ['motes', 'shades', 'drifters']) { for (const v of views[m].values()) scene.remove(v.obj); views[m].clear(); }
  for (const v of views.charms) scene.remove(v);
  views.lanterns = []; views.charms = [];
}
function lanternView(L) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2), matWood); pole.position.y = 1.6;
  const lampMat = new THREE.MeshLambertMaterial({ color: P.lampOff, emissive: P.lampOn, emissiveIntensity: 0 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 12), lampMat); lamp.position.y = 3.6;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: P.lampCore })); core.position.y = 3.6; core.visible = false;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 12), new THREE.MeshLambertMaterial({ color: 0x8a2a1a })); roof.position.y = 4.4;
  const light = new THREE.PointLight(P.lampOn, 0, 24, 1.4); light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: P.lampOn, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), new THREE.MeshBasicMaterial({ color: 0x1B2350, side: THREE.DoubleSide }));
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.12), new THREE.MeshBasicMaterial({ color: P.lampOn, side: THREE.DoubleSide }));
  barBg.position.y = bar.position.y = 5.0; bar.position.z = 0.01;
  const fuelBar = new THREE.Group(); fuelBar.add(barBg, bar); fuelBar.position.y = 0;
  const tear = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.5), new THREE.MeshBasicMaterial({ color: 0x0E1430, side: THREE.DoubleSide }));
  tear.position.set(0.2, 3.5, 0.61); tear.rotation.z = 0.5; // torn paper on an unlit lantern
  group.add(pole, lamp, core, roof, light, ring, fuelBar, tear);
  group.position.set(...L.pos); scene.add(group);
  return { group, lampMat, lamp, core, light, ring, fuelBar, bar, tear };
}
function shadeView() {
  const obj = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: P.shade, emissive: P.shade });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), mat);
  const rim = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), new THREE.MeshBasicMaterial({ color: rimColor(), wireframe: true, transparent: true, opacity: 0.6 }));
  const eyeM = new THREE.MeshBasicMaterial({ color: rimColor() });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), eyeM), e2 = e1.clone();
  e1.position.set(0.25, 0.2, 0.78); e2.position.set(-0.25, 0.2, 0.78);
  obj.add(body, rim, e1, e2); scene.add(obj);
  return { obj, mat, rim, eyeM };
}
function drifterView() {
  const obj = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: P.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5, 12, 1), mat);
  obj.add(ribbon); scene.add(obj);
  return { obj, ribbon };
}
function charmView(c) {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshBasicMaterial({ color: P.scarf, side: THREE.DoubleSide }));
  const border = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.02), new THREE.MeshBasicMaterial({ color: P.gold, side: THREE.DoubleSide }));
  border.position.z = -0.01; g.add(border, paper); g.position.set(c.pos[0], c.pos[1] + 1, c.pos[2]); scene.add(g); return g;
}
const fx = [];
function ringFx(pos, color, radius, life = 0.4) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos[0], pos[1] + 0.3, pos[2]); scene.add(m); fx.push({ m, t: 0, life, radius });
}
// wind leaves
const leafGeo = new THREE.PlaneGeometry(0.25, 0.12), leafMat = new THREE.MeshBasicMaterial({ color: 0x9cc06a, side: THREE.DoubleSide });
const leaves = Array.from({ length: 40 }, () => { const m = new THREE.Mesh(leafGeo, leafMat); m.visible = false; scene.add(m); return m; });

// ---------- audio (synthesized; master volume from settings)
let actx = null, master = null;
function ensureAudio() {
  if (actx) return;
  try { actx = new AudioContext(); } catch { return; }
  master = actx.createGain(); master.gain.value = settings.vol; master.connect(actx.destination);
  startMusic();
}
function beep(freq, dur = 0.12, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
  if (!actx) return;
  const o = actx.createOscillator(), gn = actx.createGain(), t0 = actx.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(gn).connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function startMusic() { // gentle night pad: pentatonic notes over a drone
  const notes = [220, 247, 294, 330, 392, 440];
  let i = 0;
  const drone = actx.createOscillator(), dg = actx.createGain();
  drone.type = 'sine'; drone.frequency.value = 110; dg.gain.value = 0.025; drone.connect(dg).connect(master); drone.start();
  setInterval(() => { if (mode === 'play') beep(notes[(i * 3 + (i >> 2)) % notes.length], 1.6, 'triangle', 0.035); i++; }, 900);
}
const SFX = {
  mote_picked: () => beep(880 + Math.random() * 200, 0.1, 'sine', 0.08, 1.5),
  deposit: () => beep(440, 0.2, 'triangle', 0.12, 1.3),
  lantern_lit: () => { beep(523, 0.4, 'triangle', 0.15); beep(784, 0.6, 'triangle', 0.15, 0, 0.12); },
  pulse: () => beep(300, 0.5, 'sine', 0.2, 3),
  player_hit: () => beep(160, 0.35, 'sawtooth', 0.1, 0.5),
  shade_spawned: () => beep(90, 0.6, 'square', 0.04, 0.7),
  dash: () => beep(500, 0.15, 'sawtooth', 0.05, 2.2),
  charm_picked: () => { beep(660, 0.2, 'square', 0.06); beep(990, 0.3, 'square', 0.06, 0, 0.1); },
  drifter_steal: () => beep(700, 0.4, 'triangle', 0.1, 0.4),
  drifter_drop: () => beep(500, 0.3, 'triangle', 0.1, 1.8),
};
const sfxJump = () => beep(330, 0.15, 'sine', 0.08, 1.8);
const sfxWin = () => [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.5, 'triangle', 0.15, 0, i * 0.15));
const sfxLose = () => beep(220, 1.0, 'sine', 0.15, 0.4);

// ---------- input
const keys = new Set();
let camYaw = 0, dragging = false, lastX = 0;
addEventListener('keydown', (e) => {
  ensureAudio();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); return; }
  if (e.code === 'Enter') { if (mode === 'intro') beginPlay(); else if (mode === 'menu') startNight(1); }
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (mode === 'play') pause(); });
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; ensureAudio(); });
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => { if (dragging) { camYaw -= (e.clientX - lastX) * settings.sens; lastX = e.clientX; } });
function readFrame() {
  const k = (c) => keys.has(c);
  const z = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  const x = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0); // screen-right is −x at yaw 0
  return { move: [x, z], cam_yaw_deg: camYaw, jump: k('Space'), interact: k('KeyE'), pulse: k('KeyQ'), dash: k('ShiftLeft') || k('ShiftRight') };
}

// ---------- flow: menu → intro → play → result → next night
const INTRO = {
  1: 'Ông Đăng: "Đảo Bến là nơi đèn đầu tiên được thắp. Năm ngọn đèn — đừng để sương ăn mất cháu nhé."',
  2: 'Ông Đăng: "Đảo Cau có hai nửa, nối bằng cây cầu tre cũ. Cẩn thận Gió Lạc — chúng thích ánh sáng người khác mang."',
  3: 'Ông Đăng: "Đảo Chuông cao ba tầng. Khi gió nổi, bám chặt vào. Đèn trên đỉnh sẽ đánh thức chuông bình minh."',
};
let g = null, mode = 'menu', night = 1, prevMode = 'menu', seed = Date.now() & 0x7fffffff, acc = 0;
const wonScores = {};
const screens = ['sMenu', 'sIntro', 'sResult', 'sPause', 'sSettings'];
function show(id) { for (const s of screens) $(s).classList.toggle('show', s === id); const b = id && $(id).querySelector('button'); if (b) b.focus(); }
function startNight(n) {
  night = n; g = createGame({ seed: seed++, night: n });
  buildLevel(n); clearViews();
  views.lanterns = g.lanterns.map(lanternView);
  views.charms = g.charms.map(charmView);
  camYaw = 0; lastSec = null;
  $('introN').textContent = `Đêm ${n}`; $('introName').textContent = NIGHTS[n].name; $('introQuote').textContent = INTRO[n];
  mode = 'intro'; show('sIntro');
}
function beginPlay() { mode = 'play'; acc = 0; show(null); }
function pause() { mode = 'pause'; show('sPause'); } // logic stops completely: step() is not called while paused
function resume() { mode = 'play'; acc = 0; show(null); }
function finish() {
  const won = g.state === 'won';
  mode = 'result';
  const lit = g.lanterns.filter((L) => L.lit).length;
  if (won) { sfxWin(); wonScores[night] = g.score; } else sfxLose();
  const total = Object.values(wonScores).reduce((a, b) => a + b, 0);
  if (won && night === 3) {
    $('resTitle').textContent = 'Bình Minh';
    $('resBody').innerHTML = `Chuông trên Đảo Chuông đã ngân. Ba hòn đảo sáng trở lại.<br>Tổng điểm: <b>${total}</b>`;
    $('resBtns').innerHTML = '<button data-act="menu">Về menu</button>';
  } else if (won) {
    $('resTitle').textContent = `${NIGHTS[night].name} đã sáng!`;
    $('resBody').innerHTML = `Đèn ${lit}/${g.lanterns.length} · Điểm đêm: <b>${g.score}</b> · Tổng: <b>${total}</b>`;
    $('resBtns').innerHTML = '<button data-act="next">Đêm kế tiếp</button><button data-act="menu">Về menu</button>';
  } else {
    $('resTitle').textContent = 'Sương đen đã thắng…';
    $('resBody').innerHTML = `${g.player.flames <= 0 ? 'Mây đã hết Ngọn Lửa.' : `Bình minh tới nhưng chỉ ${lit} đèn còn sáng (cần ${winNeed(g)}).`} Đèn ${lit}/${g.lanterns.length} · Điểm: <b>${g.score}</b>`;
    $('resBtns').innerHTML = '<button data-act="restart">Chơi lại Đêm</button><button data-act="menu">Về menu</button>';
  }
  show('sResult');
}
document.addEventListener('click', (e) => {
  const act = e.target.closest('button')?.dataset.act; if (!act) return;
  ensureAudio();
  if (act === 'start') { for (const k of Object.keys(wonScores)) delete wonScores[k]; startNight(1); }
  else if (act === 'play') beginPlay();
  else if (act === 'resume') resume();
  else if (act === 'restart') startNight(night);
  else if (act === 'next') startNight(night + 1);
  else if (act === 'menu') { mode = 'menu'; show('sMenu'); }
  else if (act === 'settings') { prevMode = mode; $('vol').value = settings.vol; $('sens').value = settings.sens; $('cb').checked = settings.cb; show('sSettings'); }
  else if (act === 'back') { show(prevMode === 'pause' ? 'sPause' : 'sMenu'); }
});
$('vol').addEventListener('input', (e) => { settings.vol = Number(e.target.value); if (master) master.gain.value = settings.vol; saveSettings(); });
$('sens').addEventListener('input', (e) => { settings.sens = Number(e.target.value); saveSettings(); });
$('cb').addEventListener('change', (e) => { settings.cb = e.target.checked; saveSettings(); applyCb(); });

// ---------- per-frame sync
for (let i = 0; i < 20; i++) $('motebar').appendChild(document.createElement('i'));
{ const c = document.createElement('span'); c.id = 'motecount'; c.style.marginLeft = '8px'; $('motebar').appendChild(c); }
const motebar = [...$('motebar').querySelectorAll('i')];
let facing = 0, lastSec = null, flashT = 0;
const tmpV = new THREE.Vector3();
function sync(dt, now) {
  const p = g.player;
  may.position.set(...p.pos);
  const [vx, , vz] = p.vel;
  if (Math.hypot(vx, vz) > 0.1) { const t = Math.atan2(vx, vz); let d = t - facing; d = Math.atan2(Math.sin(d), Math.cos(d)); facing += d * Math.min(1, dt * 14); }
  may.rotation.y = facing;
  may.visible = !p.fallen && !(p.invuln > 0 && Math.floor(now / 90) % 2);
  mayLight.intensity = 4 + p.carried * 0.8;

  let lit = 0;
  g.lanterns.forEach((L, i) => {
    const v = views.lanterns[i]; if (L.lit) lit++;
    const cost = L.everLit ? T.relight_cost : T.lantern_cost;
    const k = L.lit ? 1 : L.deposited / cost;
    const fuel = L.fuel / 60, low = L.lit && fuel < T.low_fuel_threshold;
    const blinkOn = !low || Math.floor(now / 500) % 2 === 0; // 1 Hz slow blink when fuel < 30
    v.light.intensity += ((L.lit ? (blinkOn ? 35 : 8) : k * 5) - v.light.intensity) * Math.min(1, dt * 6);
    v.lampMat.emissiveIntensity = L.lit ? (blinkOn ? 1.6 : 0.3) : k * 0.6;
    v.lampMat.color.setHex(L.lit ? P.lampOn : P.lampOff);
    v.lamp.scale.y = L.lit ? 1 : 0.8; v.tear.visible = !L.lit; // unlit: squashed 20% + torn paper (no colour needed)
    v.core.visible = L.lit && blinkOn; v.ring.material.opacity = L.lit && !low ? 0.35 : 0;
    v.fuelBar.visible = L.lit && blinkOn;
    v.bar.scale.x = Math.max(0.001, fuel / T.fuel_max); v.bar.position.x = -0.75 * (1 - v.bar.scale.x);
    v.bar.material.color.setHex(low ? (settings.cb ? 0xFFFFFF : 0xFF5A5F) : P.lampOn);
    v.fuelBar.lookAt(camera.position.x, v.group.position.y + 5, camera.position.z);
  });
  ambient.intensity = 0.15 + 0.55 * (lit / g.lanterns.length);
  scene.fog.far = 120 + 80 * (lit / g.lanterns.length);

  syncMap(views.motes, g.motes, (m) => { const s = new THREE.Sprite(m.kind === 'dropped' ? dropMat : moteMat); s.scale.setScalar(0.8); scene.add(s); return { obj: s }; },
    (v, m) => { const ph = parseInt(m.id.slice(1), 10); v.obj.position.set(m.pos[0] + Math.sin(now / 700 + ph) * 0.15, m.pos[1] + 0.9 + Math.sin(now / 400 + ph) * 0.2, m.pos[2]); });
  syncMap(views.shades, g.shades, shadeView, (v, s) => {
    const st = shadeState(s);
    v.obj.position.set(s.pos[0], s.pos[1] + Math.sin(now / 250 + s.id.length) * 0.12, s.pos[2]);
    v.obj.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    v.mat.color.setHex(st === 'stunned' ? P.shadeStun : P.shade);
    v.rim.visible = st !== 'stunned';
    v.rim.material.opacity = st === 'drain' ? 0.6 + 0.4 * Math.sin(now / 120) : 0.6;
    v.obj.scale.setScalar(st === 'spawning' ? Math.max(0.1, 1 - s.spawning / STD.shade_spawning) : st === 'stunned' ? 0.75 : 1 + Math.sin(now / 180) * 0.05);
  });
  syncMap(views.drifters, g.drifters.filter((d) => d.state !== 'removed'), drifterView, (v, d) => {
    v.obj.position.set(...d.pos);
    v.obj.rotation.y = now / 400; v.ribbon.rotation.x = Math.sin(now / 150) * 0.5;
    v.ribbon.material.opacity = d.state === 'flee' ? 0.5 : 0.85;
  });
  g.charms.forEach((c, i) => { const m = views.charms[i]; m.visible = c.available; m.rotation.y = now / 500; m.position.y = c.pos[1] + 1 + Math.sin(now / 300) * 0.15; });

  // wind leaves (2 s warning + gust)
  const warn = windWarning(g), active = g.wind.active > 0;
  $('windwarn').textContent = warn !== null ? '🍃 Gió sắp nổi!' : active ? '🌬️ Gió mạnh' : '';
  leaves.forEach((l, i) => {
    l.visible = warn !== null || active;
    if (!l.visible) return;
    const dir = ((g.wind.dir ?? 0) * Math.PI) / 180, sp = active ? 14 : 5;
    const ph = (((now / 1000) * sp + i * 7.3) % 30) - 15;
    l.position.set(p.pos[0] + Math.cos(dir) * ph + Math.sin(i * 12.9) * 8, p.pos[1] + 1 + (i % 5) * 0.6, p.pos[2] + Math.sin(dir) * ph + Math.cos(i * 4.1) * 8);
    l.rotation.set(now / 200 + i, now / 300, 0);
  });

  // camera (bench mode drives its own orbit camera)
  if (mode !== 'bench') {
  const th = (camYaw * Math.PI) / 180;
  tmpV.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 5.5, p.pos[2] - Math.cos(th) * 9);
  camera.position.lerp(tmpV, Math.min(1, dt * 8));
  camera.lookAt(p.pos[0], p.pos[1] + 1.4, p.pos[2]);
  }

  // HUD
  const tl = timeLeft(g), sec = Math.ceil(tl);
  $('flames').textContent = '🔥'.repeat(Math.max(0, p.flames)) + '·'.repeat(Math.max(0, T.flames - p.flames));
  $('timer').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('warn', tl <= 30);
  if (mode === 'play' && tl <= 10 && sec !== lastSec && sec > 0) beep(1000, 0.08, 'square', 0.06);
  lastSec = sec;
  const need = winNeed(g), cap = capacityOf(p);
  $('topright').innerHTML = `Đèn sáng <b>${lit}/${g.lanterns.length}</b> (cần ${need})<br>Điểm <b>${g.score}</b>`;
  motebar.forEach((el, i) => { el.style.display = i < cap ? '' : 'none'; el.classList.toggle('on', i < p.carried); });
  $('motecount').textContent = `${p.carried}/${cap}`;
  const cd = (el, left, total, usable) => { el.querySelector('.fill').style.height = `${(left / total) * 100}%`; el.classList.toggle('off', !usable); };
  cd($('cdDash'), p.charm > 0 ? 0 : p.dashCd, Math.round(T.dash_cooldown_s * 60), true);
  cd($('cdPulse'), p.pulseCd, Math.round(T.pulse_cooldown_s * 60), p.carried >= T.pulse_cost);
  $('charm').style.display = p.charm > 0 ? 'block' : 'none'; $('charmt').textContent = `${Math.ceil(p.charm / 60)}s`;

  let hint = '', nearest = null, nd = Infinity;
  for (const L of g.lanterns) {
    if (L.lit) continue;
    const d = Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]);
    if (d < nd) { nd = d; nearest = L; }
    if (d <= T.interact_radius && Math.abs(L.pos[1] - p.pos[1]) <= 1.5) hint = `E — Nạp ánh sáng (${L.deposited}/${L.everLit ? T.relight_cost : T.lantern_cost})`;
  }
  for (const L of g.lanterns) if (L.lit && L.fuel < T.fuel_max * 60 && Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]) <= T.interact_radius) hint = `E — Châm dầu (${Math.floor(L.fuel / 60)}/${T.fuel_max})`;
  if (!hint && p.carried >= cap) hint = 'Túi đầy — mang về đèn!';
  $('hint').textContent = hint;
  // off-screen arrow to nearest unlit lantern
  const arrow = $('arrow');
  if (nearest) {
    tmpV.set(nearest.pos[0], nearest.pos[1] + 3.6, nearest.pos[2]).project(camera);
    const behind = tmpV.z > 1;
    let x = tmpV.x, y = tmpV.y;
    if (behind) { x = -x; y = -y; }
    if (behind || Math.abs(x) > 0.95 || Math.abs(y) > 0.95) {
      const ang = Math.atan2(x, y), k = 0.85 / Math.max(Math.abs(x), Math.abs(y), 1e-6);
      const sx = (x * k * 0.5 + 0.5) * innerWidth, sy = (-y * k * 0.5 + 0.5) * innerHeight;
      Object.assign(arrow.style, { display: 'block', left: `${sx - 14}px`, top: `${sy - 15}px`, transform: `rotate(${ang}rad)` });
    } else arrow.style.display = 'none';
  } else arrow.style.display = 'none';
}
function syncMap(map, list, make, update) {
  const seen = new Set();
  for (const e of list) { seen.add(e.id); let v = map.get(e.id); if (!v) { v = make(e); map.set(e.id, v); } update(v, e); }
  for (const [id, v] of map) if (!seen.has(id)) { scene.remove(v.obj); map.delete(id); }
}

// ---------- main loop
let last = performance.now(), fpsFrames = 0, fpsT = 0;
const fpsLog = [];
window.__fps = fpsLog;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (keys.has('ArrowLeft')) camYaw += 120 * dt;
  if (keys.has('ArrowRight')) camYaw -= 120 * dt;
  if (g && mode === 'bench') benchFrame(now);
  if (g && (mode === 'play' || mode === 'bench')) {
    acc += dt;
    while (acc >= 1 / 60 && g.state === 'playing') {
      const f = mode === 'bench' ? null : readFrame(); // bench: no player input
      const wasGrounded = g.player.grounded;
      step(g, f); acc -= 1 / 60;
      if (f && wasGrounded && g.player.vel[1] > 0 && f.jump) sfxJump();
      for (const e of drainEvents(g)) {
        SFX[e.name]?.();
        if (e.name === 'pulse') ringFx(g.player.pos, P.lampCore, T.pulse_radius);
        if (e.name === 'lantern_lit') { const L = g.lanterns.find((x) => x.id === e.data.lantern_id); ringFx(L.pos, P.lampOn, T.safe_radius, 0.8); }
        if (e.name === 'player_hit') { $('flash').style.opacity = 0.45; flashT = 0.15; }
      }
    }
    if (g.state !== 'playing' && mode === 'play') finish();
  }
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) $('flash').style.opacity = 0; }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    f.m.scale.setScalar(1 + (f.t / f.life) * f.radius); f.m.material.opacity = Math.max(0, 0.9 - f.t / f.life);
    if (f.t > f.life) { scene.remove(f.m); fx.splice(i, 1); }
  }
  for (const w of whales) { w.w.visible = mode !== 'bench'; /* creative extras off in bench */ const a = (now / 1000) * w.sp + w.ph; w.w.position.set(35 + Math.cos(a) * w.r, -8 + Math.sin(now / 1500 + w.ph) * 1.5, Math.sin(a) * w.r); w.w.rotation.y = -a; }
  if (g) sync(dt, now);
  else { camera.position.set(Math.sin(now / 6000) * 50, 25, Math.cos(now / 6000) * 50); camera.lookAt(0, 0, 0); }
  renderer.render(scene, camera);
  fpsFrames++; fpsT += dt;
  if (fpsT >= 1) { fpsLog.push(fpsFrames / fpsT); $('fps').textContent = `${(fpsFrames / fpsT).toFixed(0)} FPS`; fpsFrames = 0; fpsT = 0; }
}
requestAnimationFrame(frame);

// ---------- start
// ---------- Ticket-04 benchmark: ?bench&seed=42&duration=30 (driven by scripts/bench.mjs)
let bench = null;
function benchFrame(now) {
  if (!bench.first) { bench.first = now; window.__benchFirstFrameEpoch = performance.timeOrigin + now; }
  const t = (now - bench.first) / 1000, th = (2 * Math.PI * t) / 15; // 15 s per lap, CCW seen from above (same angle convention as the maps)
  camera.position.set(30 * Math.cos(th), 15, 30 * Math.sin(th)); camera.lookAt(0, 0, 0);
  if (bench.last !== null && t >= 3) bench.dts.push(now - bench.last); // 3 s warm-up not measured
  bench.last = now;
  if (t >= 3 + bench.duration && !window.__benchDone) {
    window.__benchDone = true;
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    window.__benchResult = { dts: bench.dts, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), three: THREE.REVISION, webgl2: renderer.capabilities.isWebGL2,
      shades: g.shades.length, motes: g.motes.length, lit: g.lanterns.filter((L) => L.lit).map((L) => L.id) };
  }
}
buildLevel(1);
applyCb();
if (qs.has('cb')) { settings.cb = true; applyCb(); }
if (qs.has('bench')) {
  bench = { duration: Number(qs.get('duration') || 30), dts: [], first: 0, last: null };
  g = createBenchGame(Number(qs.get('seed') || 42)); night = 1; buildLevel(1); clearViews();
  views.lanterns = g.lanterns.map(lanternView); views.charms = [];
  mode = 'bench'; show(null);
} else if (qs.has('night')) { // screenshot/benchmark helper: ?night=N[&lit=k][&t=sec][&yaw=deg] jumps straight into play
  startNight(Number(qs.get('night')) || 1); beginPlay();
  const k = Number(qs.get('lit') || 0);
  g.lanterns.slice(0, k).forEach((L, i) => { L.lit = true; L.everLit = true; L.fuel = (i === 1 ? 20 : 80) * 60; }); // 2nd one low on fuel
  if (k) { const L = g.lanterns[0]; g.player.pos = [L.pos[0], L.pos[1], L.pos[2] - 7]; }
  if (qs.has('t')) g.duration = Number(qs.get('t'));
  if (qs.has('yaw')) camYaw = Number(qs.get('yaw'));
} else show('sMenu');
