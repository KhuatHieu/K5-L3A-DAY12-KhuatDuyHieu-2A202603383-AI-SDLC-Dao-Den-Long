// Pure, deterministic game logic for Đảo Đèn Lồng (Test Contract v1.2: Ticket-02 + Ticket-03 "Đèn cạn dầu").
// No DOM, no Math.random, no wall clock. Shared by headless CLI and browser renderer.
// Tick order follows Ticket-02 "Thứ tự xử lý trong một tick" exactly (numbered below).

export let T = null; // contract tuning (game.contract.json) — single source for contract numbers
export function configure(tuning) { T = tuning; }

const DT = 1 / 60;
export const secToTicks = (s) => Math.round(s * 60);
// Fuel is stored in integer units of 1/60 (Ticket-03 §1 precision note): FU = 60 units per 1.0 fuel.
const FU = 60;
const fuelMax = () => T.fuel_max * FU;
const lowFuel = () => T.low_fuel_threshold * FU;
export const capacityOf = (p) => Math.min(T.capacity_max, T.carry_capacity + 2 * p.successfulLights);
export const winNeed = (g) => Math.ceil(T.win_ratio * g.lanterns.length - 1e-9);
const safeLantern = (L) => L.lit && L.fuel >= lowFuel(); // fuel < 30 loses its safe zone; exactly 30 keeps it
const EPS = 1e-6;
const within = (d, r) => d <= r + EPS;
const dxz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const r3 = (v) => { const x = Math.round(v * 1000) / 1000; return Object.is(x, -0) ? 0 : x; };
const deg = (d) => (d * Math.PI) / 180;
const natCmp = (a, b) => a.localeCompare(b, 'en', { numeric: true });

// Fixed numbers from Ticket-02 that have no contract tuning key.
export const STD = {
  jump_speed: 7, gravity: 20, step: 0.35, fall_y: -10, fall_wait: 60,
  pickup_dy: 1.5, hit_dy: 1.5, interact_dy: 1.5,
  mote_initial: 20, mote_cap: 30, mote_every: 240, drop_ttl: 480, drop_rmin: 1.5, drop_rmax: 2.5,
  shade_first: 300, shade_spawning: 60, shade_detect: 12, shade_lose: 18, shade_wander_speed: 1.0,
  shade_min_player_dist: 15, shade_y: 1.0, recoil_m: 2, recoil_ticks: 60,
  stun_ticks: 120, push_ticks: 15, evict_ticks: 30, pulse_h: 0.8,
  drifter_speed: 7, drifter_idle_speed: 2, drifter_max: 2, drifter_every: 1200, drifter_y: 1.5,
  drifter_chase_carry: 5, drifter_chase_dist: 15, drifter_hit: 1.2, drifter_steal: 3,
  drifter_flee_ticks: 240, drifter_drop_ticks: 120, drain_dist: 2, drain_chase_dist: 6,
  charm_ticks: 600, charm_respawn: 2700, charm_speed: 7.2,
  wind_every: 1800, wind_ticks: 300, wind_warn: 120, wind_speed: 2,
};

const ring = (cx, cz, r, start, step, n, y = 0) =>
  Array.from({ length: n }, (_, i) => { const a = deg(start + step * i); return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)]; });

// ---------- maps (Ticket-02 Phần 2). Angle a → (x, z) = (r cos a, r sin a).
export const NIGHTS = {
  1: {
    name: 'Đảo Bến', duration_key: 'night1_duration_s', start: [0, 0, 0],
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(0, 0, 12, 0, 45, 8), ...ring(0, 0, 33, 0, 22.5, 16)],
    shadePoints: ring(0, 0, 37, 15, 30, 12),
    shadeEvery: 480, shadeMax: 6, shadeSpeedMul: 1, drifters: false, wind: false,
    pads: [], charms: [],
    ground(x, z) { return Math.hypot(x, z) <= 40 + EPS ? 0 : null; },
    blocked() { return false; },
  },
  2: {
    name: 'Đảo Cau', duration_key: 'night2_duration_s', start: [0, 0, 0],
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [...ring(0, 0, 10, 0, 90, 4), ...ring(0, 0, 22, 0, 45, 8), ...ring(70, 0, 10, 0, 90, 4), ...ring(70, 0, 22, 0, 45, 8)],
    shadePoints: [...ring(0, 0, 26, 22.5, 45, 8), ...ring(70, 0, 26, 22.5, 45, 8)],
    shadeEvery: 420, shadeMax: 8, shadeSpeedMul: 1, drifters: true, wind: false,
    pads: [
      { pos: [20, 0, 18], vy: 14, h: 24, toward: [70, 0, 0] },
      { pos: [50, 0, -18], vy: 14, h: 24, toward: [0, 0, 0] },
    ],
    charms: [[35, 0, 0]],
    ground(x, z) {
      if (Math.hypot(x, z) <= 28 + EPS || Math.hypot(x - 70, z) <= 28 + EPS) return 0;
      if (x >= 26 - EPS && x <= 44 + EPS && z >= -2 - EPS && z <= 2 + EPS) return 0;
      return null;
    },
    blocked() { return false; },
  },
  3: {
    name: 'Đảo Chuông', duration_key: 'night3_duration_s', start: [0, 0, -30],
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(0, 0, 34, 0, 20, 18), ...ring(0, 0, 18, 20, 20, 8, 3), ...ring(0, 0, 5, 45, 90, 4, 6)],
    shadePoints: ring(0, 0, 43, 0, 22.5, 16),
    shadeEvery: 360, shadeMax: 10, shadeSpeedMul: 4.5 / 4, drifters: true, wind: true,
    pads: [{ pos: [0, 3, 13], vy: 12, h: 8, dir: [0, -1] }],
    charms: [[30, 0, 25], [-30, 0, 25]],
    ground(x, z) {
      const r = Math.hypot(x, z);
      if (r > 45 + EPS) return null;
      if (r <= 8 + EPS) return 6;
      if (z > 0 && r >= 12 - EPS && r <= 24 + EPS) return 3;
      for (const a of [30, 150]) {
        const ux = Math.cos(deg(a)), uz = Math.sin(deg(a));
        const along = x * ux + z * uz, lat = Math.abs(-x * uz + z * ux);
        if (lat <= 1.5 + EPS && along >= 24 - EPS && along <= 30 + EPS) return (3 * (30 - along)) / 6;
      }
      return 0;
    },
    blocked(x, z) { return Math.hypot(x, z) < 2; }, // bell tower
  },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ScenarioError extends Error {}

export function durationOf(night) { return T[NIGHTS[night].duration_key]; }

export function createGame({ seed = 1, night = 1, scenario = null, bench = false } = {}) {
  const N = NIGHTS[night];
  if (!N) throw new ScenarioError(`unknown night ${night}`);
  const g = {
    rng: mulberry32(seed), night, N,
    tick: 0, simTick: 0, paused: false, state: 'playing', score: 0,
    duration: durationOf(night),
    player: {
      pos: [...N.start], vel: [0, 0, 0], grounded: true, facing: [0, 1],
      flames: T.flames, carried: 0, invuln: 0, dashCd: 0, pulseCd: 0, charm: 0,
      dashLeft: 0, dashDir: [0, 1], launch: null, fallen: false, fallWait: 0, successfulLights: 0,
    },
    lanterns: N.lanterns.map((p, i) => ({ id: `L${i + 1}`, pos: [...p], lit: false, deposited: 0, fuel: 0, everLit: false, relitCount: 0 })),
    shades: [], motes: [], drifters: [],
    charms: N.charms.map((p, i) => ({ id: `C${i + 1}`, pos: [...p], available: true, respawn: 0 })),
    nextMote: 1, nextShade: 1, nextDrifter: 1,
    randomMotes: true, randomShades: true, randomDrifters: N.drifters,
    windEnabled: N.wind, wind: { active: 0, dir: null },
    input: { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false },
    events: [], bench, // bench: Ticket-04 benchmark scene (no spawns/damage/pickup/fuel decay/end; shades only wander)
  };
  // 20 random motes at 20 distinct spawn points
  const pts = N.motePoints.map((_, i) => i);
  for (let i = 0; i < STD.mote_initial && pts.length; i++) {
    const k = Math.floor(g.rng() * pts.length);
    addMote(g, N.motePoints[pts.splice(k, 1)[0]], 'random');
  }
  if (scenario) applyScenario(g, scenario);
  return g;
}

function addMote(g, pos, kind, ttl = null) {
  const m = { id: `M${g.nextMote++}`, pos: [pos[0], pos[1], pos[2]], kind, ttl };
  g.motes.push(m);
  return m;
}
function addShade(g, pos, id, state = 'spawning', left) {
  let sid = id;
  if (sid == null) {
    while (g.shades.some((s) => s.id === `S${g.nextShade}`)) g.nextShade++;
    sid = `S${g.nextShade++}`;
  }
  const gr = g.N.ground(pos[0], pos[2]);
  const s = {
    id: String(sid), pos: [pos[0], pos[1], pos[2]], hoff: gr === null ? STD.shade_y : pos[1] - gr,
    mode: 'wander', spawning: 0, stun: 0, push: 0, pushDir: [1, 0], recoil: 0, recoilDir: [1, 0], evict: 0,
    wanderDir: null, wanderLeft: 0, targetId: null, drainTicks: 0,
  };
  setShadeState(s, state, left);
  g.shades.push(s);
  return s;
}
function setShadeState(s, state, left) {
  if (state === 'spawning') s.spawning = left ?? STD.shade_spawning;
  else if (state === 'stunned') s.stun = left ?? STD.stun_ticks;
  else if (state === 'recoil') s.recoil = left ?? STD.recoil_ticks;
  else if (state === 'chase' || state === 'wander' || state === 'drain') s.mode = state;
  else throw new ScenarioError(`unknown shade state ${state}`);
}
export function shadeState(s) {
  if (s.spawning > 0) return 'spawning';
  if (s.stun > 0) return 'stunned';
  if (s.recoil > 0 || s.evict > 0) return 'recoil';
  return s.mode; // wander | chase | drain
}
function addDrifter(g, pos, id, state = 'idle', stolen = 0) {
  const d = { id: id ?? `D${g.nextDrifter++}`, pos: [pos[0], pos[1], pos[2]], state, stolen, left: 0, stoleOnce: stolen > 0, ang: 0 };
  if (state === 'flee') d.left = STD.drifter_flee_ticks;
  g.drifters.push(d);
  return d;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isInt = (v) => Number.isInteger(v) && v >= 0;

export function applyScenario(g, sc) {
  const E = (m) => { throw new ScenarioError(m); };
  if (sc === null || typeof sc !== 'object' || Array.isArray(sc)) E('scenario must be an object');
  const p = g.player;
  if (sc.player !== undefined) {
    const q = sc.player;
    if (typeof q !== 'object' || q === null || Array.isArray(q)) E('player must be object');
    if (q.pos !== undefined) { if (!isVec3(q.pos)) E('player.pos'); p.pos = [...q.pos]; }
    if (q.carried !== undefined) { if (!isInt(q.carried)) E('player.carried'); p.carried = q.carried; }
    if (q.flames !== undefined) { if (!isInt(q.flames)) E('player.flames'); p.flames = q.flames; }
    const tk = { invuln_ticks: 'invuln', dash_cd_ticks: 'dashCd', pulse_cd_ticks: 'pulseCd', charm_ticks: 'charm', successful_lights: 'successfulLights' };
    for (const [k, f] of Object.entries(tk)) if (q[k] !== undefined) { if (!isInt(q[k])) E(`player.${k}`); p[f] = q[k]; }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'])
    if (sc[k] !== undefined && typeof sc[k] !== 'boolean') E(`${k} must be boolean`);
  if (sc.random_motes !== undefined) g.randomMotes = sc.random_motes;
  if (sc.random_shades !== undefined) g.randomShades = sc.random_shades;
  if (sc.random_drifters !== undefined) g.randomDrifters = sc.random_drifters;
  if (sc.wind_enabled !== undefined) g.windEnabled = sc.wind_enabled;
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) E('motes must be array');
    g.motes = []; g.nextMote = 1;
    for (const m of sc.motes) {
      const pos = Array.isArray(m) ? m : m && m.pos;
      if (!isVec3(pos)) E('mote pos');
      const kind = (!Array.isArray(m) && m.kind) || 'random';
      if (kind !== 'random' && kind !== 'dropped') E('mote kind');
      let ttl = null;
      if (kind === 'dropped') {
        ttl = STD.drop_ttl;
        if (m.ttl_ticks !== undefined) { if (!isInt(m.ttl_ticks)) E('mote ttl_ticks'); ttl = m.ttl_ticks; }
        else if (m.ttl_s !== undefined && m.ttl_s !== null) { if (!isNum(m.ttl_s)) E('mote ttl_s'); ttl = secToTicks(m.ttl_s); }
      }
      addMote(g, pos, kind, ttl);
    }
  }
  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) E('shades must be array');
    g.shades = []; g.nextShade = 1;
    for (const s of sc.shades) {
      if (!s || !isVec3(s.pos)) E('shade pos');
      if (s.id !== undefined && typeof s.id !== 'string') E('shade id');
      if (s.id !== undefined && g.shades.some((x) => x.id === s.id)) E('duplicate shade id');
      if (s.state !== undefined && typeof s.state !== 'string') E('shade state');
      if (s.state_ticks_left !== undefined && !isInt(s.state_ticks_left)) E('shade state_ticks_left');
      if (s.target_lantern_id !== undefined && typeof s.target_lantern_id !== 'string') E('shade target_lantern_id');
      const sh = addShade(g, s.pos, s.id, s.state ?? 'wander', s.state_ticks_left);
      if (s.target_lantern_id !== undefined) sh.targetId = s.target_lantern_id;
    }
  }
  if (sc.drifters !== undefined) {
    if (!Array.isArray(sc.drifters)) E('drifters must be array');
    g.drifters = []; g.nextDrifter = 1;
    for (const d of sc.drifters) {
      if (!d || !isVec3(d.pos)) E('drifter pos');
      const st = d.state ?? 'idle';
      if (!['idle', 'chase', 'flee', 'removed'].includes(st)) E('drifter state');
      if (d.stolen !== undefined && !isInt(d.stolen)) E('drifter stolen');
      if (d.id !== undefined && typeof d.id !== 'string') E('drifter id');
      const x = addDrifter(g, d.pos, d.id, st, d.stolen ?? 0);
      if (d.state_ticks_left !== undefined) { if (!isInt(d.state_ticks_left)) E('drifter state_ticks_left'); x.left = d.state_ticks_left; }
    }
    let n = 1; while (g.drifters.some((x) => x.id === `D${n}`)) n++; g.nextDrifter = n;
  }
  if (sc.charms !== undefined) {
    if (!Array.isArray(sc.charms)) E('charms must be array');
    g.charms = sc.charms.map((c, i) => {
      if (!c || typeof c !== 'object') E('charm');
      const pos = c.pos ?? g.N.charms[i];
      if (!isVec3(pos)) E('charm pos');
      const ch = { id: c.id ?? `C${i + 1}`, pos: [...pos], available: c.available ?? true, respawn: 0 };
      if (typeof ch.available !== 'boolean') E('charm available');
      if (c.respawn_ticks !== undefined) { if (!isInt(c.respawn_ticks)) E('charm respawn_ticks'); ch.respawn = c.respawn_ticks; }
      else if (c.respawn_s !== undefined && c.respawn_s !== null) { if (!isNum(c.respawn_s)) E('charm respawn_s'); ch.respawn = secToTicks(c.respawn_s); }
      else if (!ch.available) ch.respawn = STD.charm_respawn;
      return ch;
    });
  }
  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) E('lanterns must be array');
    for (const l of sc.lanterns) {
      const L = l && g.lanterns.find((x) => x.id === l.id);
      if (!L) E(`unknown lantern id ${l && l.id}`);
      if (l.pos !== undefined) { if (!isVec3(l.pos)) E('lantern pos'); L.pos = [...l.pos]; }
      if (l.deposited !== undefined) { if (!isNum(l.deposited)) E('lantern deposited'); L.deposited = l.deposited; }
      if (l.lit !== undefined) { if (typeof l.lit !== 'boolean') E('lantern lit'); L.lit = l.lit; }
      if (l.ever_lit !== undefined) { if (typeof l.ever_lit !== 'boolean') E('lantern ever_lit'); L.everLit = l.ever_lit; }
      else if (l.lit !== undefined) L.everLit = L.lit || L.everLit;
      if (l.fuel !== undefined) { if (!isNum(l.fuel) || l.fuel < 0) E('lantern fuel'); }
      L.fuel = L.lit ? Math.min(fuelMax(), Math.round((l.fuel ?? (l.lit !== undefined ? T.fuel_max : L.fuel / FU)) * FU)) : 0;
      if (L.lit && L.fuel <= 0) E('lit lantern needs fuel > 0');
    }
  }
  if (sc.time_left_s !== undefined) { if (!isNum(sc.time_left_s)) E('time_left_s'); g.duration = sc.time_left_s; }
  const gr = g.N.ground(p.pos[0], p.pos[2]);
  p.grounded = gr !== null && Math.abs(p.pos[1] - gr) <= EPS;
}

const fuel1 = (L) => (L.lit ? Math.round((L.fuel / FU) * 10) / 10 : 0);
function nearestLantern(list, pos) {
  let best = null, bd = Infinity;
  for (const L of list) { const d = dxz(L.pos, pos); if (!best || d < bd - EPS || (Math.abs(d - bd) <= EPS && natCmp(L.id, best.id) < 0)) { best = L; bd = d; } }
  return best;
}
function evictFrom(g, L) { // shades inside a (re)secured lantern are pushed to the edge over ≤ 30 ticks, harmless meanwhile
  for (const s of g.shades) if (dxz(s.pos, L.pos) < T.safe_radius - EPS) {
    s.evict = STD.evict_ticks; s.evictFrom = L;
    if (s.mode === 'drain') { s.mode = 'wander'; s.drainTicks = 0; }
  }
}
export const timeLeft = (g) => Math.max(0, g.duration - g.simTick / 60);
function emit(g, name, data) { g.events.push({ type: 'event', tick: g.tick + 1, name, data }); }

export function applyFrame(g, f) {
  const prev = g.input;
  const next = { ...prev };
  if (f) for (const k of Object.keys(next)) if (f[k] !== undefined) next[k] = f[k];
  g.input = next;
  const e = {};
  for (const b of ['jump', 'interact', 'pulse', 'dash', 'pause']) e[b] = !!next[b] && !prev[b];
  return e;
}

const playerSpeed = (p) => (p.charm > 0 ? STD.charm_speed : T.player_speed);

// Horizontal move with walls (higher ground > step); sea is allowed (you fall); tower blocks.
function tryMove(g, pos, dx, dz) {
  const N = g.N;
  const ok = (x, z) => {
    if (N.blocked(x, z)) return false;
    const gr = N.ground(x, z);
    return !(gr !== null && gr > pos[1] + STD.step);
  };
  if (ok(pos[0] + dx, pos[2] + dz)) { pos[0] += dx; pos[2] += dz; return; }
  if (dx && ok(pos[0] + dx, pos[2])) pos[0] += dx;
  if (dz && ok(pos[0], pos[2] + dz)) pos[2] += dz;
}

function dropMotes(g, center, n) {
  for (let i = 0; i < n; i++) {
    const a = g.rng() * Math.PI * 2;
    const r = STD.drop_rmin + g.rng() * (STD.drop_rmax - STD.drop_rmin);
    const x = center[0] + Math.cos(a) * r, z = center[2] + Math.sin(a) * r;
    const gr = g.N.ground(x, z);
    addMote(g, [x, gr ?? center[1], z], 'dropped', STD.drop_ttl);
  }
}

// One fixed 1/60 s step. `frame` = sparse input frame for this tick (or null).
export function step(g, frame) {
  if (g.state !== 'playing' && g.state !== 'paused') return;
  const p = g.player, N = g.N;

  // 1. input (pause first; if we just paused, stop here)
  const edge = applyFrame(g, frame);
  if (edge.pause) {
    if (g.paused) { g.paused = false; g.state = 'playing'; emit(g, 'resumed', {}); }
    else { g.paused = true; g.state = 'paused'; emit(g, 'paused', {}); g.tick++; return; }
  } else if (g.paused) { g.tick++; return; }
  const inp = g.input;

  // 2. counters
  if (p.dashCd > 0) p.dashCd--;
  if (p.pulseCd > 0) p.pulseCd--;
  if (p.invuln > 0) p.invuln--;
  if (p.charm > 0) p.charm--;
  if (p.fallWait > 0) p.fallWait--;
  for (const s of g.shades) {
    if (s.spawning > 0) { s.spawning--; if (s.spawning === 0) s.mode = 'wander'; }
    if (s.stun > 0) s.stun--;
    if (s.recoil > 0) s.recoil--;
  }
  for (const m of g.motes) if (m.ttl !== null) m.ttl--;
  g.motes = g.motes.filter((m) => m.ttl === null || m.ttl > 0);
  for (const c of g.charms) if (!c.available && c.respawn > 0) c.respawn--;
  for (const d of g.drifters) if (d.state === 'flee' && d.left > 0) d.left--;
  if (g.wind.active > 0) g.wind.active--;
  // 2b. fuel: decay 1 unit/tick (= 1.0/s) + 5 units/tick per draining shade (= 5/s), then empty lanterns go out
  if (!g.bench) for (const L of g.lanterns) if (L.lit) L.fuel -= Math.round(T.fuel_decay_per_s * FU / 60);
  for (const s of g.shades) {
    if (shadeState(s) !== 'drain') continue;
    const L = g.lanterns.find((x) => x.id === s.targetId);
    if (!L || !L.lit) continue;
    L.fuel -= Math.round(T.drain_per_s * FU / 60);
    s.drainTicks++;
    if (s.drainTicks % 60 === 0) emit(g, 'fuel_drain', { lantern_id: L.id, shade_id: s.id, fuel: fuel1(L) });
  }
  for (const L of g.lanterns) if (L.lit && L.fuel <= 0) {
    L.lit = false; L.fuel = 0; L.deposited = 0; L.everLit = true;
    emit(g, 'lantern_out', { lantern_id: L.id });
  }

  // 3. move player (jump, dash, pads, wind) then fall check
  if (p.fallen) {
    if (p.fallWait === 0) {
      p.fallen = false; p.pos = [...N.start]; p.vel = [0, 0, 0]; p.launch = null; p.dashLeft = 0;
      p.grounded = true; p.invuln = secToTicks(T.invuln_s);
    }
  } else {
    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = deg(inp.cam_yaw_deg);
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-9) p.facing = [wx / wl, wz / wl];

    if (edge.dash && p.dashLeft === 0 && (p.dashCd === 0 || p.charm > 0)) {
      p.dashLeft = secToTicks(T.dash_duration_s);
      p.dashCd = p.charm > 0 ? 0 : secToTicks(T.dash_cooldown_s);
      p.dashDir = wl > 1e-9 ? [wx / wl, wz / wl] : [...p.facing];
      emit(g, 'dash', {});
    }
    if (edge.jump && p.grounded && p.dashLeft === 0) { p.vel[1] = STD.jump_speed; p.grounded = false; }

    let hx, hz;
    if (p.dashLeft > 0) { hx = p.dashDir[0] * T.dash_speed; hz = p.dashDir[1] * T.dash_speed; }
    else if (p.launch) { [hx, hz] = p.launch; }
    else { hx = wx * playerSpeed(p); hz = wz * playerSpeed(p); }
    if (g.wind.active > 0 && g.wind.dir !== null) {
      hx += Math.cos(deg(g.wind.dir)) * STD.wind_speed;
      hz += Math.sin(deg(g.wind.dir)) * STD.wind_speed;
    }
    const x0 = p.pos[0], z0 = p.pos[2];
    tryMove(g, p.pos, hx * DT, hz * DT);
    p.vel[0] = (p.pos[0] - x0) / DT; p.vel[2] = (p.pos[2] - z0) / DT;

    const gr = N.ground(p.pos[0], p.pos[2]);
    if (p.dashLeft > 0) {
      p.dashLeft--; p.vel[1] = 0; // dash keeps height
      if (p.grounded && gr !== null && Math.abs(p.pos[1] - gr) <= STD.step) p.pos[1] = gr;
      p.grounded = gr !== null && Math.abs(p.pos[1] - gr) <= EPS;
    } else if (p.grounded && gr !== null && Math.abs(p.pos[1] - gr) <= STD.step && p.vel[1] <= 0) {
      p.pos[1] = gr; p.vel[1] = 0;
    } else {
      p.grounded = false;
      p.vel[1] -= STD.gravity * DT;
      p.pos[1] += p.vel[1] * DT;
      if (gr !== null && p.pos[1] <= gr && p.vel[1] <= 0 && p.pos[1] > gr - 1.0) {
        p.pos[1] = gr; p.vel[1] = 0; p.grounded = true; p.launch = null;
      }
    }
    // jump pads
    if (p.grounded) {
      for (const pad of N.pads) {
        if (within(dxz(p.pos, pad.pos), 1) && Math.abs(p.pos[1] - pad.pos[1]) <= 0.5) {
          let ux, uz;
          if (pad.dir) [ux, uz] = pad.dir;
          else { ux = pad.toward[0] - pad.pos[0]; uz = pad.toward[2] - pad.pos[2]; const l = Math.hypot(ux, uz); ux /= l; uz /= l; }
          p.launch = [ux * pad.h, uz * pad.h];
          p.vel[1] = pad.vy; p.grounded = false;
          break;
        }
      }
    }
    if (p.pos[1] < STD.fall_y) {
      const lost = p.carried;
      p.flames -= 1; p.carried = 0; p.fallen = true; p.fallWait = STD.fall_wait;
      p.vel = [0, 0, 0]; p.launch = null; p.dashLeft = 0;
      emit(g, 'player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }

  // 4. pick up motes and charms
  if (!p.fallen && !g.bench) {
    for (let i = 0; i < g.motes.length && p.carried < capacityOf(p);) {
      const m = g.motes[i];
      if (within(dxz(m.pos, p.pos), T.pickup_radius) && Math.abs(p.pos[1] - m.pos[1]) <= STD.pickup_dy + EPS) {
        g.motes.splice(i, 1); p.carried++;
        emit(g, 'mote_picked', { carried: p.carried });
      } else i++;
    }
    for (const c of g.charms) {
      if (c.available && within(dxz(c.pos, p.pos), T.pickup_radius) && Math.abs(p.pos[1] - c.pos[1]) <= STD.pickup_dy + EPS) {
        c.available = false; c.respawn = STD.charm_respawn; p.charm = STD.charm_ticks;
        emit(g, 'charm_picked', { charm_id: c.id, charm_ticks: STD.charm_ticks });
      }
    }
  }

  // 5. interact with lanterns: unlit → deposit / light; lit & not full → refuel
  if (edge.interact && !p.fallen && p.carried > 0) {
    const used = (L) => Math.min(p.carried, Math.ceil((fuelMax() - L.fuel) / (T.fuel_per_mote * FU)));
    let best = null, bd = Infinity;
    for (const L of g.lanterns) {
      if (L.lit && used(L) <= 0) continue; // full lanterns cannot be selected
      const d = dxz(L.pos, p.pos);
      if (!within(d, T.interact_radius) || Math.abs(p.pos[1] - L.pos[1]) > STD.interact_dy + EPS) continue;
      if (!best || d < bd - EPS || (Math.abs(d - bd) <= EPS && natCmp(L.id, best.id) < 0)) { bd = d; best = L; }
    }
    if (best && best.lit) {
      const u = used(best);
      best.fuel = Math.min(fuelMax(), best.fuel + u * T.fuel_per_mote * FU);
      p.carried -= u; g.score += T.score.per_mote * u;
      emit(g, 'refuel', { lantern_id: best.id, amount: u, fuel: fuel1(best) });
      if (best.fuel >= lowFuel()) evictFrom(g, best);
    } else if (best) {
      const cost = best.everLit ? T.relight_cost : T.lantern_cost;
      const amount = Math.min(p.carried, Math.max(0, cost - best.deposited));
      if (amount > 0) {
        p.carried -= amount; best.deposited += amount; g.score += T.score.per_mote * amount;
        emit(g, 'deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= cost) {
        const relight = best.everLit;
        best.lit = true; best.fuel = fuelMax(); best.everLit = true;
        if (relight) best.relitCount++;
        p.successfulLights++;
        g.score += relight ? T.score.per_relight : T.score.per_lantern;
        emit(g, 'lantern_lit', { lantern_id: best.id, relight });
        evictFrom(g, best);
      }
    }
  }

  // 6. safe zones: shades inside a just-lit lantern are pushed to the edge over ≤ 30 ticks
  for (const s of g.shades) {
    if (s.evict <= 0) continue;
    const L = s.evictFrom, d = dxz(s.pos, L.pos);
    let ux = s.pos[0] - L.pos[0], uz = s.pos[2] - L.pos[2];
    if (d < 1e-9) { ux = 1; uz = 0; } else { ux /= d; uz /= d; }
    const nd = d + Math.max(0, T.safe_radius - d) / s.evict;
    s.pos[0] = L.pos[0] + ux * nd; s.pos[2] = L.pos[2] + uz * nd;
    s.evict--;
  }

  // 7. pulse
  if (edge.pulse && !p.fallen && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost; p.pulseCd = secToTicks(T.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + STD.pulse_h, p.pos[2]];
    const d3 = (q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]);
    const ids = [];
    for (const s of [...g.shades].sort((a, b) => natCmp(a.id, b.id))) {
      if (!within(d3(s.pos), T.pulse_radius)) continue;
      const wasDrain = shadeState(s) === 'drain';
      s.stun = secToTicks(T.pulse_stun_s); s.push = STD.push_ticks; s.spawning = 0; s.recoil = 0;
      if (s.mode === 'drain') { s.mode = 'wander'; s.drainTicks = 0; } // stun ends → wander
      const d = dxz(s.pos, p.pos);
      s.pushDir = d < 1e-9 ? [1, 0] : [(s.pos[0] - p.pos[0]) / d, (s.pos[2] - p.pos[2]) / d];
      g.score += wasDrain ? T.score.per_stun_drain : T.score.per_stun; ids.push(s.id);
    }
    for (const d of g.drifters) {
      if (!within(d3(d.pos), T.pulse_radius)) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.left = STD.drifter_flee_ticks; d.stoleOnce = true; }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        for (let i = 0; i < amount; i++) addMote(g, [d.pos[0], N.ground(d.pos[0], d.pos[2]) ?? 0, d.pos[2]], 'dropped', STD.drop_ttl);
        d.stolen = 0; d.left = STD.drifter_drop_ticks;
        emit(g, 'drifter_drop', { drifter_id: d.id, amount });
      }
    }
    emit(g, 'pulse', { stunned_ids: ids });
  }

  // 8. move shades and drifters
  const speed = T.shade_speed * N.shadeSpeedMul;
  for (const s of g.shades) {
    const stepTo = (dx, dz) => {
      const nx = s.pos[0] + dx, nz = s.pos[2] + dz;
      if (N.blocked(nx, nz)) return false;
      s.pos[0] = nx; s.pos[2] = nz; return true;
    };
    if (s.spawning > 0 || s.evict > 0) { /* stays */ }
    else if (s.stun > 0) {
      if (s.push > 0) { const k = T.pulse_push_m / STD.push_ticks; s.push = stepTo(s.pushDir[0] * k, s.pushDir[1] * k) ? s.push - 1 : 0; }
    } else if (s.recoil > 0) {
      const k = STD.recoil_m / STD.recoil_ticks; stepTo(s.recoilDir[0] * k, s.recoilDir[1] * k);
    } else {
      const d = dxz(s.pos, p.pos);
      const sees = !p.fallen && !g.bench;
      if (s.mode === 'drain') {
        const L = g.lanterns.find((x) => x.id === s.targetId);
        if (sees && within(d, STD.drain_chase_dist)) { s.mode = 'chase'; s.drainTicks = 0; }
        else if (!L || !L.lit || L.fuel >= lowFuel() || dxz(s.pos, L.pos) > STD.drain_dist + EPS) { s.mode = 'wander'; s.drainTicks = 0; }
      } else if (s.mode === 'chase') { if (!sees || d > STD.shade_lose + EPS) s.mode = 'wander'; }
      else if (sees && within(d, STD.shade_detect)) s.mode = 'chase';
      if (s.mode === 'chase') {
        if (d > 1e-9) { const st = Math.min(speed * DT, d); stepTo(((p.pos[0] - s.pos[0]) / d) * st, ((p.pos[2] - s.pos[2]) / d) * st); }
      } else if (s.mode === 'wander') {
        // weak lantern (lit, fuel < 30): scenario target first, else nearest (tie → smaller id)
        const weak = (L) => L.lit && L.fuel < lowFuel();
        let tgt = g.lanterns.find((L) => L.id === s.targetId && weak(L)) || null;
        if (!tgt) tgt = nearestLantern(g.lanterns.filter(weak), s.pos);
        if (tgt) {
          s.targetId = tgt.id;
          const dl = dxz(s.pos, tgt.pos);
          if (dl > STD.drain_dist + EPS) { const st = Math.min(speed * DT, dl - STD.drain_dist); stepTo(((tgt.pos[0] - s.pos[0]) / dl) * st, ((tgt.pos[2] - s.pos[2]) / dl) * st); }
          if (dxz(s.pos, tgt.pos) <= STD.drain_dist + EPS) { s.mode = 'drain'; s.drainTicks = 0; }
        } else {
          const home = nearestLantern(g.lanterns.filter((L) => !L.lit), s.pos); // "đi về đèn tắt gần nhất như trước"
          const k = STD.shade_wander_speed * DT;
          if (home && dxz(s.pos, home.pos) > T.safe_radius) {
            const dl = dxz(s.pos, home.pos); stepTo(((home.pos[0] - s.pos[0]) / dl) * k, ((home.pos[2] - s.pos[2]) / dl) * k);
          } else {
            if (s.wanderLeft <= 0 || !s.wanderDir) { const a = g.rng() * Math.PI * 2; s.wanderDir = [Math.cos(a), Math.sin(a)]; s.wanderLeft = 120; }
            s.wanderLeft--;
            if (N.ground(s.pos[0] + s.wanderDir[0] * k, s.pos[2] + s.wanderDir[1] * k) !== null) stepTo(s.wanderDir[0] * k, s.wanderDir[1] * k);
            else s.wanderLeft = 0;
          }
        }
      }
    }
    if (s.evict <= 0) for (const L of g.lanterns) {
      if (!safeLantern(L)) continue;
      const d = dxz(s.pos, L.pos);
      if (d < T.safe_radius - EPS) {
        let ux = s.pos[0] - L.pos[0], uz = s.pos[2] - L.pos[2];
        if (d < 1e-9) { ux = 1; uz = 0; } else { ux /= d; uz /= d; }
        s.pos[0] = L.pos[0] + ux * T.safe_radius; s.pos[2] = L.pos[2] + uz * T.safe_radius;
      }
    }
    const gr = N.ground(s.pos[0], s.pos[2]);
    if (gr !== null) s.pos[1] = gr + s.hoff;
  }
  for (const d of g.drifters) {
    if (d.state === 'removed') continue;
    const dist = dxz(d.pos, p.pos);
    if (d.state === 'flee') {
      if (d.left <= 0) { d.state = 'removed'; continue; }
      let ux = d.pos[0] - p.pos[0], uz = d.pos[2] - p.pos[2];
      if (dist < 1e-9) { ux = 1; uz = 0; } else { ux /= dist; uz /= dist; }
      d.pos[0] += ux * STD.drifter_speed * DT; d.pos[2] += uz * STD.drifter_speed * DT;
      continue;
    }
    const want = !p.fallen && !d.stoleOnce && p.carried >= STD.drifter_chase_carry && within(dist, STD.drifter_chase_dist);
    d.state = want ? 'chase' : 'idle';
    if (d.state === 'chase') {
      if (dist > 1e-9) { const st = Math.min(STD.drifter_speed * DT, dist); d.pos[0] += ((p.pos[0] - d.pos[0]) / dist) * st; d.pos[2] += ((p.pos[2] - d.pos[2]) / dist) * st; }
    } else {
      d.ang += 0.01; // slow lazy circle
      d.pos[0] += Math.cos(d.ang) * STD.drifter_idle_speed * DT; d.pos[2] += Math.sin(d.ang) * STD.drifter_idle_speed * DT;
    }
  }

  // 9. contacts: drifters steal first, then shades hit (ascending id)
  if (!p.fallen && !g.bench) {
    for (const d of [...g.drifters].sort((a, b) => natCmp(a.id, b.id))) {
      if (d.state !== 'chase' || d.stoleOnce || p.carried <= 0) continue;
      if (!within(dxz(d.pos, p.pos), STD.drifter_hit)) continue;
      const amount = Math.min(STD.drifter_steal, p.carried);
      p.carried -= amount; d.stolen = amount; d.stoleOnce = true; d.state = 'flee'; d.left = STD.drifter_flee_ticks;
      emit(g, 'drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    if (p.invuln === 0) {
      for (const s of [...g.shades].sort((a, b) => natCmp(a.id, b.id))) {
        const st = shadeState(s);
        if (st !== 'wander' && st !== 'chase') continue;
        if (!within(dxz(s.pos, p.pos), T.shade_hit_radius) || Math.abs(p.pos[1] - s.pos[1]) > STD.hit_dy + EPS) continue;
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped; p.flames -= 1; p.invuln = secToTicks(T.invuln_s);
        dropMotes(g, p.pos, dropped);
        const d = dxz(s.pos, p.pos);
        s.recoil = STD.recoil_ticks;
        s.recoilDir = d < 1e-9 ? [1, 0] : [(s.pos[0] - p.pos[0]) / d, (s.pos[2] - p.pos[2]) / d];
        // first of 60 recoil moves happens on the hit tick → exactly 2 m over 60 ticks
        const k = STD.recoil_m / STD.recoil_ticks;
        if (!N.blocked(s.pos[0] + s.recoilDir[0] * k, s.pos[2] + s.recoilDir[1] * k)) { s.pos[0] += s.recoilDir[0] * k; s.pos[2] += s.recoilDir[1] * k; }
        emit(g, 'player_hit', { by: 'shade', flames: p.flames, dropped });
        break;
      }
    }
  }

  // 10. spawns (new entities interact from next tick)
  const t = g.simTick + 1;
  if (g.randomMotes && t % STD.mote_every === 0 && g.motes.length < STD.mote_cap) {
    const free = N.motePoints.filter((pt) => !g.motes.some((m) => dxz(m.pos, pt) < 0.5));
    if (free.length) addMote(g, free[Math.floor(g.rng() * free.length)], 'random');
  }
  if (g.randomShades) {
    let n = 0;
    if (t === STD.shade_first) n = 2;
    else if (t > STD.shade_first && (t - STD.shade_first) % N.shadeEvery === 0) n = 1;
    for (let i = 0; i < n; i++) {
      if (g.shades.length >= N.shadeMax) break;
      const ok = N.shadePoints.filter((pt) => dxz(pt, p.pos) >= STD.shade_min_player_dist - EPS);
      if (!ok.length) break;
      const pt = ok[Math.floor(g.rng() * ok.length)];
      const s = addShade(g, [pt[0], (N.ground(pt[0], pt[2]) ?? 0) + STD.shade_y, pt[2]]);
      emit(g, 'shade_spawned', { id: s.id });
    }
  }
  if (g.randomDrifters && t % STD.drifter_every === 0) {
    const alive = g.drifters.filter((d) => d.state !== 'removed').length;
    if (alive < STD.drifter_max) {
      const pt = N.shadePoints[Math.floor(g.rng() * N.shadePoints.length)];
      addDrifter(g, [pt[0], (N.ground(pt[0], pt[2]) ?? 0) + STD.drifter_y, pt[2]]);
    }
  }
  for (const c of g.charms) if (!c.available && c.respawn === 0) c.available = true;
  if (g.windEnabled) {
    if (t % STD.wind_every === STD.wind_every - STD.wind_warn) g.wind.dir = Math.floor(g.rng() * 360);
    if (t % STD.wind_every === 0) { if (g.wind.dir === null) g.wind.dir = Math.floor(g.rng() * 360); g.wind.active = STD.wind_ticks; }
  }

  // 11. win / lose (after every update of the tick): no flames → lost; at dawn: enough lit → won, else lost
  g.simTick++;
  let reason = null;
  if (g.bench) { /* bench: night never ends */ }
  else if (p.flames <= 0) { g.state = 'lost'; reason = 'no_flames'; }
  else if (g.duration - g.simTick / 60 <= 1e-9) {
    const lit = g.lanterns.filter((L) => L.lit);
    if (lit.length >= winNeed(g)) {
      g.state = 'won'; reason = 'dawn_survived';
      for (const L of lit) g.score += T.score.per_lantern_dawn + Math.floor(L.fuel / FU + 1e-9);
      g.score += T.score.per_flame_left * p.flames;
    } else { g.state = 'lost'; reason = 'dawn'; }
  }
  if (reason) emit(g, 'game_over', { result: g.state, reason });
  g.tick++;
}

// Ticks until the next gust (render warning), or null.
export function windWarning(g) {
  if (!g.windEnabled || g.wind.active > 0) return null;
  const left = STD.wind_every - (g.simTick % STD.wind_every);
  return left <= STD.wind_warn ? left : null;
}

export function snapshot(g) {
  const p = g.player;
  return {
    type: 'snapshot', tick: g.tick, sim_tick: g.simTick, night: g.night, state: g.state,
    time_left_s: r3(timeLeft(g)), score: g.score,
    wind: { active: g.wind.active > 0, dir_deg: g.wind.dir },
    player: {
      pos: p.pos.map(r3), vel: p.vel.map(r3), grounded: p.grounded, invuln: p.invuln > 0,
      dash_cd_s: r3(p.dashCd / 60), pulse_cd_s: r3(p.pulseCd / 60), charm_s: r3(p.charm / 60),
      flames: p.flames, carried: p.carried, capacity: capacityOf(p),
    },
    lanterns: g.lanterns.map((L) => ({ id: L.id, pos: L.pos.map(r3), lit: L.lit, deposited: L.deposited, fuel: fuel1(L), ever_lit: L.everLit, relit_count: L.relitCount })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: shadeState(s) })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / 60) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, pos: c.pos.map(r3), available: c.available, respawn_s: r3(c.available ? 0 : c.respawn / 60) })),
  };
}

export function drainEvents(g) { const e = g.events; g.events = []; return e; }

// Ticket-04 benchmark scene: Night 1, exactly 200 wandering shades + 100 motes spread uniformly over the island
// (seeded), L1–L3 lit with fuel 100, Mây idle at (0,0,0). No spawns, damage, pickups, fuel decay or night end.
export function createBenchGame(seed = 42) {
  const rng = mulberry32(seed);
  const pt = (rMax) => { const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * rMax; return [Math.cos(a) * r, 0, Math.sin(a) * r]; };
  const shades = Array.from({ length: 200 }, () => { const q = pt(38); return { pos: [q[0], STD.shade_y, q[2]], state: 'wander' }; });
  const motes = Array.from({ length: 100 }, () => pt(38));
  return createGame({ seed, night: 1, bench: true, scenario: {
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    shades, motes, drifters: [], charms: [],
    lanterns: [{ id: 'L1', lit: true, fuel: 100 }, { id: 'L2', lit: true, fuel: 100 }, { id: 'L3', lit: true, fuel: 100 }],
  } });
}
