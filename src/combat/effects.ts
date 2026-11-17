import { BOON, DUO, HAMMER, PATRONS, SHAPE_BONUSES } from '../content';
import type { PatronId, ShapeBonusDef } from '../content/types';
import type { ActiveEffect, Build, Combat, Effect, StrikeForm, WardForm } from './state';

type NumKey = { [K in keyof Effect]-?: Effect[K] extends number | undefined ? K : never }[keyof Effect];
type FlagKey = { [K in keyof Effect]-?: Effect[K] extends boolean | undefined ? K : never }[keyof Effect];

export function newBuild(): Build {
  return { boons: new Set(), slots: { strike: null, ward: null, sigil: null }, hammers: new Set(), shape: { strike: null, ward: null } };
}

export function strikeForm(b: Build): StrikeForm {
  return (b.shape.strike && (HAMMER[b.shape.strike]?.form as StrikeForm)) || 'line';
}

export function wardForm(b: Build): WardForm {
  return (b.shape.ward && (HAMMER[b.shape.ward]?.form as WardForm)) || 'circle';
}

export function slotPatron(b: Build, slot: 'strike' | 'ward' | 'sigil'): PatronId | null {
  const id = b.slots[slot];
  return id ? (BOON[id]?.patron ?? null) : null;
}

export function activeShapeBonuses(b: Build): ShapeBonusDef[] {
  return SHAPE_BONUSES.filter(
    (sb) => slotPatron(b, sb.slot) === sb.patron && (sb.slot === 'strike' ? strikeForm(b) : wardForm(b)) === sb.form,
  );
}

/** Every effect that applies with this build: boons, duos, Hammers and active patron/shape bonuses. */
export function activeEffects(b: Build): ActiveEffect[] {
  const out: ActiveEffect[] = [];
  for (const id of b.boons) {
    const def = BOON[id] ?? DUO[id];
    if (def) out.push({ id, effect: def.effect });
  }
  for (const id of b.hammers) {
    const h = HAMMER[id];
    if (h?.effect) out.push({ id, effect: h.effect });
  }
  for (const sb of activeShapeBonuses(b)) out.push({ id: sb.id, effect: sb.effect });
  return out;
}

export function refreshEffects(c: Combat): void {
  c.effects = activeEffects(c.build);
}

export function sumFx(c: Combat, key: NumKey): number {
  let s = 0;
  for (const a of c.effects) s += a.effect[key] ?? 0;
  return s;
}

export function anyFx(c: Combat, key: FlagKey): boolean {
  return c.effects.some((a) => a.effect[key]);
}

export function has(c: Combat, id: string): boolean {
  return c.build.boons.has(id) || c.build.hammers.has(id);
}

export function sigilEffect(c: Combat) {
  const id = c.build.slots.sigil;
  return id ? (BOON[id]?.effect.sigil ?? null) : null;
}

export const INK_COLOR = '#1d1a16';
export const WARD_COLOR = '#3d6f9e';
export const SCRIBE_COLOR = PATRONS.scribe.color;

export function slotColor(c: Combat, slot: 'strike' | 'ward' | 'sigil', fallback: string): string {
  const p = slotPatron(c.build, slot);
  return p ? PATRONS[p].color : fallback;
}
