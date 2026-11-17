import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { allPaths, generateMap, MAP_CFG } from '../src/run/map';
import { boonOffers, enterNode, hammerOffers, newRun, nextChoices, pickBoon, pickHammer, rest } from '../src/run/run';
import { newBuild, strikeForm, wardForm } from '../src/combat/effects';
import { ENCOUNTERS, ENEMIES, HAMMERS } from '../src/content';

const seeds = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

describe('map generation', () => {
  it.each(seeds.slice(0, 5))('is deterministic for seed %i', (s) => {
    expect(JSON.stringify(generateMap(new Rng(s)))).toBe(JSON.stringify(generateMap(new Rng(s))));
  });

  it('every path meets a Calligrapher in rooms 2–3, starts with a fight, rests before the boss, ends at the boss', () => {
    for (const s of seeds) {
      const m = generateMap(new Rng(s));
      for (const p of allPaths(m)) {
        expect(p).toHaveLength(MAP_CFG.rows + 1);
        expect(p[0]!.type).toBe('fight');
        expect(p[1]!.type === 'calligrapher' || p[2]!.type === 'calligrapher').toBe(true);
        expect(p[MAP_CFG.rows - 1]!.type).toBe('rest');
        expect(p[MAP_CFG.rows]!.type).toBe('boss');
        for (const n of p.slice(0, MAP_CFG.eliteFromRow)) expect(n.type).not.toBe('elite');
      }
    }
  });

  it('branches: at least 2 starting rooms, never more than 4 per row', () => {
    for (const s of seeds) {
      const m = generateMap(new Rng(s));
      expect(m.rows[0]!.length).toBeGreaterThanOrEqual(2);
      for (const row of m.rows) expect(row.length).toBeLessThanOrEqual(MAP_CFG.cols);
    }
  });

  it('edges never cross', () => {
    for (const s of seeds) {
      const m = generateMap(new Rng(s));
      for (const row of m.rows.slice(0, -2)) {
        const edges = row.flatMap((n) => n.next.map((id) => [n.col, m.nodes[id]!.col] as const));
        for (const [a, b] of edges) for (const [c, d] of edges) expect((a < c && b > d) || (a > c && b < d)).toBe(false);
      }
    }
  });
});

describe('run flow', () => {
  it('entering a fight room starts combat; rest heals 30%', () => {
    const run = newRun(42);
    const first = nextChoices(run)[0]!;
    enterNode(run, first.id);
    expect(run.combat).not.toBeNull();
    run.combat = null;
    run.hp = 10;
    expect(rest(run)).toBe(18);
  });

  it('boon offers are 3 distinct cards, and slot boons replace', () => {
    const run = newRun(3);
    const offers = boonOffers(run);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((o) => o.id)).size).toBe(3);
    const b = newBuild();
    pickBoon(b, 'searing');
    pickBoon(b, 'rime');
    expect(b.slots.strike).toBe('rime');
    expect(b.boons.has('searing')).toBe(false);
  });

  it('one shape Hammer per slot: a new one replaces the old', () => {
    const b = newBuild();
    pickHammer(b, 'h_zigzag');
    pickHammer(b, 'h_stab');
    expect(strikeForm(b)).toBe('stab');
    expect(b.hammers.has('h_zigzag')).toBe(false);
    pickHammer(b, 'h_wall');
    pickHammer(b, 'h_reach');
    expect(wardForm(b)).toBe('wall');
  });

  it('Calligrapher offers 3 Hammers, at most 2 shapes, never an owned one or one missing its requirement', () => {
    for (const s of seeds.slice(0, 50)) {
      const run = newRun(s);
      const o = hammerOffers(run);
      expect(o).toHaveLength(3);
      expect(o.filter((h) => h.kind === 'shape').length).toBeLessThanOrEqual(2);
      expect(o.some((h) => h.id === 'h_reach')).toBe(false); // needs a Wall
    }
  });
});

describe('content integrity', () => {
  it('every encounter uses known enemies, and positions are on the field', () => {
    for (const e of ENCOUNTERS)
      for (const s of e.enemies) {
        expect(ENEMIES[s.type], `${e.id}: ${s.type}`).toBeDefined();
        expect(s.x).toBeGreaterThan(250);
        expect(s.x).toBeLessThan(960);
      }
  });

  it('every map row has a fight and an elite available', () => {
    for (let row = 0; row < MAP_CFG.rows; row++) {
      expect(ENCOUNTERS.some((e) => e.kind === 'fight' && row >= e.rows[0] && row <= e.rows[1])).toBe(true);
      if (row >= MAP_CFG.eliteFromRow) expect(ENCOUNTERS.some((e) => e.kind === 'elite' && row >= e.rows[0] && row <= e.rows[1])).toBe(true);
    }
  });

  it('each Strike shape has a formation that pushes back on it', () => {
    const text = ENCOUNTERS.map((e) => e.pushback).join(' ');
    for (const s of ['Line', 'Stab', 'Wall']) expect(text).toContain(s);
    expect(HAMMERS.filter((h) => h.kind === 'shape').every((h) => h.wants)).toBe(true);
  });
});
