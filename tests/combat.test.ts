import { describe, expect, it } from 'vitest';
import { castRite, castStroke, inkCost, stabDamage } from '../src/combat/cast';
import { runEnemyPhase } from '../src/combat/enemyTurn';
import { interpret } from '../src/combat/interpret';
import { living } from '../src/combat/damage';
import { activeShapeBonuses } from '../src/combat/effects';
import type { Combat, Enemy } from '../src/combat/state';
import { circle, fight, line, P, polyline } from './helpers';

const hpLost = (e: Enemy) => e.maxHp - e.hp;
const en = (c: Combat, i: number) => c.enemies[i]!;
/** Pin an enemy to a pattern step so tests don't depend on the random start. */
const setIntent = (e: Enemy, i: number) => (e.pi = i);
const two = [{ type: 'inkling', x: 600, y: 200 }, { type: 'inkling', x: 600, y: 380 }];

describe('ink and basic glyphs (v0 parity)', () => {
  it('a line deals 6 to every enemy it passes through and nothing to others', () => {
    const c = fight({ enemies: [...two, { type: 'inkling', x: 850, y: 100 }] });
    expect(castStroke(c, line({ x: 600, y: 120 }, { x: 600, y: 470 })).ok).toBe(true);
    expect(hpLost(en(c, 0))).toBe(6);
    expect(hpLost(en(c, 1))).toBe(6);
    expect(hpLost(en(c, 2))).toBe(0);
    expect(c.ink).toBe(2);
  });

  it('repeating a glyph in a turn costs +1, and you cannot overspend', () => {
    const c = fight({ enemies: two });
    expect(inkCost(c, 'strike')).toBe(1);
    castStroke(c, line({ x: 450, y: 200 }, { x: 750, y: 200 }));
    expect(inkCost(c, 'strike')).toBe(2);
    castStroke(c, line({ x: 450, y: 380 }, { x: 750, y: 380 }));
    expect(c.ink).toBe(0);
    const r = castStroke(c, line({ x: 450, y: 300 }, { x: 750, y: 300 }));
    expect(r.ok).toBe(false);
  });

  it('a circle around yourself gives 6 Block, which soaks enemy attacks', () => {
    const c = fight({ enemies: [{ type: 'inkling', x: 600, y: 290 }] });
    setIntent(en(c, 0), 0); // atk 6
    castStroke(c, circle(P, 60));
    expect(c.player.block).toBe(6);
    runEnemyPhase(c);
    expect(c.player.hp).toBe(60);
    expect(c.player.block).toBe(0); // resets on your turn
  });

  it('a Sigil needs a Sigil boon', () => {
    const c = fight({ enemies: two });
    expect(castStroke(c, circle({ x: 600, y: 200 }, 60)).ok).toBe(false);
    const d = fight({ boons: ['brand'], enemies: two });
    expect(castStroke(d, circle({ x: 600, y: 200 }, 60)).ok).toBe(true);
    expect(hpLost(en(d, 0))).toBe(3);
    expect(en(d, 0).burn).toBe(3);
  });

  it('Rite: Inkstorm hits everything for 7 and goes on cooldown', () => {
    const c = fight({ enemies: two });
    expect(castRite(c)).toBe(false); // starts on cooldown 1
    runEnemyPhase(c);
    expect(castRite(c)).toBe(true);
    expect(hpLost(en(c, 0))).toBeGreaterThanOrEqual(7);
    expect(c.cd.rite).toBe(3);
  });

  it('winning: killing every enemy ends the fight', () => {
    const c = fight({ enemies: [{ type: 'mite', x: 600, y: 290 }] }); // 7 HP
    castStroke(c, line({ x: 500, y: 290 }, { x: 700, y: 290 }));
    expect(c.phase).toBe('player');
    castStroke(c, line({ x: 600, y: 200 }, { x: 600, y: 380 }));
    expect(c.phase).toBe('won');
  });
});

describe('spatial combos', () => {
  it('crossing two Strikes bursts for 3 around the crossing', () => {
    const c = fight({ enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    castStroke(c, line({ x: 450, y: 200 }, { x: 750, y: 380 }));
    castStroke(c, line({ x: 450, y: 380 }, { x: 750, y: 200 }));
    expect(hpLost(en(c, 0))).toBe(6 + 6 + 3);
  });

  it('a Strike starting inside your Ward gets +2', () => {
    const c = fight({ enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    castStroke(c, circle(P, 60));
    castStroke(c, line(P, { x: 700, y: 290 }));
    expect(hpLost(en(c, 0))).toBe(8);
  });

  it('a Strike through your Sigil carries its element', () => {
    const c = fight({ boons: ['frostring'], enemies: [{ type: 'bulwark', x: 600, y: 200 }, { type: 'bulwark', x: 600, y: 400 }] });
    castStroke(c, circle({ x: 600, y: 200 }, 60));
    // Through the sigil (around enemy 0) and on into enemy 1.
    castStroke(c, line({ x: 600, y: 230 }, { x: 600, y: 470 }));
    expect(en(c, 1).chill).toBe(2);
  });
});

describe('statuses', () => {
  it('Burn deals its stacks at the start of the enemy turn, then drops by 1', () => {
    const c = fight({ boons: ['searing'], enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    castStroke(c, line({ x: 500, y: 290 }, { x: 700, y: 290 }));
    expect(en(c, 0).burn).toBe(2);
    runEnemyPhase(c);
    expect(hpLost(en(c, 0))).toBe(8);
    expect(en(c, 0).burn).toBe(1);
  });

  it('Chill reduces enemy damage per stack and fades by 1 (unless Deep Cold)', () => {
    const c = fight({ boons: ['rime'], enemies: [{ type: 'inkling', x: 600, y: 290 }] });
    setIntent(en(c, 0), 0); // atk 6
    castStroke(c, line({ x: 500, y: 290 }, { x: 700, y: 290 }));
    runEnemyPhase(c);
    expect(c.player.hp).toBe(60 - 4);
    expect(en(c, 0).chill).toBe(1);
    const d = fight({ boons: ['rime', 'deepcold'], enemies: [{ type: 'inkling', x: 600, y: 290 }] });
    castStroke(d, line({ x: 500, y: 290 }, { x: 700, y: 290 }));
    runEnemyPhase(d);
    expect(en(d, 0).chill).toBe(2);
  });

  it('Shock adds +3 to the next hit and is consumed', () => {
    const c = fight({ enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    en(c, 0).shock = 1;
    castStroke(c, line({ x: 500, y: 290 }, { x: 700, y: 290 }));
    expect(hpLost(en(c, 0))).toBe(9);
    expect(en(c, 0).shock).toBe(0);
  });
});

describe('duo boons', () => {
  it('Steam: Burn meeting Chill explodes', () => {
    const d = fight({ boons: ['searing', 'steam', 'frostring'], enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    en(d, 0).chill = 2;
    castStroke(d, line({ x: 500, y: 290 }, { x: 700, y: 290 }));
    expect(hpLost(en(d, 0))).toBe(6 + 8);
    expect(en(d, 0).chill).toBe(0);
    expect(en(d, 0).burn).toBe(0);
  });

  it('Shatter: Strikes double against 2+ Chill', () => {
    const c = fight({ boons: ['shatter'], enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    en(c, 0).chill = 2;
    castStroke(c, line({ x: 500, y: 290 }, { x: 700, y: 290 }));
    expect(hpLost(en(c, 0))).toBe(12);
  });

  it('Wildfire: Shock on a Burning enemy spreads its Burn', () => {
    const c = fight({ boons: ['wildfire'], enemies: [{ type: 'bulwark', x: 600, y: 290 }, { type: 'bulwark', x: 700, y: 290 }] });
    en(c, 0).burn = 4;
    en(c, 0).shock = 1;
    castStroke(c, line({ x: 600, y: 150 }, { x: 600, y: 450 }));
    expect(en(c, 1).burn).toBe(4);
  });
});

describe('patron boons are shape-agnostic', () => {
  it.each(['h_zigzag', 'h_curve', 'h_stab'])('Searing Stroke burns with %s', (h) => {
    const c = fight({ boons: ['searing'], hammers: [h], enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    const stroke =
      h === 'h_zigzag'
        ? polyline([{ x: 520, y: 220 }, { x: 600, y: 330 }, { x: 680, y: 220 }, { x: 760, y: 330 }])
        : h === 'h_stab'
          ? line({ x: 520, y: 290 }, { x: 600, y: 290 })
          : line({ x: 500, y: 290 }, { x: 700, y: 290 });
    expect(castStroke(c, stroke).ok).toBe(true);
    expect(en(c, 0).burn).toBe(2);
  });

  it('Arc Stroke: +1 per distinct enemy hit this turn, counting this one', () => {
    const c = fight({ boons: ['arc'], enemies: [{ type: 'bulwark', x: 600, y: 200 }, { type: 'bulwark', x: 600, y: 380 }] });
    castStroke(c, line({ x: 600, y: 120 }, { x: 600, y: 470 }));
    expect(hpLost(en(c, 0))).toBe(7);
    expect(hpLost(en(c, 1))).toBe(8);
    expect(en(c, 1).shock).toBe(1);
  });
});

describe('Strike shape Hammers', () => {
  const spread = [{ type: 'bulwark', x: 480, y: 120 }, { type: 'bulwark', x: 700, y: 450 }, { type: 'bulwark', x: 880, y: 130 }];

  it('Zigzag replaces the Line: a straight line no longer casts Strike', () => {
    const c = fight({ hammers: ['h_zigzag'], enemies: two });
    const r = castStroke(c, line({ x: 450, y: 200 }, { x: 750, y: 200 }));
    expect(r.ok).toBe(false);
  });

  it('Zigzag: each corner jumps to the nearest untouched enemy near that corner', () => {
    const c = fight({ hammers: ['h_zigzag'], enemies: spread });
    const z = polyline([{ x: 400, y: 330 }, { x: 490, y: 190 }, { x: 690, y: 390 }, { x: 850, y: 200 }, { x: 900, y: 320 }]);
    expect(interpret(c, z)).toMatchObject({ ok: true, glyph: 'strike', form: 'zigzag' });
    castStroke(c, z);
    for (const e of c.enemies) expect(hpLost(e)).toBeGreaterThanOrEqual(4);
  });

  it('Zigzag wants spread: vs a bunch, a Line deals more total', () => {
    const bunch = [{ type: 'bulwark', x: 600, y: 210 }, { type: 'bulwark', x: 600, y: 290 }, { type: 'bulwark', x: 600, y: 370 }];
    const l = fight({ enemies: bunch });
    castStroke(l, line({ x: 600, y: 140 }, { x: 600, y: 440 }));
    const z = fight({ hammers: ['h_zigzag'], enemies: bunch });
    castStroke(z, polyline([{ x: 560, y: 140 }, { x: 640, y: 240 }, { x: 560, y: 340 }, { x: 640, y: 440 }]));
    const total = (c: Combat) => c.enemies.reduce((s, e) => s + hpLost(e), 0);
    expect(total(l)).toBeGreaterThan(total(z));
  });

  it('Storm + Zigzag bonus adds a jump', () => {
    const c = fight({ boons: ['arc'], hammers: ['h_zigzag'], enemies: [] });
    expect(activeShapeBonuses(c.build).map((b) => b.id)).toEqual(['sb_storm_zigzag']);
  });

  it('Stab hits only the first enemy, and shorter is stronger', () => {
    expect(stabDamage(60)).toBe(14);
    expect(stabDamage(400)).toBe(6);
    expect(stabDamage(165)).toBeGreaterThan(6);
    const c = fight({ hammers: ['h_stab'], enemies: [{ type: 'bulwark', x: 600, y: 290 }, { type: 'bulwark', x: 750, y: 290 }] });
    castStroke(c, line({ x: 540, y: 290 }, { x: 800, y: 290 }));
    expect(hpLost(en(c, 0))).toBeGreaterThan(0);
    expect(hpLost(en(c, 1))).toBe(0);
  });

  it('Storm + Stab consumes all Shock for +6 each', () => {
    const c = fight({ boons: ['arc'], hammers: ['h_stab'], enemies: [{ type: 'hulk', x: 600, y: 290 }] });
    en(c, 0).shock = 2;
    castStroke(c, line({ x: 530, y: 290 }, { x: 590, y: 290 }));
    // 14 stab + 1 arc + 12 shock
    expect(hpLost(en(c, 0))).toBe(14 + 1 + 12);
    expect(en(c, 0).shock).toBe(1); // arc re-applies 1
  });

  it('Curve: any open stroke; leaves a trail that hurts enemies moving through it', () => {
    const c = fight({ hammers: ['h_curve'], enemies: [{ type: 'charger', x: 800, y: 290 }] });
    // Trail across the charger's path (it advances 160px), not touching it.
    castStroke(c, line({ x: 720, y: 180 }, { x: 720, y: 400 }));
    expect(c.trails).toHaveLength(1);
    expect(hpLost(en(c, 0))).toBe(0);
    runEnemyPhase(c); // charger advances through the trail
    expect(hpLost(en(c, 0))).toBe(5);
    runEnemyPhase(c);
    expect(c.trails).toHaveLength(0); // 2 turns
  });

  it('Curve: enemies standing in the trail take 2 at the end of their action', () => {
    const c = fight({ hammers: ['h_curve'], enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    castStroke(c, line({ x: 500, y: 290 }, { x: 700, y: 290 }));
    expect(hpLost(en(c, 0))).toBe(3);
    runEnemyPhase(c);
    expect(hpLost(en(c, 0))).toBe(5);
  });

  it('Ember + Curve: trail lasts longer and burns', () => {
    const c = fight({ boons: ['searing'], hammers: ['h_curve'], enemies: [{ type: 'charger', x: 800, y: 290 }] });
    castStroke(c, line({ x: 720, y: 180 }, { x: 720, y: 400 }));
    expect(c.trails[0]!.turns).toBe(3);
    runEnemyPhase(c);
    expect(en(c, 0).burn).toBe(2);
  });

  it('Strikes cross live trails for a burst', () => {
    const c = fight({ hammers: ['h_curve'], enemies: [{ type: 'hulk', x: 600, y: 290 }] });
    castStroke(c, line({ x: 450, y: 200 }, { x: 750, y: 380 }));
    const before = hpLost(en(c, 0));
    castStroke(c, line({ x: 450, y: 380 }, { x: 750, y: 200 }));
    expect(hpLost(en(c, 0)) - before).toBe(3 + 3);
  });
});

describe('Ward shape Hammer: Wall', () => {
  const pair = [{ type: 'bulwark', x: 600, y: 200 }, { type: 'inkling', x: 600, y: 400 }];

  it('replaces the Ward circle', () => {
    const c = fight({ hammers: ['h_wall'], enemies: pair });
    expect(castStroke(c, circle(P, 60)).ok).toBe(false);
  });

  it('a stroke across one attacker’s path fully blocks that attacker only', () => {
    const c = fight({ hammers: ['h_wall'], enemies: pair });
    setIntent(en(c, 0), 1); // bulwark atk 12
    setIntent(en(c, 1), 0); // inkling atk 6
    // Short wall across the bulwark's path only.
    const wall = line({ x: 350, y: 215 }, { x: 370, y: 275 });
    expect(interpret(c, wall)).toMatchObject({ ok: true, glyph: 'ward', form: 'wall' });
    castStroke(c, wall);
    expect(c.strokes[0]!.bound).toEqual([en(c, 0).id]);
    runEnemyPhase(c);
    expect(c.player.hp).toBe(60 - 6);
  });

  it('picks the hardest hitter when it crosses several paths', () => {
    const c = fight({ hammers: ['h_wall'], enemies: pair });
    setIntent(en(c, 0), 0); // atkblock 6
    setIntent(en(c, 1), 1); // atk 7
    castStroke(c, line({ x: 300, y: 180 }, { x: 300, y: 400 }));
    expect(c.strokes[0]!.bound).toEqual([en(c, 1).id]);
  });

  it('Frost + Wall chills the blocked attacker; Long Reach blocks a second one', () => {
    const c = fight({ boons: ['glacial'], hammers: ['h_wall', 'h_reach'], enemies: pair });
    setIntent(en(c, 0), 1);
    setIntent(en(c, 1), 0);
    castStroke(c, line({ x: 300, y: 180 }, { x: 300, y: 400 }));
    expect(c.strokes[0]!.bound).toHaveLength(2);
    runEnemyPhase(c);
    expect(c.player.hp).toBe(60);
    expect(en(c, 0).chill + en(c, 1).chill).toBeGreaterThan(0);
  });

  it('with Curve + Wall, a trail drawn in the enemy area stays a Curve; one on your side is a Wall', () => {
    const c = fight({ hammers: ['h_wall', 'h_curve'], enemies: pair });
    expect(interpret(c, line({ x: 480, y: 120 }, { x: 480, y: 470 }))).toMatchObject({ glyph: 'strike', form: 'curve' });
    expect(interpret(c, line({ x: 300, y: 180 }, { x: 300, y: 400 }))).toMatchObject({ glyph: 'ward', form: 'wall' });
  });

  it('a stroke that touches an enemy is still a Strike', () => {
    const c = fight({ hammers: ['h_wall'], enemies: pair });
    expect(interpret(c, line({ x: 450, y: 200 }, { x: 750, y: 200 }))).toMatchObject({ glyph: 'strike' });
  });
});

describe('tweak Hammers', () => {
  it('Heavy Nib: +3 per hit, second Strike costs +2', () => {
    const c = fight({ hammers: ['h_heavy'], enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    castStroke(c, line({ x: 500, y: 290 }, { x: 700, y: 290 }));
    expect(hpLost(en(c, 0))).toBe(9);
    expect(inkCost(c, 'strike')).toBe(3);
  });

  it('Echo: first Strike each turn re-hits at half', () => {
    const c = fight({ hammers: ['h_echo'], enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    castStroke(c, line({ x: 500, y: 290 }, { x: 700, y: 290 }));
    expect(hpLost(en(c, 0))).toBe(6 + 3);
    castStroke(c, line({ x: 500, y: 300 }, { x: 700, y: 300 }));
    expect(hpLost(en(c, 0))).toBe(9 + 6);
  });

  it('Wide Nib: hits from further away', () => {
    const near = line({ x: 500, y: 345 }, { x: 700, y: 345 }); // 55px from center, bulwark r=38
    expect(castStroke(fight({ enemies: [{ type: 'bulwark', x: 600, y: 290 }] }), near).ok).toBe(true);
    const a = fight({ enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    castStroke(a, near);
    const b = fight({ hammers: ['h_wide'], enemies: [{ type: 'bulwark', x: 600, y: 290 }] });
    castStroke(b, near);
    expect(hpLost(en(a, 0))).toBe(0);
    expect(hpLost(en(b, 0))).toBe(6);
  });

  it('Wet Ink: unhit Block half carries over', () => {
    const c = fight({ hammers: ['h_wetink'], enemies: [{ type: 'warden', x: 800, y: 290 }] });
    setIntent(en(c, 0), 0); // shield, no attack
    castStroke(c, circle(P, 60));
    runEnemyPhase(c);
    expect(c.player.block).toBe(3);
  });
});

describe('enemies that push back', () => {
  it('Shieldbearer deflects Strikes from the front but not from above', () => {
    const c = fight({ enemies: [{ type: 'shieldbearer', x: 600, y: 290 }] });
    castStroke(c, line({ x: 450, y: 290 }, { x: 750, y: 290 }));
    expect(hpLost(en(c, 0))).toBe(0);
    const d = fight({ enemies: [{ type: 'shieldbearer', x: 600, y: 290 }] });
    castStroke(d, line({ x: 600, y: 120 }, { x: 600, y: 460 }));
    expect(hpLost(en(d, 0))).toBe(6);
  });

  it('Charger advances toward you; Flanker moves beside you', () => {
    const c = fight({ enemies: [{ type: 'charger', x: 850, y: 290 }, { type: 'flanker', x: 800, y: 150 }] });
    const x0 = en(c, 0).x;
    runEnemyPhase(c);
    expect(en(c, 0).x).toBeLessThan(x0 - 100);
    expect(en(c, 1).x).toBeLessThan(450);
  });

  it('Skitters scatter away from allies', () => {
    const c = fight({ enemies: [{ type: 'skitter', x: 600, y: 290 }, { type: 'skitter', x: 660, y: 290 }] });
    setIntent(en(c, 0), 1);
    setIntent(en(c, 1), 1);
    runEnemyPhase(c);
    const [a, b] = living(c);
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThan(150);
  });

  it('The Blot summons Inklings', () => {
    const c = fight({ enemies: [{ type: 'blot', x: 690, y: 290 }] });
    setIntent(en(c, 0), 1);
    runEnemyPhase(c);
    expect(living(c)).toHaveLength(3);
  });
});
