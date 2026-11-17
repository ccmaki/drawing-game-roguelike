import { type Pt, dist } from '../core/vec';
import { polyDist, polySegDist } from '../geometry/stroke';
import { ENEMIES } from '../content/enemies';
import { FIELD, T } from '../content/tuning';
import { PATRONS } from '../content/boons';
import { anyFx, WARD_COLOR } from './effects';
import { applyStatus, damage, emit, hitDmg, hitPlayer, intentOf, living, text } from './damage';
import { checkWin, separate, startPlayerTurn } from './cast';
import type { Combat, Enemy } from './state';

/** Read phase through a function so TS doesn't narrow it across mutations. */
const isOver = (c: Combat): boolean => c.phase === 'won' || c.phase === 'lost';

export function addEnemy(c: Combat, type: string, x: number, y: number): Enemy {
  const d = ENEMIES[type];
  if (!d) throw new Error(`unknown enemy ${type}`);
  const e: Enemy = {
    id: c.nextId++,
    type,
    name: d.name,
    r: d.r,
    color: d.color,
    pattern: d.pattern,
    pi: d.startAt ?? c.rng.int(d.pattern.length),
    hp: d.hp,
    maxHp: d.hp,
    x,
    y,
    block: 0,
    burn: 0,
    chill: 0,
    shock: 0,
    str: 0,
    alive: true,
    boss: !!d.boss,
    frontGuard: !!d.frontGuard,
  };
  c.enemies.push(e);
  return e;
}

function free(c: Combat, p: Pt, r: number, self?: Enemy): boolean {
  return living(c).every((o) => o === self || dist(o, p) > o.r + r + 12);
}

/** A random free spot in an area, or null. */
export function freeSpot(c: Combat, area: { x0: number; x1: number; y0: number; y1: number }, r: number, self?: Enemy): Pt | null {
  for (let i = 0; i < 40; i++) {
    const p = { x: c.rng.range(area.x0, area.x1), y: c.rng.range(area.y0, area.y1) };
    if (free(c, p, r, self)) return p;
  }
  return null;
}

/** Move an enemy; moving through a Curve trail hurts (once per enemy per enemy turn). */
function moveEnemy(c: Combat, e: Enemy, to: Pt): void {
  const from = { x: e.x, y: e.y };
  e.x = to.x;
  e.y = to.y;
  separate(living(c));
  for (const tr of c.trails) {
    if (c.trailHitThisPhase.has(e.id) || !e.alive) break;
    if (polySegDist(tr.pts, from, e) < e.r * 0.6) trailHurt(c, e, tr.burn, T.curve.trailMove, 'trail!');
  }
}

function trailHurt(c: Combat, e: Enemy, burn: number, amount: number, label: string): void {
  c.trailHitThisPhase.add(e.id);
  text(c, e.x, e.y - e.r - 30, label, '#5a3a8a', 14);
  damage(c, e, amount, { color: '#5a3a8a' });
  applyStatus(c, e, 'burn', burn);
}

function towardPlayer(c: Combat, e: Enemy, d: number): Pt {
  const P = c.player;
  const dx = P.x - e.x;
  const dy = P.y - e.y;
  const L = Math.hypot(dx, dy) || 1;
  const step = Math.max(0, Math.min(d, L - FIELD.meleeDist - e.r));
  return { x: e.x + (dx / L) * step, y: e.y + (dy / L) * step };
}

function* attack(c: Combat, e: Enemy, d: number, n: number): Generator<void> {
  for (let i = 0; i < n; i++) {
    emit(c, { t: 'lunge', id: e.id });
    hitPlayer(c, hitDmg(e, d), e);
    yield;
    if (c.phase === 'lost' || !e.alive) return;
  }
}

function* act(c: Combat, e: Enemy): Generator<void> {
  const it = intentOf(e);
  const say = (s: string, color = '#5a5046') => text(c, e.x, e.y - e.r - 30, s, color, 14);
  switch (it.t) {
    case 'atk':
      yield* attack(c, e, it.d, it.n ?? 1);
      break;
    case 'atkblock':
      e.block += it.b;
      yield* attack(c, e, it.d, 1);
      break;
    case 'shield':
      for (const o of living(c)) {
        o.block += it.b;
        emit(c, { t: 'ring', x: o.x, y: o.y, r: o.r + 14, color: WARD_COLOR });
      }
      say('shield allies', WARD_COLOR);
      break;
    case 'blockbuff':
      e.block += it.b;
      e.str += it.s;
      say(`+${it.s} strength`, '#b3261e');
      break;
    case 'shift': {
      const p = freeSpot(c, FIELD.backArea, e.r, e) ?? freeSpot(c, FIELD.enemyArea, e.r, e);
      if (p) moveEnemy(c, e, p);
      say('moves');
      break;
    }
    case 'scatter': {
      // Pick the candidate spot furthest from every ally.
      let best: Pt | null = null;
      let bestD = -1;
      for (let i = 0; i < 24; i++) {
        const p = freeSpot(c, FIELD.enemyArea, e.r, e);
        if (!p) continue;
        const d = Math.min(...living(c).filter((o) => o !== e).map((o) => dist(o, p)), 9999);
        if (d > bestD) [best, bestD] = [p, d];
      }
      if (best) moveEnemy(c, e, best);
      say('scatters');
      break;
    }
    case 'flank': {
      const spots = c.rng.shuffle(FIELD.flankSpots).filter((p) => free(c, p, e.r, e));
      const p = spots[0];
      if (p) moveEnemy(c, e, p);
      say('flanks');
      break;
    }
    case 'advance':
      moveEnemy(c, e, towardPlayer(c, e, it.dist));
      say('advances');
      break;
    case 'charge':
      moveEnemy(c, e, towardPlayer(c, e, it.dist));
      if (!e.alive) break;
      yield;
      yield* attack(c, e, it.d, 1);
      break;
    case 'summon': {
      let n = 0;
      for (let i = 0; i < it.n; i++) {
        if (living(c).length >= it.max) break;
        const r = ENEMIES[it.type]?.r ?? 28;
        const p = freeSpot(c, FIELD.enemyArea, r);
        if (!p) break;
        addEnemy(c, it.type, p.x, p.y);
        n++;
      }
      say(n ? 'summons!' : '…', '#1d1a16');
      break;
    }
  }
}

/**
 * The enemy turn as a generator: each yield is one beat the UI can animate
 * (the v0 prototype used sleeps here). Tests drain it with runEnemyPhase.
 */
export function* enemyPhase(c: Combat): Generator<void> {
  if (c.phase !== 'player') return;
  c.phase = 'enemy';
  c.blockWasHit = false;
  c.trailHitThisPhase = new Set();
  for (const e of living(c)) e.block = 0;
  yield;
  for (const e of [...c.enemies]) {
    if (!e.alive) continue;
    if (e.burn > 0) {
      text(c, e.x, e.y - e.r - 30, 'burn', PATRONS.ember.color, 14);
      damage(c, e, e.burn, { raw: true, color: PATRONS.ember.color });
      e.burn--;
      yield;
      if (!e.alive) continue;
    }
    yield* act(c, e);
    if (isOver(c)) return;
    if (e.alive && !c.trailHitThisPhase.has(e.id)) {
      const tr = c.trails.find((t) => polyDist(e, t.pts) < e.r + 4);
      if (tr) trailHurt(c, e, tr.burn, T.curve.trailStay, 'in the trail');
    }
    if (e.alive) {
      if (!anyFx(c, 'chillNoFade') && e.chill > 0) e.chill--;
      e.pi = (e.pi + 1) % e.pattern.length;
    }
    yield;
  }
  for (const t of c.trails) t.turns--;
  c.trails = c.trails.filter((t) => t.turns > 0);
  checkWin(c);
  if (isOver(c)) return;
  startPlayerTurn(c, false);
}

/** Run a whole enemy turn synchronously. */
export function runEnemyPhase(c: Combat): void {
  const g = enemyPhase(c);
  while (!g.next().done);
}
