import { describe, expect, it } from 'vitest';
import { recognize } from '../src/geometry/recognize';
import { inPoly, polyIntersections, resample, segX } from '../src/geometry/stroke';
import { arc, circle, line, noisy, polyline, spiral } from './helpers';

const shape = (pts: { x: number; y: number }[]) => recognize(pts)?.shape ?? null;

describe('geometry helpers', () => {
  it('resamples to exactly n points spanning the stroke', () => {
    const r = resample(line({ x: 0, y: 0 }, { x: 100, y: 0 }, 7), 64);
    expect(r).toHaveLength(64);
    expect(r[0]!.x).toBeCloseTo(0);
    expect(r[63]!.x).toBeCloseTo(100, 0);
  });

  it('finds segment intersections', () => {
    expect(segX({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 5 });
    expect(segX({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeNull();
    const xs = polyIntersections(line({ x: 0, y: 50 }, { x: 100, y: 50 }), line({ x: 50, y: 0 }, { x: 50, y: 100 }));
    expect(xs).toHaveLength(1);
  });

  it('tests point in polygon', () => {
    const c = circle({ x: 100, y: 100 }, 50, 1);
    expect(inPoly({ x: 100, y: 100 }, c)).toBe(true);
    expect(inPoly({ x: 200, y: 100 }, c)).toBe(false);
  });
});

describe('shape recognition', () => {
  it('rejects tiny strokes and taps', () => {
    expect(recognize([{ x: 0, y: 0 }, { x: 5, y: 5 }])).toBeNull();
    expect(recognize(line({ x: 0, y: 0 }, { x: 20, y: 10 }))).toBeNull();
  });

  it.each([
    ['horizontal', { x: 100, y: 100 }, { x: 500, y: 120 }],
    ['vertical', { x: 300, y: 50 }, { x: 310, y: 450 }],
    ['diagonal', { x: 100, y: 400 }, { x: 600, y: 100 }],
    ['short', { x: 100, y: 100 }, { x: 170, y: 110 }],
  ])('reads a %s line', (_n, a, b) => {
    expect(shape(line(a, b))).toBe('line');
    // Hand jitter of a few px (the input layer drops points closer than 2.5px apart).
    expect(shape(noisy(line(a, b, 20), 5))).toBe('line');
  });

  it('reads circles, including sloppy and partial ones', () => {
    expect(shape(circle({ x: 200, y: 200 }, 60))).toBe('circle');
    expect(shape(noisy(circle({ x: 200, y: 200 }, 70), 8, 3))).toBe('circle');
    expect(shape(circle({ x: 200, y: 200 }, 60, 0.85))).toBe('circle'); // didn't quite close
  });

  it('reads zigzags', () => {
    const z = polyline([{ x: 100, y: 300 }, { x: 200, y: 150 }, { x: 300, y: 300 }, { x: 400, y: 150 }, { x: 500, y: 300 }]);
    expect(shape(z)).toBe('zigzag');
    expect(recognize(z)!.a.corners.length).toBeGreaterThanOrEqual(3);
    expect(shape(noisy(z, 6, 2))).toBe('zigzag');
  });

  it('reads spirals', () => {
    expect(shape(spiral({ x: 300, y: 300 }, 10, 90, 2.2))).toBe('spiral');
  });

  it('reads an open arc as an open stroke (Curve material), not a line or circle', () => {
    const a = arc({ x: 300, y: 300 }, 150, Math.PI, 0); // half circle
    expect(shape(a)).toBe('open');
  });

  it('reads a gentle bow as a line (forgiving)', () => {
    const bow = arc({ x: 300, y: 900 }, 700, -Math.PI * 0.65, -Math.PI * 0.35);
    expect(shape(bow)).toBe('line');
  });
});
