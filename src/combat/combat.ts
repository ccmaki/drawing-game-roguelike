import type { Rng } from '../core/rng';
import { FIELD } from '../content/tuning';
import type { EncounterDef } from '../content/types';
import { activeEffects } from './effects';
import { makeApi } from './damage';
import { startPlayerTurn } from './cast';
import { addEnemy } from './enemyTurn';
import type { Build, Combat } from './state';

export interface CombatInit {
  rng: Rng;
  build: Build;
  hp: number;
  maxHp: number;
  enemies: EncounterDef['enemies'];
  /** Random spawn jitter (off in tests that need exact positions). */
  jitter?: boolean;
}

export function createCombat(init: CombatInit): Combat {
  const P = FIELD.player;
  const c = {
    rng: init.rng,
    build: init.build,
    effects: activeEffects(init.build),
    player: { x: P.x, y: P.y, r: P.r, hp: init.hp, maxHp: init.maxHp, block: 0 },
    enemies: [],
    nextId: 1,
    ink: 0,
    strokes: [],
    trails: [],
    used: {},
    cd: { rite: 1, spiral: 0 },
    turn: 1,
    phase: 'player',
    hitThisTurn: new Set(),
    strikesThisTurn: 0,
    blockWasHit: false,
    trailHitThisPhase: new Set(),
    events: [],
  } as unknown as Combat;
  c.api = makeApi(c);
  const j = init.jitter === false ? 0 : FIELD.spawnJitter;
  for (const s of init.enemies) {
    const boss = s.type === 'blot';
    const jx = boss ? 0 : (init.rng.next() - 0.5) * 2 * j;
    const jy = boss ? 0 : (init.rng.next() - 0.5) * 2 * j;
    addEnemy(c, s.type, s.x + jx, s.y + jy);
  }
  startPlayerTurn(c, true);
  return c;
}
