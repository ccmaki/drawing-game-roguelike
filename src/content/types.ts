import type { Effect, Intent, StrikeForm, WardForm } from '../combat/state';

export type PatronId = 'ember' | 'frost' | 'storm' | 'scribe';

export interface PatronDef {
  name: string;
  color: string;
}

export interface BoonDef {
  id: string;
  patron: PatronId;
  slot: 'strike' | 'ward' | 'sigil' | 'passive' | 'glyph';
  name: string;
  desc: string;
  rare?: boolean;
  effect: Effect;
}

export interface DuoDef {
  id: string;
  patrons: [PatronId, PatronId];
  name: string;
  desc: string;
  effect: Effect;
}

export interface HammerDef {
  id: string;
  slot: 'strike' | 'ward';
  /** 'shape' changes the glyph's shape (max one per slot); 'tweak' stacks. */
  kind: 'shape' | 'tweak';
  form?: StrikeForm | WardForm;
  /** Only offered when this slot has this form. */
  requires?: StrikeForm | WardForm;
  name: string;
  desc: string;
  /** What battlefield this shape wants (shape design rule). */
  wants?: string;
  effect?: Effect;
}

/** Bonus a patron gets when its slot boon meets a fitting shape (decision 8). */
export interface ShapeBonusDef {
  id: string;
  patron: PatronId;
  slot: 'strike' | 'ward';
  form: StrikeForm | WardForm;
  name: string;
  desc: string;
  effect: Effect;
}

export interface EnemyDef {
  name: string;
  hp: number;
  r: number;
  color: string;
  pattern: Intent[];
  /** Pattern index to start on; random if omitted. */
  startAt?: number;
  boss?: boolean;
  frontGuard?: boolean;
}

export type EncounterKind = 'fight' | 'elite' | 'boss';

export interface EncounterDef {
  id: string;
  name: string;
  kind: EncounterKind;
  /** Map rows (0-based) this encounter can appear on, inclusive. */
  rows: [number, number];
  enemies: { type: string; x: number; y: number }[];
  /** Which shapes this formation pushes back against (design note, shown in debug). */
  pushback: string;
}
