/**
 * Every balance number in one place. Values marked (v0) are ported from the
 * prototype; the rest are provisional (see DESIGN.md decision log).
 */

export const FIELD = {
  w: 960,
  h: 540,
  player: { x: 165, y: 290, r: 26 },
  /** Where enemies normally stand. */
  enemyArea: { x0: 400, x1: 910, y0: 75, y1: 475 },
  /** Where Quillshots retreat to. */
  backArea: { x0: 700, x1: 900, y0: 110, y1: 460 },
  /** Spots Flankers move to: above and below the player. */
  flankSpots: [
    { x: 300, y: 110 },
    { x: 300, y: 470 },
    { x: 410, y: 95 },
    { x: 410, y: 485 },
  ],
  /** Closest an advancing enemy gets to the player. */
  meleeDist: 150,
  /** Walls must be drawn entirely left of this line (your side), so Curve trails in the enemy area stay Strikes. */
  wallZoneX: 400,
  spawnJitter: 22,
};

export const T = {
  startHp: 60, // (v0)
  baseInk: 3, // (v0)
  cost: { strike: 1, ward: 1, sigil: 2, spiral: 1 }, // (v0)
  /** Extra ink per earlier use of the same glyph this turn. (v0) */
  repeatSurcharge: 1,
  hitPad: 10, // (v0)
  shockBonus: 3, // (v0)

  rite: { cost: 2, cooldown: 3, damage: 7 }, // (v0) Inkstorm
  spiral: { cooldown: 3, damage: 2, pull: 0.3 }, // (v0)

  /** Spatial combo: Strike starting inside your Ward circle / at your Wall. */
  wardStartBonus: 2, // (v0)
  wallStartDist: 30,
  /** Spatial combo: two Strike strokes (or a Strike and a trail) crossing. */
  cross: { damage: 3, radius: 75, maxPerStroke: 3, minSep: 30 }, // (v0)

  line: { damage: 6 }, // (v0)
  zigzag: { body: 4, jump: 6, jumpRange: 150, maxJumps: 3 },
  curve: { damage: 3, trailTurns: 2, trailMove: 5, trailStay: 2 },
  stab: { max: 14, min: 6, shortLen: 80, longLen: 250 },
  ward: { circle: 6 }, // (v0)

  rest: { healFrac: 0.3 },
};
