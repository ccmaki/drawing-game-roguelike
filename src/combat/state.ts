import type { Pt } from '../core/vec';
import type { Rng } from '../core/rng';
import type { GameEvent } from './events';

export type Status = 'burn' | 'chill' | 'shock';
export type BoonSlot = 'strike' | 'ward' | 'sigil';
export type StrikeForm = 'line' | 'zigzag' | 'curve' | 'stab';
export type WardForm = 'circle' | 'wall';
/** What a recognised stroke casts. Each glyph has its own repeat counter for ink costs. */
export type Glyph = 'strike' | 'ward' | 'sigil' | 'spiral';

export type Intent =
  | { t: 'atk'; d: number; n?: number }
  | { t: 'atkblock'; d: number; b: number }
  | { t: 'shield'; b: number }
  | { t: 'blockbuff'; b: number; s: number }
  | { t: 'shift' }
  | { t: 'summon'; type: string; n: number; max: number }
  | { t: 'advance'; dist: number }
  | { t: 'charge'; dist: number; d: number }
  | { t: 'scatter' }
  | { t: 'flank' };

export interface Enemy {
  id: number;
  type: string;
  name: string;
  r: number;
  color: string;
  pattern: Intent[];
  pi: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  block: number;
  burn: number;
  chill: number;
  shock: number;
  str: number;
  alive: boolean;
  boss: boolean;
  /** Deflects Strike hits that come from the side facing the player. */
  frontGuard: boolean;
}

export interface Player {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  block: number;
}

/** The player's build. Owned by the run, read by combat. */
export interface Build {
  /** Every boon owned: slot boons, passives, rares and duos. */
  boons: Set<string>;
  /** Patron boon in each slot (one per slot; a new pick replaces). */
  slots: Record<BoonSlot, string | null>;
  /** Every Hammer owned, shape and tweak. */
  hammers: Set<string>;
  /** The shape Hammer in each slot (at most one per slot). */
  shape: { strike: string | null; ward: string | null };
}

export interface StrokeRec {
  glyph: Glyph;
  form: StrikeForm | WardForm | null;
  pts: Pt[];
  /** Wall only: ids of the attackers this wall blocks. */
  bound?: number[];
}

export interface Trail {
  pts: Pt[];
  /** Enemy turns left. */
  turns: number;
  burn: number;
}

/** Context passed to Strike hooks. */
export interface StrikeCtx {
  form: StrikeForm;
  fromWard: boolean;
  thruSigil: boolean;
}

export interface DamageOpts {
  /** Ignores block and Shock (status ticks). */
  raw?: boolean;
  color?: string;
  /** Consume every Shock stack for double bonus each (Storm + Stab). */
  shockAll?: boolean;
}

/** What content hooks may do. Passed in so content files never import combat code. */
export interface Api {
  c: Combat;
  damage(e: Enemy, amt: number, opt?: DamageOpts): number;
  status(e: Enemy, s: Status, n: number): void;
  living(): Enemy[];
  emit(ev: GameEvent): void;
}

/**
 * Everything a boon, Hammer or bonus can do. Numeric fields are summed across
 * all active effects, flags are OR-ed, hooks are all called.
 */
export interface Effect {
  strikeFlat?: number;
  wardBlock?: number;
  crossingFlat?: number;
  hitRadius?: number;
  inkBonus?: number;
  strikeRepeatExtra?: number;
  keepUnhitBlock?: number;
  wallExtraBinds?: number;
  wallTolerance?: number;
  zigzagJumps?: number;
  trailTurns?: number;
  trailBurn?: number;
  wallBlockedChill?: number;
  chillNoFade?: boolean;
  echoFirstStrike?: boolean;
  stabConsumeAllShock?: boolean;
  grantsSpiral?: boolean;
  /** A Sigil boon: what circling enemies does, and what Strikes passing through it carry. */
  sigil?: { damage: number; status: Status; n: number; carry: { status: Status; n: number } };
  strikeBonus?(api: Api, e: Enemy, ctx: StrikeCtx): number;
  strikeMult?(api: Api, e: Enemy, ctx: StrikeCtx): number;
  onStrikeHit?(api: Api, e: Enemy, ctx: StrikeCtx): void;
  onBlockAbsorbed?(api: Api, attacker: Enemy): void;
  onCrossing?(api: Api, at: Pt): void;
  onCrossingHit?(api: Api, e: Enemy): void;
  /** Return true to cancel the status application. */
  interceptStatus?(api: Api, e: Enemy, s: Status, n: number): boolean;
  onShockTrigger?(api: Api, e: Enemy): void;
}

export interface ActiveEffect {
  id: string;
  effect: Effect;
}

export type Phase = 'player' | 'enemy' | 'won' | 'lost';

export interface Combat {
  rng: Rng;
  build: Build;
  effects: ActiveEffect[];
  api: Api;
  player: Player;
  enemies: Enemy[];
  nextId: number;
  ink: number;
  /** Strokes cast this turn (walls, wards and sigils live until the next player turn). */
  strokes: StrokeRec[];
  trails: Trail[];
  used: Partial<Record<Glyph, number>>;
  cd: { rite: number; spiral: number };
  turn: number;
  phase: Phase;
  /** Distinct enemies hit by Strikes this turn. */
  hitThisTurn: Set<number>;
  strikesThisTurn: number;
  blockWasHit: boolean;
  trailHitThisPhase: Set<number>;
  /** Presentation events since the UI last drained them. */
  events: GameEvent[];
}
