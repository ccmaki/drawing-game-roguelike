import { type Pt, dist } from '../core/vec';
import { angDiff, heading, pathLen, resample } from './stroke';

/**
 * Raw shape of a stroke, before game rules decide what it casts.
 * 'open' = an open stroke that is neither clearly a line nor a zigzag (an arc, a wobble…).
 * Which glyph a raw shape becomes depends on the player's Hammers (see combat/interpret.ts).
 */
export type RawShape = 'line' | 'circle' | 'zigzag' | 'spiral' | 'open';

export interface Analysis {
  /** Stroke resampled to RECOG.samples points. */
  pts: Pt[];
  length: number;
  /** Distance from first to last point. */
  chord: number;
  /** chord / length: 1 = perfectly straight. */
  straightness: number;
  /** |total signed turning| in radians. A full circle ≈ 2π, a zigzag ≈ 0. */
  turning: number;
  closed: boolean;
  corners: Pt[];
}

/** Recognition thresholds. From the v0 prototype, plus cornerMinSpacing (v1). */
export const RECOG = {
  minLength: 40,
  samples: 64,
  cornerSamples: 26,
  /** Corner samples are at least this far apart, so hand jitter on short strokes isn't read as corners. */
  cornerMinSpacing: 8,
  cornerAngle: Math.PI * 0.3,
  cornerMinGap: 2,
  lineStraightness: 0.86,
  looseLineStraightness: 0.7,
  spiralTurning: Math.PI * 3.4,
  closedChordMin: 38,
  closedChordFrac: 0.24,
  circleTurning: Math.PI * 1.3,
  zigzagMaxTurning: Math.PI * 2.2,
  openCircleTurning: Math.PI * 1.55,
  openCircleChordFrac: 0.42,
};

export function findCorners(raw: readonly Pt[]): Pt[] {
  const n = Math.max(6, Math.min(RECOG.cornerSamples, Math.round(pathLen(raw) / RECOG.cornerMinSpacing)));
  const q = resample(raw, n);
  const corners: Pt[] = [];
  let last = -9;
  for (let i = 1; i < q.length - 1; i++) {
    const da = Math.abs(angDiff(heading(q[i - 1]!, q[i]!), heading(q[i]!, q[i + 1]!)));
    if (da > RECOG.cornerAngle && i - last > RECOG.cornerMinGap) {
      corners.push(q[i]!);
      last = i;
    }
  }
  return corners;
}

export function analyze(raw: readonly Pt[]): Analysis | null {
  if (raw.length < 4) return null;
  const length = pathLen(raw);
  if (length < RECOG.minLength) return null;
  const pts = resample(raw, RECOG.samples);
  const chord = dist(pts[0]!, pts[pts.length - 1]!);
  let total = 0;
  for (let i = 2; i < pts.length; i++) total += angDiff(heading(pts[i - 2]!, pts[i - 1]!), heading(pts[i - 1]!, pts[i]!));
  return {
    pts,
    length,
    chord,
    straightness: chord / length,
    turning: Math.abs(total),
    closed: chord < Math.max(RECOG.closedChordMin, RECOG.closedChordFrac * length),
    corners: findCorners(raw),
  };
}

export function rawShape(a: Analysis): RawShape {
  const R = RECOG;
  if (a.straightness > R.lineStraightness) return 'line';
  if (a.turning > R.spiralTurning) return 'spiral';
  if (a.closed && a.turning > R.circleTurning) return 'circle';
  if (a.corners.length >= 2 && a.turning < R.zigzagMaxTurning && !a.closed) return 'zigzag';
  if (a.turning > R.openCircleTurning && a.chord < R.openCircleChordFrac * a.length) return 'circle';
  if (a.straightness > R.looseLineStraightness) return 'line';
  return 'open';
}

export function recognize(raw: readonly Pt[]): { shape: RawShape; a: Analysis } | null {
  const a = analyze(raw);
  return a ? { shape: rawShape(a), a } : null;
}
