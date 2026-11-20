// Pure, deterministic game logic for Đảo Đèn Lồng. No DOM, no Math.random.
// Shared by the headless CLI (Node) and the browser renderer.
// Tuning comes from game.contract.json (single source of truth); call configure() first.
export let T = null;
export function configure(tuning) { T = tuning; }

// Extra numbers the contract has no slot for (documented in README).
export const EXTRA = {
  island_radius: 40,
  jump_speed: 6,
  gravity: 18,
  random_motes_count: 20,
  mote_respawn_s: 4,
  initial_shades: 2,
  shade_spawn_every_s: 30,
  max_shades: 6,
  shade_spawn_ring: 34,
  shade_y: 1.0,
  lantern_ring: 22,
};

const DT = 1 / 60;
export const secToTicks = (s) => Math.round(s * 60);

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

const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};
const dxz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
// "within r" means d <= r; EPS absorbs float drift from accumulating 1/60 s steps.
const EPS = 1e-6;
const within = (d, r) => d <= r + EPS;

export class ScenarioError extends Error {}

function randomIslandPoint(rng, minR, maxR) {
  const ang = rng() * Math.PI * 2;
  const r = Math.sqrt(minR * minR + rng() * (maxR * maxR - minR * minR));
  return [Math.cos(ang) * r, 0, Math.sin(ang) * r];
}

export function createGame({ seed = 1, scenario = null } = {}) {
  const rng = mulberry32(seed);
  const g = {
    rng,
    steps: 0,
    state: 'playing',
    result: null,
    score: 0,
    duration: T.night1_duration_s,
    player: { pos: [0, 0, 0], vy: 0, flames: T.flames, carried: 0, invuln: 0, pulseCd: 0 },
    lanterns: [],
    shades: [],
    motes: [],
    nextMote: 1,
    nextShade: 1,
    randomMotes: true,
    randomShades: true,
    moteTimer: 0,
    shadeTimer: 0,
    input: { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false },
    events: [],
  };
  for (let i = 0; i < T.lantern_count_night1; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / T.lantern_count_night1;
    g.lanterns.push({
      id: `L${i + 1}`,
      pos: [r3(Math.cos(a) * EXTRA.lantern_ring), 0, r3(Math.sin(a) * EXTRA.lantern_ring)],
      lit: false,
      deposited: 0,
    });
  }
  for (let i = 0; i < EXTRA.random_motes_count; i++) addMote(g, randomIslandPoint(rng, 4, EXTRA.island_radius - 2));
  for (let i = 0; i < EXTRA.initial_shades; i++) addShade(g, shadeSpawnPoint(g));
  if (scenario) applyScenario(g, scenario);
  return g;
}

function addMote(g, pos) {
  g.motes.push({ id: `M${g.nextMote++}`, pos: [pos[0], 0, pos[2]] });
}
function addShade(g, pos, id) {
  let sid = id;
  if (sid == null) {
    while (g.shades.some((s) => s.id === `S${g.nextShade}`)) g.nextShade++;
    sid = `S${g.nextShade++}`;
  }
  const s = { id: String(sid), pos: [pos[0], pos[1] ?? EXTRA.shade_y, pos[2]], stun: 0 };
  g.shades.push(s);
  return s;
}
function shadeSpawnPoint(g) {
  const a = g.rng() * Math.PI * 2;
  return [Math.cos(a) * EXTRA.shade_spawn_ring, EXTRA.shade_y, Math.sin(a) * EXTRA.shade_spawn_ring];
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);

export function applyScenario(g, sc) {
  if (sc === null || typeof sc !== 'object' || Array.isArray(sc)) throw new ScenarioError('scenario must be an object');
  if (sc.player !== undefined) {
    const p = sc.player;
    if (typeof p !== 'object' || p === null) throw new ScenarioError('player must be object');
    if (p.pos !== undefined) { if (!isVec3(p.pos)) throw new ScenarioError('player.pos'); g.player.pos = [...p.pos]; }
    if (p.carried !== undefined) { if (!isNum(p.carried)) throw new ScenarioError('player.carried'); g.player.carried = p.carried; }
    if (p.flames !== undefined) { if (!isNum(p.flames)) throw new ScenarioError('player.flames'); g.player.flames = p.flames; }
  }
  for (const k of ['random_motes', 'random_shades']) {
    if (sc[k] !== undefined && typeof sc[k] !== 'boolean') throw new ScenarioError(`${k} must be boolean`);
  }
  if (sc.random_motes !== undefined) g.randomMotes = sc.random_motes;
  if (sc.random_shades !== undefined) g.randomShades = sc.random_shades;
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) throw new ScenarioError('motes must be array');
    g.motes = [];
    g.nextMote = 1;
    for (const m of sc.motes) {
      const pos = Array.isArray(m) ? m : m && m.pos;
      if (!isVec3(pos)) throw new ScenarioError('mote pos');
      addMote(g, pos);
    }
  }
  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) throw new ScenarioError('shades must be array');
    g.shades = [];
    g.nextShade = 1;
    for (const s of sc.shades) {
      if (!s || !isVec3(s.pos)) throw new ScenarioError('shade pos');
      if (s.id !== undefined && typeof s.id !== 'string') throw new ScenarioError('shade id');
      if (s.id !== undefined && g.shades.some((x) => x.id === s.id)) throw new ScenarioError('duplicate shade id');
      addShade(g, s.pos, s.id);
    }
  }
  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) throw new ScenarioError('lanterns must be array');
    for (const l of sc.lanterns) {
      const L = l && g.lanterns.find((x) => x.id === l.id);
      if (!L) throw new ScenarioError(`unknown lantern id ${l && l.id}`);
      if (l.pos !== undefined) { if (!isVec3(l.pos)) throw new ScenarioError('lantern pos'); L.pos = [...l.pos]; }
      if (l.deposited !== undefined) { if (!isNum(l.deposited)) throw new ScenarioError('lantern deposited'); L.deposited = l.deposited; }
      if (l.lit !== undefined) { if (typeof l.lit !== 'boolean') throw new ScenarioError('lantern lit'); L.lit = l.lit; }
    }
  }
  if (sc.time_left_s !== undefined) {
    if (!isNum(sc.time_left_s)) throw new ScenarioError('time_left_s');
    g.duration = sc.time_left_s;
  }
}

export const timeLeft = (g) => Math.max(0, g.duration - g.steps / 60);

function emit(g, name, data) {
  g.events.push({ type: 'event', tick: g.steps + 1, name, data });
}

// Apply one input frame (sparse) to the persistent input state; returns edge triggers.
export function applyFrame(g, f) {
  const prev = g.input;
  const next = { ...prev };
  if (f) for (const k of Object.keys(next)) if (f[k] !== undefined) next[k] = f[k];
  g.input = next;
  return {
    jump: next.jump && !prev.jump,
    interact: next.interact && !prev.interact,
    pulse: next.pulse && !prev.pulse,
  };
}

// One fixed 1/60 s step. `frame` = the sparse input frame for this tick (or null).
export function step(g, frame) {
  if (g.state !== 'playing') return;
  const edge = applyFrame(g, frame);
  const p = g.player;
  const inp = g.input;

  // --- timers: integer tick counters (no float drift), ticked at step start
  if (p.pulseCd > 0) p.pulseCd -= 1;
  if (p.invuln > 0) p.invuln -= 1;
  for (const s of g.shades) if (s.stun > 0) s.stun -= 1;

  // --- movement (camera-relative), contract formula
  let [mx, mz] = inp.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (inp.cam_yaw_deg * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += wx * T.player_speed * DT;
  p.pos[2] += wz * T.player_speed * DT;
  const pr = Math.hypot(p.pos[0], p.pos[2]);
  if (pr > EXTRA.island_radius) { // fall disabled: island edge is a soft wall
    p.pos[0] *= EXTRA.island_radius / pr;
    p.pos[2] *= EXTRA.island_radius / pr;
  }
  // --- jump
  if (edge.jump && p.pos[1] <= 0) p.vy = EXTRA.jump_speed;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= EXTRA.gravity * DT;
    p.pos[1] += p.vy * DT;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // --- pick up motes
  for (let i = 0; i < g.motes.length && p.carried < T.carry_capacity; ) {
    if (within(dxz(g.motes[i].pos, p.pos), T.pickup_radius)) {
      g.motes.splice(i, 1);
      p.carried += 1;
      g.score += T.score.per_mote;
      emit(g, 'mote_picked', { carried: p.carried });
    } else i++;
  }

  // --- interact: deposit into nearest unlit lantern in range
  if (edge.interact && p.carried > 0) {
    let best = null, bd = Infinity;
    for (const L of g.lanterns) {
      if (L.lit) continue;
      const d = dxz(L.pos, p.pos);
      if (within(d, T.interact_radius) && d < bd) { bd = d; best = L; }
    }
    if (best) {
      const amount = Math.min(p.carried, Math.max(0, T.lantern_cost - best.deposited));
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        emit(g, 'deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        g.score += T.score.per_lantern;
        emit(g, 'lantern_lit', { lantern_id: best.id });
      }
    }
  }

  // --- pulse
  if (edge.pulse && p.pulseCd <= 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = secToTicks(T.pulse_cooldown_s);
    const ids = [];
    for (const s of g.shades) {
      const d = dxz(s.pos, p.pos);
      if (within(d, T.pulse_radius)) {
        s.stun = secToTicks(T.pulse_stun_s);
        let ux = s.pos[0] - p.pos[0], uz = s.pos[2] - p.pos[2];
        if (d < 1e-9) { ux = 1; uz = 0; } else { ux /= d; uz /= d; }
        s.pos[0] += ux * T.pulse_push_m;
        s.pos[2] += uz * T.pulse_push_m;
        ids.push(s.id);
        g.score += T.score.per_stun;
      }
    }
    emit(g, 'pulse', { stunned_ids: ids });
  }


  // --- shades
  for (const s of g.shades) {
    if (s.stun <= 0) {
      const d = dxz(s.pos, p.pos);
      if (d > 1e-9) {
        const st = Math.min(T.shade_speed * DT, d);
        s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * st;
        s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * st;
      }
    }
    for (const L of g.lanterns) { // lit lanterns repel: shades can't be inside safe_radius
      if (!L.lit) continue;
      const d = dxz(s.pos, L.pos);
      if (d < T.safe_radius) {
        let ux = s.pos[0] - L.pos[0], uz = s.pos[2] - L.pos[2];
        if (d < 1e-9) { ux = 1; uz = 0; } else { ux /= d; uz /= d; }
        s.pos[0] = L.pos[0] + ux * T.safe_radius;
        s.pos[2] = L.pos[2] + uz * T.safe_radius;
      }
    }
  }

  // --- hits
  if (p.invuln <= 0) {
    for (const s of g.shades) {
      if (s.stun > 0) continue;
      if (within(dxz(s.pos, p.pos), T.shade_hit_radius)) {
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        p.flames -= 1;
        p.invuln = secToTicks(T.invuln_s);
        emit(g, 'player_hit', { by: 'shade', flames: p.flames, dropped });
        break;
      }
    }
  }

  // --- spawning
  if (g.randomMotes) {
    g.moteTimer += DT;
    if (g.moteTimer >= EXTRA.mote_respawn_s - 1e-9) {
      g.moteTimer = 0;
      if (g.motes.length < EXTRA.random_motes_count) addMote(g, randomIslandPoint(g.rng, 4, EXTRA.island_radius - 2));
    }
  }
  if (g.randomShades) {
    g.shadeTimer += DT;
    if (g.shadeTimer >= EXTRA.shade_spawn_every_s - 1e-9) {
      g.shadeTimer = 0;
      if (g.shades.length < EXTRA.max_shades) {
        const s = addShade(g, shadeSpawnPoint(g));
        emit(g, 'shade_spawned', { id: s.id });
      }
    }
  }

  // --- end conditions (evaluated on state k+1)
  let reason = null;
  if (g.lanterns.every((L) => L.lit)) { g.state = 'won'; reason = 'all_lit'; }
  else if (p.flames <= 0) { g.state = 'lost'; reason = 'no_flames'; }
  else if (g.duration - (g.steps + 1) / 60 <= 1e-9) { g.state = 'lost'; reason = 'dawn'; }
  if (reason) {
    if (g.state === 'won') {
      const left = Math.max(0, g.duration - (g.steps + 1) / 60);
      g.score += T.score.per_second_left * Math.floor(left + 1e-9) + T.score.per_flame_left * p.flames;
    }
    emit(g, 'game_over', { result: g.state, reason });
  }
  g.steps += 1;
}

export function snapshot(g) {
  return {
    type: 'snapshot',
    tick: g.steps,
    sim_tick: g.steps,
    state: g.state,
    time_left_s: r3(timeLeft(g)),
    score: g.score,
    player: { pos: g.player.pos.map(r3), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((L) => ({ id: L.id, pos: L.pos.map(r3), lit: L.lit, deposited: L.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.stun > 0 ? 'stunned' : 'chase' })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
  };
}

export function drainEvents(g) {
  const e = g.events;
  g.events = [];
  return e;
}
