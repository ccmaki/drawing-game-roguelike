import { type Pt, TAU, dist } from '../core/vec';

export function pathLen(p: readonly Pt[]): number {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += dist(p[i - 1]!, p[i]!);
  return L;
}

/** Resample a stroke to n evenly spaced points (the $1-recognizer resample). */
export function resample(points: readonly Pt[], n: number): Pt[] {
  const I = pathLen(points) / (n - 1);
  let D = 0;
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const out: Pt[] = [{ ...pts[0]! }];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = dist(a, b);
    if (d > 0 && D + d >= I) {
      const t = (I - D) / d;
      const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      out.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1]! });
  return out.slice(0, n);
}

/** Signed smallest difference between two angles, in (-PI, PI]. */
export function angDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

export function heading(a: Pt, b: Pt): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Even-odd point-in-polygon test (the polygon is implicitly closed). */
export function inPoly(pt: Pt, poly: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Distance from point p to segment ab. */
export function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = dx * dx + dy * dy;
  let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance from point p to an open polyline. */
export function polyDist(p: Pt, pts: readonly Pt[]): number {
  if (pts.length === 1) return dist(p, pts[0]!);
  let m = Infinity;
  for (let i = 1; i < pts.length; i++) m = Math.min(m, segDist(p, pts[i - 1]!, pts[i]!));
  return m;
}

/** Intersection point of segments ab and cd, or null. */
export function segX(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * r.x, y: a.y + t * r.y } : null;
}

export function segSegDist(a: Pt, b: Pt, c: Pt, d: Pt): number {
  if (segX(a, b, c, d)) return 0;
  return Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b));
}

/** Distance between an open polyline and segment ab. */
export function polySegDist(pts: readonly Pt[], a: Pt, b: Pt): number {
  if (pts.length === 1) return segDist(pts[0]!, a, b);
  let m = Infinity;
  for (let i = 1; i < pts.length; i++) m = Math.min(m, segSegDist(pts[i - 1]!, pts[i]!, a, b));
  return m;
}

/** All points where two open polylines cross, merged if closer than minSep. */
export function polyIntersections(p: readonly Pt[], q: readonly Pt[], minSep = 30): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < p.length; i++)
    for (let j = 1; j < q.length; j++) {
      const x = segX(p[i - 1]!, p[i]!, q[j - 1]!, q[j]!);
      if (x && !out.some((o) => dist(o, x) < minSep)) out.push(x);
    }
  return out;
}

export function centroid(pts: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

/** Does the open polyline cross (or come within tolerance of) segment ab? */
export function polyCrossesPath(pts: readonly Pt[], a: Pt, b: Pt, tolerance = 0): boolean {
  return polySegDist(pts, a, b) <= tolerance;
}
