import { type Pt, clamp, dist, lerp } from '../core/vec';
import { centroid, inPoly, polyDist, polyIntersections } from '../geometry/stroke';
import { FIELD, T } from '../content/tuning';
import { anyFx, INK_COLOR, SCRIBE_COLOR, sigilEffect, slotColor, sumFx, WARD_COLOR } from './effects';
import { applyStatus, damage, emit, intentDamage, living, text } from './damage';
import { interpret, pathsCrossed, touching } from './interpret';
import type { Combat, Enemy, Glyph, StrikeCtx, StrikeForm, StrokeRec } from './state';

export type CastResult = { ok: true; glyph: Glyph } | { ok: false; msg: string };

export function inkCost(c: Combat, g: Glyph): number {
  const n = c.used[g] ?? 0;
  let extra = n * T.repeatSurcharge;
  if (g === 'strike' && n >= 1) extra += sumFx(c, 'strikeRepeatExtra');
  return T.cost[g] + extra;
}

export function maxInk(c: Combat): number {
  return T.baseInk + sumFx(c, 'inkBonus');
}

export function checkWin(c: Combat): void {
  if ((c.phase === 'player' || c.phase === 'enemy') && !living(c).length) c.phase = 'won';
}

export function startPlayerTurn(c: Combat, first: boolean): void {
  if (!first) {
    c.cd.rite = Math.max(0, c.cd.rite - 1);
    c.cd.spiral = Math.max(0, c.cd.spiral - 1);
    c.turn++;
  }
  const keep = sumFx(c, 'keepUnhitBlock');
  c.player.block = !first && keep > 0 && !c.blockWasHit ? Math.floor(c.player.block * keep) : 0;
  if (c.player.block > 0) text(c, c.player.x, c.player.y - 70, `Wet Ink: ${c.player.block}◆ kept`, WARD_COLOR, 14);
  c.ink = maxInk(c);
  c.used = {};
  c.strokes = [];
  c.hitThisTurn = new Set();
  c.strikesThisTurn = 0;
  c.phase = 'player';
}

/** Resolve a drawn stroke. The main entry point for player input. */
export function castStroke(c: Combat, raw: readonly Pt[]): CastResult {
  if (c.phase !== 'player') return { ok: false, msg: 'not your turn' };
  const end = raw[raw.length - 1] ?? { x: 0, y: 0 };
  const it = interpret(c, raw);
  const fail = (msg: string, pts: Pt[]): CastResult => {
    text(c, end.x, end.y, msg, '#8a3b12', 15);
    emit(c, { t: 'ghost', pts, color: '#9a8f80' });
    return { ok: false, msg };
  };
  if (!it.ok) return fail(it.msg, it.pts);
  const g = it.glyph;
  if (g === 'spiral' && c.cd.spiral > 0) return fail(`Spiral on cooldown (${c.cd.spiral})`, it.a.pts);
  const cost = inkCost(c, g);
  if (c.ink < cost) return fail(`Not enough ink (needs ${cost})`, it.a.pts);
  c.ink -= cost;
  c.used[g] = (c.used[g] ?? 0) + 1;

  const st: StrokeRec = { glyph: g, form: it.form, pts: it.a.pts };
  if (g === 'strike') castStrike(c, st, it.form as StrikeForm, it.a.corners, it.a.length);
  else if (g === 'ward') castWard(c, st);
  else if (g === 'sigil') castSigil(c, st, it.inside ?? []);
  else castSpiral(c, st);
  c.strokes.push(st);
  checkWin(c);
  return { ok: true, glyph: g };
}

// ---------------------------------------------------------------- Strike

function startsFromWard(c: Combat, start: Pt): boolean {
  return c.strokes.some(
    (s) =>
      s.glyph === 'ward' &&
      (s.form === 'wall' ? polyDist(start, s.pts) < T.wallStartDist : inPoly(start, s.pts)),
  );
}

/** The point where a stroke first enters an enemy's hit circle. */
function entryPoint(pts: readonly Pt[], e: Enemy, pad: number): Pt {
  for (const p of pts) if (dist(p, e) < e.r + pad) return p;
  return pts[0]!;
}

/** Front guard: hits coming from the player-facing 120° arc are deflected. */
export function guarded(c: Combat, e: Enemy, from: Pt): boolean {
  if (!e.frontGuard) return false;
  const vx = from.x - e.x;
  const vy = from.y - e.y;
  const vl = Math.hypot(vx, vy);
  if (vl < e.r * 0.4) return false;
  const fx = c.player.x - e.x;
  const fy = c.player.y - e.y;
  const fl = Math.hypot(fx, fy) || 1;
  return (vx * fx + vy * fy) / (vl * fl) > 0.5;
}

/** One Strike hit on one enemy, with every bonus and on-hit hook. Returns HP lost. */
function strikeHit(c: Combat, e: Enemy, base: number, ctx: StrikeCtx, from: Pt): number {
  if (guarded(c, e, from)) {
    text(c, e.x, e.y - e.r - 20, 'deflected', '#5a5046', 15);
    emit(c, { t: 'ring', x: e.x, y: e.y, r: e.r + 10, color: '#5a5046' });
    return 0;
  }
  let d = base + (ctx.fromWard ? T.wardStartBonus : 0) + sumFx(c, 'strikeFlat');
  for (const fx of c.effects) d += fx.effect.strikeBonus?.(c.api, e, ctx) ?? 0;
  let mult = 1;
  for (const fx of c.effects) mult *= fx.effect.strikeMult?.(c.api, e, ctx) ?? 1;
  d = Math.round(d * mult);
  const color = slotColor(c, 'strike', INK_COLOR);
  const dealt = damage(c, e, d, { color, shockAll: ctx.form === 'stab' && anyFx(c, 'stabConsumeAllShock') });
  c.hitThisTurn.add(e.id);
  if (e.alive) {
    for (const fx of c.effects) fx.effect.onStrikeHit?.(c.api, e, ctx);
    const sig = sigilEffect(c);
    if (ctx.thruSigil && sig) applyStatus(c, e, sig.carry.status, sig.carry.n);
  }
  return dealt;
}

export function stabDamage(length: number): number {
  const t = clamp((length - T.stab.shortLen) / (T.stab.longLen - T.stab.shortLen), 0, 1);
  return Math.round(lerp(T.stab.max, T.stab.min, t));
}

function castStrike(c: Combat, st: StrokeRec, form: StrikeForm, corners: Pt[], length: number): void {
  const pts = st.pts;
  const start = pts[0]!;
  const end = pts[pts.length - 1]!;
  const pad = T.hitPad + sumFx(c, 'hitRadius');
  const ctx: StrikeCtx = {
    form,
    fromWard: startsFromWard(c, start),
    thruSigil: c.strokes.some((s) => s.glyph === 'sigil' && pts.some((p) => inPoly(p, s.pts))),
  };
  const dealt = new Map<Enemy, number>();
  const hit = (e: Enemy, base: number, from: Pt) => dealt.set(e, (dealt.get(e) ?? 0) + strikeHit(c, e, base, ctx, from));
  let label = '';

  if (form === 'line') {
    for (const e of touching(c, pts)) hit(e, T.line.damage, entryPoint(pts, e, pad));
    label = `Strike ×${dealt.size}`;
  } else if (form === 'zigzag') {
    const touched = touching(c, pts);
    for (const e of touched) hit(e, T.zigzag.body, entryPoint(pts, e, pad));
    const done = new Set<Enemy>(touched);
    const maxJumps = T.zigzag.maxJumps + sumFx(c, 'zigzagJumps');
    let jumps = 0;
    for (const corner of corners) {
      if (jumps >= maxJumps) break;
      const target = living(c)
        .filter((e) => !done.has(e) && dist(e, corner) < T.zigzag.jumpRange + e.r)
        .sort((a, b) => dist(a, corner) - dist(b, corner))[0];
      if (!target) continue;
      done.add(target);
      jumps++;
      emit(c, { t: 'bolt', a: corner, b: { x: target.x, y: target.y }, color: slotColor(c, 'strike', '#c99a00') });
      hit(target, T.zigzag.jump, corner);
    }
    label = `Zigzag ×${touched.length} + ${jumps} jump${jumps === 1 ? '' : 's'}`;
  } else if (form === 'curve') {
    for (const e of touching(c, pts)) hit(e, T.curve.damage, entryPoint(pts, e, pad));
    c.trails.push({ pts, turns: T.curve.trailTurns + sumFx(c, 'trailTurns'), burn: sumFx(c, 'trailBurn') });
    label = `Curve ×${dealt.size} · trail`;
  } else {
    // Stab: only the first enemy along the stroke.
    let first: Enemy | undefined;
    for (const p of pts) {
      first = living(c).find((e) => dist(p, e) < e.r + pad);
      if (first) break;
    }
    if (first) hit(first, stabDamage(length), entryPoint(pts, first, pad));
    label = first ? `Stab ${stabDamage(length)}` : 'Stab';
  }

  if (anyFx(c, 'echoFirstStrike') && c.strikesThisTurn === 0) {
    for (const [e, d] of dealt) {
      if (!e.alive || d <= 0) continue;
      text(c, e.x, e.y - e.r - 40, 'echo', SCRIBE_COLOR, 14);
      damage(c, e, Math.ceil(d / 2), { color: SCRIBE_COLOR });
    }
  }
  c.strikesThisTurn++;
  const tags = `${ctx.fromWard ? ' · empowered' : ''}${ctx.thruSigil ? ' · infused' : ''}`;
  text(c, end.x, end.y - 16, dealt.size || form === 'curve' ? label + tags : `${label}: missed`, INK_COLOR, 15);
  crossings(c, st);
}

/** Spatial combo: this Strike crossing earlier Strikes or live trails bursts. */
function crossings(c: Combat, st: StrokeRec): void {
  const others = [
    ...c.strokes.filter((s) => s.glyph === 'strike' && s !== st).map((s) => s.pts),
    ...c.trails.filter((t) => t.pts !== st.pts).map((t) => t.pts),
  ];
  const pts: Pt[] = [];
  for (const o of others)
    for (const x of polyIntersections(st.pts, o, T.cross.minSep)) if (!pts.some((p) => dist(p, x) < T.cross.minSep)) pts.push(x);
  for (const x of pts.slice(0, T.cross.maxPerStroke)) burst(c, x);
}

function burst(c: Combat, at: Pt): void {
  const bonus = sumFx(c, 'crossingFlat');
  const col = bonus ? '#e0582a' : INK_COLOR;
  emit(c, { t: 'ring', x: at.x, y: at.y, r: T.cross.radius, color: col });
  text(c, at.x, at.y - 20, 'CROSS!', col, 18);
  emit(c, { t: 'shake', amount: 5 });
  for (const e of living(c)) {
    if (dist(e, at) >= T.cross.radius + e.r) continue;
    damage(c, e, T.cross.damage + bonus, { color: col });
    for (const fx of c.effects) fx.effect.onCrossingHit?.(c.api, e);
  }
  for (const fx of c.effects) fx.effect.onCrossing?.(c.api, at);
}

// ---------------------------------------------------------------- Ward / Sigil / Spiral / Rite

function castWard(c: Combat, st: StrokeRec): void {
  const P = c.player;
  const bonus = sumFx(c, 'wardBlock');
  if (st.form === 'wall') {
    const byThreat = (a: Enemy, b: Enemy) => intentDamage(b) - intentDamage(a);
    const crossed = pathsCrossed(c, st.pts).sort(byThreat);
    const bound = crossed.slice(0, 1);
    const extra = sumFx(c, 'wallExtraBinds');
    if (extra > 0) {
      const near = pathsCrossed(c, st.pts, sumFx(c, 'wallTolerance')).filter((e) => !bound.includes(e)).sort(byThreat);
      bound.push(...near.slice(0, extra));
    }
    st.bound = bound.map((e) => e.id);
    P.block += bonus;
    const m = centroid(st.pts);
    text(c, m.x, m.y - 24, `Wall ⟂ ${bound.map((e) => e.name).join(', ')}${bonus ? ` · +${bonus}◆` : ''}`, WARD_COLOR, 16);
  } else {
    const b = T.ward.circle + bonus;
    P.block += b;
    text(c, P.x, P.y - 60, `+${b} Block`, WARD_COLOR, 20);
    emit(c, { t: 'ring', x: P.x, y: P.y, r: 60, color: WARD_COLOR });
  }
}

function castSigil(c: Combat, st: StrokeRec, inside: Enemy[]): void {
  const sig = sigilEffect(c);
  const col = slotColor(c, 'sigil', '#7a6f5f');
  if (sig)
    for (const e of inside) {
      damage(c, e, sig.damage, { color: col });
      applyStatus(c, e, sig.status, sig.n);
    }
  const m = centroid(st.pts);
  text(c, m.x, m.y, `Sigil ×${inside.length}`, col, 18);
  emit(c, { t: 'ring', x: m.x, y: m.y, r: 90, color: col });
}

function castSpiral(c: Combat, st: StrokeRec): void {
  const A = FIELD.enemyArea;
  const m = centroid(st.pts);
  m.x = clamp(m.x, A.x0 + 30, A.x1 - 30);
  m.y = clamp(m.y, A.y0 + 15, A.y1 - 5);
  const L = living(c);
  for (const e of L) {
    e.x = m.x + (e.x - m.x) * T.spiral.pull;
    e.y = m.y + (e.y - m.y) * T.spiral.pull;
  }
  separate(L);
  for (const e of L) damage(c, e, T.spiral.damage, { color: SCRIBE_COLOR });
  c.cd.spiral = T.spiral.cooldown;
  emit(c, { t: 'ring', x: m.x, y: m.y, r: 140, color: SCRIBE_COLOR });
  text(c, m.x, m.y, 'PULL!', SCRIBE_COLOR, 22);
}

/** Push overlapping enemies apart and keep them on the field. */
export function separate(L: Enemy[]): void {
  for (let it = 0; it < 40; it++)
    for (let i = 0; i < L.length; i++)
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i]!;
        const b = L[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const m = a.r + b.r + 6;
        if (d < m) {
          const push = (m - d) / 2;
          dx /= d;
          dy /= d;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
  for (const e of L) {
    e.x = clamp(e.x, 260, FIELD.w - 50);
    e.y = clamp(e.y, 70, FIELD.h - 60);
  }
}

export function canRite(c: Combat): boolean {
  return c.phase === 'player' && c.cd.rite === 0 && c.ink >= T.rite.cost;
}

export function castRite(c: Combat): boolean {
  if (!canRite(c)) return false;
  c.ink -= T.rite.cost;
  c.cd.rite = T.rite.cooldown;
  for (const e of living(c)) {
    emit(c, { t: 'bolt', a: { x: e.x + (c.rng.next() - 0.5) * 80, y: 0 }, b: { x: e.x, y: e.y }, color: SCRIBE_COLOR });
    damage(c, e, T.rite.damage, { color: SCRIBE_COLOR });
  }
  emit(c, { t: 'ring', x: 700, y: 290, r: 320, color: SCRIBE_COLOR });
  emit(c, { t: 'shake', amount: 12 });
  text(c, 690, 80, 'INKSTORM', SCRIBE_COLOR, 30);
  checkWin(c);
  return true;
}

