import { T } from '../content/tuning';
import { PATRONS } from '../content/boons';
import { sumFx, WARD_COLOR } from './effects';
import type { GameEvent } from './events';
import type { Api, Combat, DamageOpts, Enemy, Intent, Status } from './state';

export const living = (c: Combat): Enemy[] => c.enemies.filter((e) => e.alive);

export function emit(c: Combat, ev: GameEvent): void {
  c.events.push(ev);
}

export function text(c: Combat, x: number, y: number, s: string, color = '#1d1a16', size = 18): void {
  emit(c, { t: 'text', x, y, text: s, color, size });
}

export function makeApi(c: Combat): Api {
  return {
    c,
    damage: (e, a, o) => damage(c, e, a, o),
    status: (e, s, n) => applyStatus(c, e, s, n),
    living: () => living(c),
    emit: (ev) => emit(c, ev),
  };
}

/** Deal damage to an enemy: Shock bonus, then enemy Block, then HP. Returns HP lost. */
export function damage(c: Combat, e: Enemy, amt: number, opt: DamageOpts = {}): number {
  if (!e.alive) return 0;
  let a = amt;
  if (!opt.raw && e.shock > 0) {
    if (opt.shockAll) {
      a += T.shockBonus * 2 * e.shock;
      e.shock = 0;
    } else {
      a += T.shockBonus;
      e.shock--;
    }
    emit(c, { t: 'bolt', a: { x: e.x, y: e.y - 40 }, b: { x: e.x, y: e.y }, color: PATRONS.storm.color });
    for (const fx of c.effects) fx.effect.onShockTrigger?.(c.api, e);
    if (!e.alive) return 0;
  }
  if (!opt.raw && e.block > 0) {
    const b = Math.min(e.block, a);
    e.block -= b;
    a -= b;
    if (b) text(c, e.x + 20, e.y - 10, `-${b}◆`, WARD_COLOR, 15);
  }
  if (a > 0) {
    e.hp -= a;
    emit(c, { t: 'hit', id: e.id, amount: a, color: opt.color ?? '#b3261e' });
  }
  if (e.hp <= 0) {
    e.hp = 0;
    e.alive = false;
    emit(c, { t: 'death', id: e.id });
  }
  return Math.max(0, a);
}

export function applyStatus(c: Combat, e: Enemy, s: Status, n: number): void {
  if (!e.alive || n <= 0) return;
  for (const fx of c.effects) if (fx.effect.interceptStatus?.(c.api, e, s, n)) return;
  e[s] += n;
}

export function intentOf(e: Enemy): Intent {
  return e.pattern[e.pi % e.pattern.length]!;
}

/** Damage per hit of an attack after Strength and Chill. */
export function hitDmg(e: Enemy, d: number): number {
  return Math.max(0, d + e.str - e.chill);
}

/** Total damage an enemy's current intent will deal (for Wall targeting and UI). */
export function intentDamage(e: Enemy): number {
  const it = intentOf(e);
  if (it.t === 'atk') return hitDmg(e, it.d) * (it.n ?? 1);
  if (it.t === 'atkblock' || it.t === 'charge') return hitDmg(e, it.d);
  return 0;
}

function blockAbsorbed(c: Combat, attacker: Enemy, byWall: boolean): void {
  for (const fx of c.effects) fx.effect.onBlockAbsorbed?.(c.api, attacker);
  if (byWall) applyStatus(c, attacker, 'chill', sumFx(c, 'wallBlockedChill'));
}

/** An enemy hits the player: a Wall bound to it stops it, else Block soaks, then HP. */
export function hitPlayer(c: Combat, d: number, attacker: Enemy): void {
  const P = c.player;
  if (d <= 0) return;
  const wall = c.strokes.find((s) => s.form === 'wall' && s.bound?.includes(attacker.id));
  if (wall) {
    text(c, P.x + 40, P.y - 40, 'walled!', WARD_COLOR, 16);
    emit(c, { t: 'ring', x: attacker.x, y: attacker.y, r: attacker.r + 12, color: WARD_COLOR });
    blockAbsorbed(c, attacker, true);
    return;
  }
  let a = d;
  if (P.block > 0) {
    const b = Math.min(P.block, a);
    P.block -= b;
    a -= b;
    if (b > 0) {
      c.blockWasHit = true;
      text(c, P.x + 30, P.y - 40, `-${b}◆`, WARD_COLOR, 16);
      blockAbsorbed(c, attacker, false);
    }
  }
  if (a > 0) {
    P.hp -= a;
    emit(c, { t: 'playerHit', amount: a });
  }
  if (P.hp <= 0) {
    P.hp = 0;
    c.phase = 'lost';
  }
}
