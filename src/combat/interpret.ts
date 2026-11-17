import type { Pt } from '../core/vec';
import { analyze, rawShape, type Analysis } from '../geometry/recognize';
import { inPoly, polyCrossesPath, polyDist } from '../geometry/stroke';
import { FIELD, T } from '../content/tuning';
import { anyFx, strikeForm, sumFx, wardForm } from './effects';
import { living } from './damage';
import type { Combat, Enemy, Glyph, StrikeForm, WardForm } from './state';

export type Interpretation =
  | { ok: true; glyph: Glyph; form: StrikeForm | WardForm | null; a: Analysis; inside?: Enemy[] }
  | { ok: false; msg: string; pts: Pt[] };

const FORM_NAME: Record<StrikeForm, string> = { line: 'Line', zigzag: 'Zigzag', curve: 'Curve', stab: 'Stab' };

/** Enemies a Strike stroke touches. */
export function touching(c: Combat, pts: readonly Pt[]): Enemy[] {
  const pad = T.hitPad + sumFx(c, 'hitRadius');
  return living(c).filter((e) => polyDist(e, pts) < e.r + pad);
}

/** Enemies whose straight path to the player this stroke crosses (within tolerance). */
export function pathsCrossed(c: Combat, pts: readonly Pt[], tolerance = 0): Enemy[] {
  return living(c).filter((e) => polyCrossesPath(pts, e, c.player, tolerance));
}

/**
 * Decide what a stroke casts, given the player's shapes (Hammers replace the
 * slot's default shape, decision 16). Pure: does not change the combat.
 */
export function interpret(c: Combat, raw: readonly Pt[]): Interpretation {
  const a = analyze(raw);
  if (!a) return { ok: false, msg: 'fizzle: too short', pts: [...raw] };
  let shape = rawShape(a);
  const sForm = strikeForm(c.build);
  const wForm = wardForm(c.build);
  const fail = (msg: string): Interpretation => ({ ok: false, msg, pts: a.pts });

  if (shape === 'spiral') {
    if (anyFx(c, 'grantsSpiral')) return { ok: true, glyph: 'spiral', form: null, a };
    shape = 'circle';
  }

  if (shape === 'circle') {
    if (inPoly(c.player, a.pts)) {
      if (wForm === 'circle') return { ok: true, glyph: 'ward', form: 'circle', a };
      return fail('Your Ward is a Wall: draw a stroke across an attacker’s path');
    }
    if (!c.build.slots.sigil) return fail('Sigil locked: find a Sigil boon');
    const inside = living(c).filter((e) => inPoly(e, a.pts));
    if (!inside.length) return fail('Sigil: no enemies inside');
    return { ok: true, glyph: 'sigil', form: null, a, inside };
  }

  // Open strokes: a Wall if the Ward is a Wall, the stroke is on your side, touches no enemy and crosses an attacker's path.
  if (
    wForm === 'wall' &&
    a.pts.every((p) => p.x < FIELD.wallZoneX) &&
    !touching(c, a.pts).length &&
    pathsCrossed(c, a.pts).length
  )
    return { ok: true, glyph: 'ward', form: 'wall', a };

  const strike = (form: StrikeForm): Interpretation => ({ ok: true, glyph: 'strike', form, a });
  switch (sForm) {
    case 'line':
      if (shape === 'line') return strike('line');
      if (shape === 'zigzag' && a.straightness > 0.6) return strike('line'); // sloppy line (v0)
      return fail('fizzle: unclear shape');
    case 'zigzag':
      if (shape === 'zigzag' || (shape === 'open' && a.corners.length >= 2)) return strike('zigzag');
      return fail(`Your Strike is a ${FORM_NAME.zigzag}: add corners`);
    case 'curve':
      return strike('curve'); // any open stroke
    case 'stab':
      if (shape === 'line' || a.straightness > 0.6) return strike('stab');
      return fail(`Your Strike is a ${FORM_NAME.stab}: keep it short and straight`);
  }
}

export function glyphLabel(it: Interpretation): string {
  if (!it.ok) return '?';
  if (it.glyph === 'strike') return FORM_NAME[it.form as StrikeForm];
  if (it.glyph === 'ward') return it.form === 'wall' ? 'Wall' : 'Ward';
  return it.glyph === 'sigil' ? 'Sigil' : 'Spiral';
}
