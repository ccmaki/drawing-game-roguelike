import { Rng } from '../core/rng';
import { BOON, BOONS, DUOS, ENCOUNTERS, HAMMER, HAMMERS, T } from '../content';
import type { BoonDef, DuoDef, EncounterDef, EncounterKind, HammerDef } from '../content/types';
import { createCombat } from '../combat/combat';
import { newBuild, strikeForm, wardForm } from '../combat/effects';
import type { Build, Combat } from '../combat/state';
import { generateMap, type GameMap, type MapNode } from './map';

export interface Run {
  seed: number;
  rng: Rng;
  hp: number;
  maxHp: number;
  build: Build;
  map: GameMap;
  /** Current node id; null before the first room. */
  at: string | null;
  visited: string[];
  usedEncounters: string[];
  combat: Combat | null;
  encounter: EncounterDef | null;
}

export function newRun(seed: number): Run {
  const rng = new Rng(seed);
  return {
    seed, rng, hp: T.startHp, maxHp: T.startHp, build: newBuild(), map: generateMap(rng),
    at: null, visited: [], usedEncounters: [], combat: null, encounter: null,
  };
}

export function currentNode(run: Run): MapNode | null {
  return run.at ? (run.map.nodes[run.at] ?? null) : null;
}

export function nextChoices(run: Run): MapNode[] {
  const cur = currentNode(run);
  return cur ? cur.next.map((id) => run.map.nodes[id]!) : run.map.rows[0]!;
}

export function pickEncounter(run: Run, kind: EncounterKind, row: number): EncounterDef {
  const fits = ENCOUNTERS.filter((e) => e.kind === kind && row >= e.rows[0] && row <= e.rows[1]);
  const fresh = fits.filter((e) => !run.usedEncounters.includes(e.id));
  const pool = fresh.length ? fresh : fits.length ? fits : ENCOUNTERS.filter((e) => e.kind === kind);
  return run.rng.pick(pool);
}

/** Start a fight with a specific encounter (also used by the debug panel). */
export function startEncounter(run: Run, enc: EncounterDef): Combat {
  run.usedEncounters.push(enc.id);
  run.encounter = enc;
  run.combat = createCombat({ rng: run.rng, build: run.build, hp: run.hp, maxHp: run.maxHp, enemies: enc.enemies });
  return run.combat;
}

export function enterNode(run: Run, id: string): MapNode {
  const n = run.map.nodes[id];
  if (!n) throw new Error(`no node ${id}`);
  run.at = id;
  run.visited.push(id);
  if (n.type === 'fight' || n.type === 'elite' || n.type === 'boss') startEncounter(run, pickEncounter(run, n.type, n.row));
  return n;
}

/** Copy HP back from the fight. */
export function endCombat(run: Run): void {
  if (run.combat) run.hp = run.combat.player.hp;
  run.combat = null;
}

export function rest(run: Run): number {
  const heal = Math.min(Math.round(run.maxHp * T.rest.healFrac), run.maxHp - run.hp);
  run.hp += heal;
  return heal;
}

// ---------------------------------------------------------------- offers

export type BoonOffer = (BoonDef & { duo?: false }) | (DuoDef & { duo: true });

const patronCount = (b: Build, p: string) => [...b.boons].filter((id) => BOON[id]?.patron === p).length;

/** 1-of-3 boon offer (v0 rules): one card per patron where possible, Scribe sometimes, a duo once eligible. */
export function boonOffers(run: Run): BoonOffer[] {
  const { rng, build } = run;
  const pool = BOONS.filter((b) => !build.boons.has(b.id));
  let pats = ['ember', 'frost', 'storm'];
  if (rng.chance(0.4) && pool.some((b) => b.patron === 'scribe')) pats.push('scribe');
  pats = rng.shuffle(pats);
  const out: BoonOffer[] = [];
  for (const p of pats) {
    if (out.length >= 3) break;
    const c = pool.filter((b) => b.patron === p);
    if (c.length) out.push(rng.pick(c));
  }
  while (out.length < 3) {
    const c = pool.filter((b) => !out.includes(b));
    if (!c.length) break;
    out.push(rng.pick(c));
  }
  const elig = DUOS.filter((d) => !build.boons.has(d.id) && d.patrons.every((p) => patronCount(build, p) > 0));
  if (elig.length && rng.chance(0.65)) out[out.length - 1] = { ...rng.pick(elig), duo: true };
  return out;
}

export function pickBoon(build: Build, id: string): void {
  const b = BOON[id];
  if (b && (b.slot === 'strike' || b.slot === 'ward' || b.slot === 'sigil')) {
    const cur = build.slots[b.slot];
    if (cur) build.boons.delete(cur);
    build.slots[b.slot] = id;
  }
  build.boons.add(id);
}

/** Can this Hammer be offered with the current build? */
export function hammerEligible(build: Build, h: HammerDef): boolean {
  if (build.hammers.has(h.id)) return false;
  if (h.requires) return (h.slot === 'strike' ? strikeForm(build) : wardForm(build)) === h.requires;
  return true;
}

/** Calligrapher offer: up to 2 shape Hammers, the rest tweaks (decision 19). */
export function hammerOffers(run: Run, n = 3): HammerDef[] {
  const elig = HAMMERS.filter((h) => hammerEligible(run.build, h));
  const shapes = run.rng.shuffle(elig.filter((h) => h.kind === 'shape')).slice(0, 2);
  const tweaks = run.rng.shuffle(elig.filter((h) => h.kind === 'tweak'));
  return run.rng.shuffle([...shapes, ...tweaks].slice(0, n));
}

export function pickHammer(build: Build, id: string): void {
  const h = HAMMER[id];
  if (!h) return;
  if (h.kind === 'shape') {
    const cur = build.shape[h.slot];
    if (cur) build.hammers.delete(cur);
    build.shape[h.slot] = id;
    // Tweaks that required the old shape no longer apply.
    for (const t of [...build.hammers]) {
      const td = HAMMER[t];
      if (td?.requires && td.slot === h.slot && td.requires !== h.form) build.hammers.delete(t);
    }
  }
  build.hammers.add(id);
}


