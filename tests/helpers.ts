import type { Pt } from '../src/core/vec';
import { Rng } from '../src/core/rng';
import { createCombat } from '../src/combat/combat';
import { newBuild, refreshEffects } from '../src/combat/effects';
import type { Build, Combat } from '../src/combat/state';
import { pickBoon, pickHammer } from '../src/run/run';

/** Synthetic strokes, like a hand on a touchscreen: dense points, optional jitter. */
export function noisy(pts: Pt[], amount: number, seed = 1): Pt[] {
  const r = new Rng(seed);
  return pts.map((p) => ({ x: p.x + (r.next() - 0.5) * amount, y: p.y + (r.next() - 0.5) * amount }));
}

export function line(a: Pt, b: Pt, n = 30): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));
}

export function polyline(corners: Pt[], perSeg = 15): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < corners.length; i++) out.push(...line(corners[i - 1]!, corners[i]!, perSeg).slice(i > 1 ? 1 : 0));
  return out;
}

/** Circle; `sweep` in turns (1 = full circle). */
export function circle(c: Pt, r: number, sweep = 1.05, n = 48, start = 0): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = start + (i / n) * sweep * Math.PI * 2;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });
}

export function spiral(c: Pt, r0: number, r1: number, turns: number, n = 120): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });
}

/** Open arc from angle a0 to a1 (radians). */
export function arc(c: Pt, r: number, a0: number, a1: number, n = 40): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });
}

export interface Setup {
  boons?: string[];
  hammers?: string[];
  enemies: { type: string; x: number; y: number }[];
  hp?: number;
}

/** A deterministic combat with exact enemy positions. */
export function fight(s: Setup, seed = 7): Combat {
  const build: Build = newBuild();
  for (const b of s.boons ?? []) pickBoon(build, b);
  for (const h of s.hammers ?? []) pickHammer(build, h);
  const c = createCombat({ rng: new Rng(seed), build, hp: s.hp ?? 60, maxHp: 60, enemies: s.enemies, jitter: false });
  refreshEffects(c);
  return c;
}

export const P = { x: 165, y: 290 };
