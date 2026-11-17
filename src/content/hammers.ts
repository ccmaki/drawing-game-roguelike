import type { HammerDef, ShapeBonusDef } from './types';

/**
 * Hammers (decision 7). Shape Hammers replace a slot's shape, at most one per
 * slot. Tweak Hammers stack. Shape rule: every shape must want a different battlefield.
 */
export const HAMMERS: HammerDef[] = [
  // ---- Strike shape Hammers ----
  {
    id: 'h_zigzag', slot: 'strike', kind: 'shape', form: 'zigzag', name: 'Zigzag Nib',
    desc: 'Strike becomes a Zigzag: 4 to enemies it touches, then each corner (max 3) jumps 6 to the nearest untouched enemy within reach of that corner.',
    wants: 'Enemies spread out: put a corner near each one.',
  },
  {
    id: 'h_curve', slot: 'strike', kind: 'shape', form: 'curve', name: 'Curve Nib',
    desc: 'Strike becomes a Curve: any open stroke. Deals 3 to enemies it touches and leaves an ink trail for 2 turns. Enemies moving through it take 5, enemies standing in it take 2.',
    wants: 'Enemies that move: cut off their paths.',
  },
  {
    id: 'h_stab', slot: 'strike', kind: 'shape', form: 'stab', name: 'Stab Nib',
    desc: 'Strike becomes a Stab: hits only the first enemy the stroke touches. Short strokes hit hardest (14 at 80px or less, down to 6 at 250px or more).',
    wants: 'One enemy worth focusing.',
  },
  // ---- Ward shape Hammer ----
  {
    id: 'h_wall', slot: 'ward', kind: 'shape', form: 'wall', name: 'Wall Nib',
    desc: 'Ward becomes a Wall: an open stroke on your side of the field that touches no enemy and crosses an attacker’s path to you. That attacker’s damage is fully blocked this turn. Replaces the Ward circle.',
    wants: 'One big attacker, not many.',
  },
  // ---- Tweak Hammers ----
  {
    id: 'h_heavy', slot: 'strike', kind: 'tweak', name: 'Heavy Nib',
    desc: 'Strike hits deal +3 damage, but your second Strike in a turn costs +2 more instead of +1.',
    effect: { strikeFlat: 3, strikeRepeatExtra: 1 },
  },
  {
    id: 'h_wide', slot: 'strike', kind: 'tweak', name: 'Wide Nib',
    desc: 'Strikes hit enemies from 14px further away.',
    effect: { hitRadius: 14 },
  },
  {
    id: 'h_echo', slot: 'strike', kind: 'tweak', name: 'Echo',
    desc: 'Your first Strike each turn hits every enemy it damaged once more at half damage.',
    effect: { echoFirstStrike: true },
  },
  {
    id: 'h_wetink', slot: 'ward', kind: 'tweak', name: 'Wet Ink',
    desc: 'If nothing hit your Block during the enemy turn, half of it carries into your next turn.',
    effect: { keepUnhitBlock: 0.5 },
  },
  {
    id: 'h_reach', slot: 'ward', kind: 'tweak', name: 'Long Reach', requires: 'wall',
    desc: 'Each Wall also blocks a second attacker whose path passes within 40px of it.',
    effect: { wallExtraBinds: 1, wallTolerance: 40 },
  },
];

/** Patron/shape bonuses (decision 8). Active when the slot's patron boon and shape match. */
export const SHAPE_BONUSES: ShapeBonusDef[] = [
  {
    id: 'sb_storm_zigzag', patron: 'storm', slot: 'strike', form: 'zigzag', name: 'Forked Lightning',
    desc: 'Storm Strike + Zigzag: one more corner jump.',
    effect: { zigzagJumps: 1 },
  },
  {
    id: 'sb_ember_curve', patron: 'ember', slot: 'strike', form: 'curve', name: 'Smoulder',
    desc: 'Ember Strike + Curve: trails last 1 more turn and apply 2 Burn when they hurt.',
    effect: { trailTurns: 1, trailBurn: 2 },
  },
  {
    id: 'sb_frost_wall', patron: 'frost', slot: 'ward', form: 'wall', name: 'Rime Wall',
    desc: 'Frost Ward + Wall: attackers your Wall blocks gain 2 Chill.',
    effect: { wallBlockedChill: 2 },
  },
  {
    id: 'sb_storm_stab', patron: 'storm', slot: 'strike', form: 'stab', name: 'Grounding Stab',
    desc: 'Storm Strike + Stab: a Stab consumes all Shock on its target for +6 per stack instead of +3 for one.',
    effect: { stabConsumeAllShock: true },
  },
];
