import { type Pt, TAU } from '../core/vec';
import { FIELD } from '../content/tuning';
import { PATRONS } from '../content/boons';
import type { GameEvent } from '../combat/events';
import type { Combat, Enemy } from '../combat/state';
import { hitDmg, intentOf } from '../combat/damage';
import { INK_COLOR, slotColor, WARD_COLOR, wardForm } from '../combat/effects';

const { w: W, h: H } = FIELD;
const now = () => performance.now();

type Fx =
  | { k: 'txt'; x: number; y: number; text: string; color: string; size: number; t: number; life: number }
  | { k: 'ring'; x: number; y: number; r: number; color: string; t: number; life: number }
  | { k: 'bolt'; a: Pt; b: Pt; color: string; t: number; life: number }
  | { k: 'p'; x: number; y: number; vx: number; vy: number; r: number; color: string; t: number; life: number }
  | { k: 'ghost'; pts: Pt[]; color: string; t: number; life: number };

interface Disp {
  x: number;
  y: number;
  flash: number;
  lunge: number;
  deathT: number;
  seed: number;
}

export interface FrameInput {
  combat: Combat | null;
  drawing: Pt[] | null;
  preview: string | null;
  debugText: string | null;
  hint: string | null;
}

/** Draws the battlefield. Owns all animation state; reads combat state, never writes it. */
export class Renderer {
  private fx: Fx[] = [];
  private shake = 0;
  private pflash = 0;
  private disp = new Map<number, Disp>();
  private ctx: CanvasRenderingContext2D;

  constructor(private cv: HTMLCanvasElement) {
    this.ctx = cv.getContext('2d')!;
    const resize = () => {
      const r = cv.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(r.width * d));
      cv.height = Math.max(1, Math.round(r.height * d));
    };
    window.addEventListener('resize', resize);
    resize();
  }

  reset(): void {
    this.fx = [];
    this.disp.clear();
    this.shake = 0;
  }

  /** Field coordinates of a pointer event. */
  toField(ev: PointerEvent): Pt {
    const r = this.cv.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  }

  private d(e: Enemy): Disp {
    let d = this.disp.get(e.id);
    if (!d) {
      d = { x: e.x + 60, y: e.y, flash: 0, lunge: 0, deathT: 0, seed: Math.random() * 10 };
      this.disp.set(e.id, d);
    }
    return d;
  }

  // ---------------------------------------------------------------- events → fx

  consume(c: Combat): void {
    const t = now();
    for (const ev of c.events) this.event(c, ev, t);
    c.events.length = 0;
  }

  private float(x: number, y: number, text: string, color: string, size: number, t: number) {
    x = Math.max(90, Math.min(W - 90, x));
    y = Math.max(30, y);
    this.fx.push({ k: 'txt', x, y, text, color, size, t, life: 900 });
  }

  private splat(x: number, y: number, color: string, n: number, t: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 1.5 + Math.random() * 4;
      this.fx.push({ k: 'p', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, t, life: 500 + Math.random() * 300, r: 2 + Math.random() * 3 });
    }
  }

  private event(c: Combat, ev: GameEvent, t: number): void {
    const P = c.player;
    switch (ev.t) {
      case 'text':
        this.float(ev.x, ev.y, ev.text, ev.color, ev.size, t);
        break;
      case 'ring':
        this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: ev.color, t, life: 450 });
        break;
      case 'bolt':
        this.fx.push({ k: 'bolt', a: ev.a, b: ev.b, color: ev.color, t, life: 300 });
        break;
      case 'ghost':
        this.fx.push({ k: 'ghost', pts: ev.pts, color: ev.color, t, life: 500 });
        break;
      case 'shake':
        this.shake = Math.max(this.shake, ev.amount);
        break;
      case 'hit': {
        const e = c.enemies.find((x) => x.id === ev.id);
        if (!e) break;
        const d = this.d(e);
        d.flash = 1;
        const col = ev.color === INK_COLOR ? '#b3261e' : ev.color;
        this.splat(e.x, e.y, ev.color, Math.min(18, 4 + ev.amount), t);
        this.float(e.x + (Math.random() - 0.5) * 20, e.y - e.r - 8, String(ev.amount), col, Math.min(38, 18 + ev.amount), t);
        if (ev.amount >= 10) this.shake = Math.max(this.shake, Math.min(14, ev.amount * 0.6));
        break;
      }
      case 'death': {
        const e = c.enemies.find((x) => x.id === ev.id);
        if (!e) break;
        this.d(e).deathT = t;
        this.splat(e.x, e.y, INK_COLOR, 26, t);
        this.shake = Math.max(this.shake, 6);
        break;
      }
      case 'lunge': {
        const e = c.enemies.find((x) => x.id === ev.id);
        if (e) this.d(e).lunge = 1;
        break;
      }
      case 'playerHit':
        this.pflash = 1;
        this.shake = Math.max(this.shake, 4 + ev.amount * 0.5);
        this.splat(P.x, P.y, '#b3261e', 8 + ev.amount, t);
        this.float(P.x, P.y - 50, `-${ev.amount}`, '#b3261e', 22 + ev.amount, t);
        break;
    }
  }

  // ---------------------------------------------------------------- frame

  frame(f: FrameInput): void {
    const { ctx, cv } = this;
    const t = now();
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    if (this.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= 0.88;
    } else this.shake = 0;
    this.paper();
    const c = f.combat;
    if (c) {
      if (wardForm(c.build) === 'wall') this.wallZone();
      this.trails(c);
      this.strokes(c);
      this.player(c, t);
      for (const e of c.enemies) this.enemy(c, e, t);
    }
    this.drawing(f.drawing, f.preview);
    this.drawFx(t);
    ctx.textAlign = 'center';
    if (c?.phase === 'enemy') {
      ctx.fillStyle = 'rgba(29,26,22,.5)';
      ctx.font = 'italic 16px Georgia';
      ctx.fillText('enemy turn…', W / 2, 30);
    } else if (f.hint) {
      ctx.fillStyle = 'rgba(29,26,22,.6)';
      ctx.font = 'italic 15px Georgia';
      ctx.fillText(f.hint, W / 2, 30);
    }
    if (f.debugText) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(29,26,22,.75)';
      ctx.font = '12px monospace';
      f.debugText.split('\n').forEach((l, i) => ctx.fillText(l, 12, H - 60 + i * 15));
    }
  }

  private path(pts: readonly Pt[]) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }

  private paper() {
    const { ctx } = this;
    ctx.fillStyle = '#f3ead8';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,90,50,.07)';
    ctx.lineWidth = 1;
    for (let y = 36; y < H; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(90,60,20,.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  private wallZone() {
    const { ctx } = this;
    const x = FIELD.wallZoneX;
    ctx.setLineDash([4, 8]);
    ctx.strokeStyle = 'rgba(61,111,158,.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 50);
    ctx.lineTo(x, H - 20);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(61,111,158,.35)';
    ctx.font = 'italic 12px Georgia';
    ctx.textAlign = 'right';
    ctx.fillText('walls go on your side ←', x - 8, H - 24);
  }

  private trails(c: Combat) {
    const { ctx } = this;
    for (const tr of c.trails) {
      const col = tr.burn ? PATRONS.ember.color : '#5a3a8a';
      ctx.globalAlpha = 0.18 + 0.12 * tr.turns;
      ctx.strokeStyle = col;
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.path(tr.pts);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const end = tr.pts[tr.pts.length - 1]!;
      ctx.fillStyle = col;
      ctx.font = 'bold 12px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(`${tr.turns}`, end.x, end.y - 14);
    }
  }

  private strokes(c: Combat) {
    const { ctx } = this;
    for (const s of c.strokes) {
      const col =
        s.glyph === 'strike' ? slotColor(c, 'strike', INK_COLOR)
        : s.glyph === 'ward' ? WARD_COLOR
        : s.glyph === 'sigil' ? slotColor(c, 'sigil', '#7a6f5f')
        : PATRONS.scribe.color;
      const closed = (s.glyph === 'ward' && s.form === 'circle') || s.glyph === 'sigil';
      if (closed) {
        this.path(s.pts);
        ctx.closePath();
        ctx.fillStyle = col + '1c';
        ctx.fill();
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = s.form === 'wall' ? 9 : 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.path(s.pts);
      if (closed) ctx.closePath();
      ctx.stroke();
      if (s.form === 'wall' && s.bound) {
        const m = s.pts[Math.floor(s.pts.length / 2)]!;
        ctx.setLineDash([5, 7]);
        ctx.lineWidth = 2;
        for (const id of s.bound) {
          const e = c.enemies.find((x) => x.id === id && x.alive);
          if (!e) continue;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
    }
  }

  private bar(x: number, y: number, w: number, hp: number, max: number, col: string) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(x - w / 2, y, w, 7);
    ctx.fillStyle = col;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, hp / max), 7);
    ctx.fillStyle = INK_COLOR;
    ctx.font = 'bold 12px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(`${hp}/${max}`, x, y + 21);
  }

  private pill(x: number, y: number, text: string, bg: string) {
    const { ctx } = this;
    ctx.font = 'bold 14px Georgia';
    const w = ctx.measureText(text).width + 16;
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - 12, w, 24, 12);
    else ctx.rect(x - w / 2, y - 12, w, 24);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 5);
  }

  private player(c: Combat, t: number) {
    const { ctx } = this;
    const P = c.player;
    const bob = Math.sin(t / 500) * 3;
    ctx.fillStyle = 'rgba(0,0,0,.13)';
    ctx.beginPath();
    ctx.ellipse(P.x, P.y + 34, 30, 8, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(P.x, P.y + bob);
    ctx.fillStyle = '#2d2440';
    ctx.beginPath();
    ctx.moveTo(-26, 30);
    ctx.quadraticCurveTo(-30, -10, 0, -24);
    ctx.quadraticCurveTo(30, -10, 26, 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f6e7cf';
    ctx.beginPath();
    ctx.arc(0, -24, 14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2d2440';
    ctx.beginPath();
    ctx.arc(0, -28, 15, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = INK_COLOR;
    ctx.beginPath();
    ctx.arc(5, -23, 2, 0, TAU);
    ctx.arc(-3, -23, 2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e7d9b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(18, 10);
    ctx.lineTo(40, -26);
    ctx.stroke();
    ctx.fillStyle = '#e7d9b8';
    ctx.beginPath();
    ctx.ellipse(40, -30, 4, 12, 0.55, 0, TAU);
    ctx.fill();
    if (this.pflash > 0.02) {
      ctx.globalAlpha = this.pflash * 0.6;
      ctx.fillStyle = '#b3261e';
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      this.pflash *= 0.86;
    }
    ctx.restore();
    if (P.block > 0) {
      ctx.strokeStyle = 'rgba(61,111,158,.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(P.x, P.y, 48, 0, TAU);
      ctx.stroke();
      this.pill(P.x - 52, P.y - 40, `◆ ${P.block}`, WARD_COLOR);
    }
    this.bar(P.x, P.y + 46, 90, P.hp, P.maxHp, '#b3261e');
  }

  private intentText(e: Enemy): [string, string] {
    const it = intentOf(e);
    switch (it.t) {
      case 'atk': return [`⚔ ${hitDmg(e, it.d)}${(it.n ?? 1) > 1 ? `×${it.n}` : ''}`, '#a8321f'];
      case 'atkblock': return [`⚔ ${hitDmg(e, it.d)} ◆${it.b}`, '#a8321f'];
      case 'charge': return [`➜ ⚔ ${hitDmg(e, it.d)}`, '#a8321f'];
      case 'shield': return [`◆${it.b} all allies`, WARD_COLOR];
      case 'blockbuff': return [`◆${it.b} ▲${it.s}`, WARD_COLOR];
      case 'shift': return ['⇄ move', '#6b6055'];
      case 'scatter': return ['⇄ scatter', '#6b6055'];
      case 'flank': return ['↷ flank', '#6b6055'];
      case 'advance': return ['➜ advance', '#6b6055'];
      case 'summon': return ['✚ summon', '#4a3b2c'];
    }
  }

  private enemy(c: Combat, e: Enemy, t: number) {
    const { ctx } = this;
    const d = this.d(e);
    d.x += (e.x - d.x) * 0.14;
    d.y += (e.y - d.y) * 0.14;
    let a = 1;
    if (!e.alive) {
      a = d.deathT ? 1 - (t - d.deathT) / 500 : 0;
      if (a <= 0) return;
    }
    const x = d.x;
    const y = d.y;
    const lx = -d.lunge * 36;
    d.lunge *= 0.84;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.13)';
    ctx.beginPath();
    ctx.ellipse(x, y + e.r * 0.95, e.r * 1.05, e.r * 0.25, 0, 0, TAU);
    ctx.fill();
    ctx.translate(x + lx, y);
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const g = (i / 28) * TAU;
      const w = 1 + 0.07 * Math.sin(g * 3 + t / 420 + d.seed) + 0.05 * Math.sin(g * 5 - t / 310 + d.seed);
      const rr = e.r * w;
      const px = Math.cos(g) * rr;
      const py = Math.sin(g) * rr * (g > 0 && g < Math.PI ? 1.05 : 1);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = e.color;
    ctx.fill();
    if (d.flash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${d.flash * 0.8})`;
      ctx.fill();
      d.flash *= 0.82;
    }
    if (e.chill > 0) {
      ctx.strokeStyle = 'rgba(61,143,209,.7)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (e.burn > 0) {
      ctx.fillStyle = 'rgba(224,88,42,.25)';
      ctx.fill();
    }
    if (e.frontGuard) {
      // Shield arc on the side facing the player.
      const ang = Math.atan2(c.player.y - y, c.player.x - x);
      ctx.strokeStyle = '#c9c2a8';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 7, ang - Math.PI / 3, ang + Math.PI / 3);
      ctx.stroke();
    }
    const er = e.r * 0.2;
    const ey = -e.r * 0.15;
    for (const sx of [-e.r * 0.32, e.r * 0.18]) {
      ctx.fillStyle = '#f3ead8';
      ctx.beginPath();
      ctx.arc(sx, ey, er, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK_COLOR;
      ctx.beginPath();
      ctx.arc(sx - er * 0.4, ey + 1, er * 0.5, 0, TAU);
      ctx.fill();
    }
    if (e.boss) {
      ctx.fillStyle = e.color;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 20 - 8, -e.r + 6);
        ctx.lineTo(i * 20, -e.r - 18 + Math.abs(i) * 4);
        ctx.lineTo(i * 20 + 8, -e.r + 6);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = a;
    if (e.block > 0) {
      ctx.strokeStyle = 'rgba(61,111,158,.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, e.r + 8, 0, TAU);
      ctx.stroke();
      this.pill(x + e.r + 6, y - e.r + 4, `◆${e.block}`, WARD_COLOR);
    }
    this.bar(x, y + e.r + 10, Math.max(60, e.r * 1.8), e.hp, e.maxHp, '#7d1d14');
    this.badges(x, y + e.r + 44, e);
    if (e.alive && c.phase !== 'won') {
      const [tx, bg] = this.intentText(e);
      this.pill(x, y - e.r - (e.boss ? 36 : 22), tx, bg);
    }
    if (e.str > 0) {
      ctx.fillStyle = '#7d1d14';
      ctx.font = 'bold 12px Georgia';
      ctx.textAlign = 'left';
      ctx.fillText(`▲${e.str}`, x - e.r - 18, y - e.r + 6);
    }
    ctx.globalAlpha = 1;
  }

  private badges(x: number, y: number, e: Enemy) {
    const { ctx } = this;
    const list = (
      [
        ['burn', PATRONS.ember.color],
        ['chill', PATRONS.frost.color],
        ['shock', PATRONS.storm.color],
      ] as const
    ).filter(([k]) => e[k] > 0);
    let sx = x - (list.length - 1) * 13;
    for (const [k, col] of list) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(sx, y, 10, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(String(e[k]), sx, y + 4);
      sx += 26;
    }
  }

  private drawing(pts: Pt[] | null, preview: string | null) {
    if (!pts || pts.length < 2) return;
    const { ctx } = this;
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.path(pts);
    ctx.stroke();
    if (preview) {
      const e = pts[pts.length - 1]!;
      ctx.fillStyle = 'rgba(29,26,22,.55)';
      ctx.font = 'italic 13px Georgia';
      ctx.textAlign = 'left';
      ctx.fillText(preview, e.x + 12, e.y - 10);
    }
  }

  private drawFx(t: number) {
    const { ctx } = this;
    this.fx = this.fx.filter((f) => t - f.t < f.life);
    for (const f of this.fx) {
      const k = (t - f.t) / f.life;
      if (f.k === 'txt') {
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = f.color;
        ctx.font = `bold ${f.size}px Georgia`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(243,234,216,.9)';
        ctx.strokeText(f.text, f.x, f.y - k * 34);
        ctx.fillText(f.text, f.x, f.y - k * 34);
      } else if (f.k === 'ring') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 6 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.3 + 0.7 * k), 0, TAU);
        ctx.stroke();
      } else if (f.k === 'bolt') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(f.a.x, f.a.y);
        for (let i = 1; i < 8; i++) {
          const u = i / 8;
          ctx.lineTo(f.a.x + (f.b.x - f.a.x) * u + (Math.random() - 0.5) * 18, f.a.y + (f.b.y - f.a.y) * u + (Math.random() - 0.5) * 18);
        }
        ctx.lineTo(f.b.x, f.b.y);
        ctx.stroke();
      } else if (f.k === 'p') {
        f.x += f.vx;
        f.y += f.vy;
        f.vx *= 0.92;
        f.vy = f.vy * 0.92 + 0.15;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = (1 - k) * 0.6;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 4;
        ctx.setLineDash([6, 6]);
        this.path(f.pts);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;
  }
}
