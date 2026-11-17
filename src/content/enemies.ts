import type { EncounterDef, EnemyDef } from './types';

export const ENEMIES: Record<string, EnemyDef> = {
  // ---- v0 ----
  inkling: { name: 'Inkling', hp: 16, r: 28, color: '#2b2622', pattern: [{ t: 'atk', d: 6 }, { t: 'atk', d: 7 }, { t: 'atk', d: 4, n: 2 }] },
  bulwark: { name: 'Bulwark', hp: 30, r: 38, color: '#3b3631', pattern: [{ t: 'atkblock', d: 6, b: 8 }, { t: 'atk', d: 12 }] },
  quill: { name: 'Quillshot', hp: 12, r: 23, color: '#4a2a3c', pattern: [{ t: 'atk', d: 3, n: 2 }, { t: 'shift' }, { t: 'atk', d: 5 }] },
  warden: { name: 'Warden', hp: 22, r: 30, color: '#263644', pattern: [{ t: 'shield', b: 6 }, { t: 'atk', d: 6 }] },
  blot: {
    name: 'The Blot', hp: 120, r: 62, color: '#141110', boss: true, startAt: 0,
    pattern: [{ t: 'atk', d: 13 }, { t: 'summon', type: 'inkling', n: 2, max: 4 }, { t: 'atk', d: 4, n: 3 }, { t: 'blockbuff', b: 14, s: 2 }],
  },
  // ---- new: built to push back against specific shapes ----
  /** Tiny and always bunched: Stab wastes damage on them. */
  mite: { name: 'Mite', hp: 7, r: 16, color: '#3a302a', pattern: [{ t: 'atk', d: 3 }, { t: 'atk', d: 2, n: 2 }] },
  /** Keeps away from its allies so no single Line reaches them all. */
  skitter: { name: 'Skitter', hp: 11, r: 21, color: '#4b3a22', pattern: [{ t: 'atk', d: 5 }, { t: 'scatter' }, { t: 'atk', d: 4 }] },
  /** Runs at you: its path is where a Curve trail goes. */
  charger: { name: 'Charger', hp: 20, r: 27, color: '#5a2320', startAt: 0, pattern: [{ t: 'advance', dist: 160 }, { t: 'charge', dist: 160, d: 9 }] },
  /** Moves above/below you, so attacks come from several sides at once (one Wall can't cover it). */
  flanker: { name: 'Flanker', hp: 14, r: 22, color: '#2f2a45', startAt: 0, pattern: [{ t: 'flank' }, { t: 'atk', d: 5, n: 2 }, { t: 'atk', d: 7 }] },
  /** Deflects Strikes that come from the side facing you. Hit it from above, below or behind. */
  shieldbearer: { name: 'Shieldbearer', hp: 26, r: 33, color: '#3a4a3a', frontGuard: true, pattern: [{ t: 'atkblock', d: 5, b: 6 }, { t: 'atk', d: 9 }] },
  /** One huge target. */
  hulk: { name: 'Hulk', hp: 70, r: 52, color: '#2a2420', pattern: [{ t: 'atk', d: 16 }, { t: 'blockbuff', b: 10, s: 1 }, { t: 'atk', d: 6, n: 2 }] },
};

const mites = (cx: number, cy: number, n: number) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i === 0 ? 0 : 44;
    out.push({ type: 'mite', x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
};

/** Encounter formations. Positions are on the 960×540 field; spawns get a little jitter. */
export const ENCOUNTERS: EncounterDef[] = [
  // ---- early fights ----
  { id: 'margins', name: 'The Margins', kind: 'fight', rows: [0, 2], pushback: 'Baseline.',
    enemies: [{ type: 'inkling', x: 590, y: 200 }, { type: 'inkling', x: 600, y: 380 }] },
  { id: 'quillalley', name: 'Quill Alley', kind: 'fight', rows: [0, 3], pushback: 'Quills reposition, so lined-up shots don’t stay lined up.',
    enemies: [{ type: 'inkling', x: 590, y: 290 }, { type: 'quill', x: 800, y: 170 }, { type: 'quill', x: 810, y: 410 }] },
  { id: 'swarm', name: 'Mite Swarm', kind: 'fight', rows: [0, 4], pushback: 'Bunched swarm: Stab hits one Mite at a time. Line, Curve and crossings shine.',
    enemies: [...mites(700, 260, 5), { type: 'mite', x: 700, y: 360 }] },
  { id: 'skirmish', name: 'Skirmish Line', kind: 'fight', rows: [1, 5], pushback: 'Spread out, and Skitters keep spreading: one Line can’t reach them. Zigzag shines.',
    enemies: [{ type: 'skitter', x: 480, y: 110 }, { type: 'skitter', x: 640, y: 470 }, { type: 'skitter', x: 880, y: 140 }, { type: 'inkling', x: 760, y: 330 }] },
  // ---- mid fights ----
  { id: 'chargers', name: 'The Stampede', kind: 'fight', rows: [2, 7], pushback: 'Chargers run at you: a Curve across their path hurts them every step.',
    enemies: [{ type: 'charger', x: 860, y: 180 }, { type: 'charger', x: 870, y: 400 }, { type: 'quill', x: 790, y: 290 }] },
  { id: 'shieldwall', name: 'Shield Wall', kind: 'fight', rows: [3, 7], pushback: 'Shieldbearer deflects strokes from your side. Come in from above, below or with Zigzag corners.',
    enemies: [{ type: 'shieldbearer', x: 560, y: 290 }, { type: 'skitter', x: 780, y: 170 }, { type: 'skitter', x: 790, y: 420 }] },
  { id: 'flankers', name: 'Pincer', kind: 'fight', rows: [3, 7], pushback: 'Attacks from several sides at once: one Wall only stops one of them.',
    enemies: [{ type: 'flanker', x: 760, y: 160 }, { type: 'flanker', x: 770, y: 420 }, { type: 'inkling', x: 600, y: 290 }] },
  { id: 'boundgate', name: 'The Bound Gate', kind: 'fight', rows: [3, 7], pushback: 'Warden shields everyone: spread damage gets soaked up.',
    enemies: [{ type: 'bulwark', x: 590, y: 220 }, { type: 'inkling', x: 600, y: 380 }, { type: 'warden', x: 810, y: 290 }] },
  { id: 'swarmwarden', name: 'Kept Swarm', kind: 'fight', rows: [4, 7], pushback: 'Shielded swarm: small hits vanish into Block.',
    enemies: [...mites(640, 290, 4), { type: 'warden', x: 830, y: 290 }] },
  // ---- elites ----
  { id: 'inkguard', name: 'Inkguard', kind: 'elite', rows: [3, 7], pushback: 'v0 elite: front and back rows with a Warden.',
    enemies: [{ type: 'bulwark', x: 590, y: 200 }, { type: 'quill', x: 800, y: 160 }, { type: 'warden', x: 610, y: 390 }, { type: 'quill', x: 820, y: 420 }] },
  { id: 'hulk', name: 'The Hulk', kind: 'elite', rows: [3, 7], pushback: 'One huge hitter: Stab focus and a Wall shine; spread shapes waste damage.',
    enemies: [{ type: 'hulk', x: 650, y: 290 }, { type: 'mite', x: 830, y: 190 }, { type: 'mite', x: 840, y: 390 }] },
  { id: 'phalanx', name: 'Phalanx', kind: 'elite', rows: [3, 7], pushback: 'Two front guards protect a Warden. Straight shots from your side bounce off.',
    enemies: [{ type: 'shieldbearer', x: 560, y: 200 }, { type: 'shieldbearer', x: 560, y: 380 }, { type: 'warden', x: 800, y: 290 }] },
  // ---- boss ----
  { id: 'blot', name: 'The Blot', kind: 'boss', rows: [0, 99], pushback: 'Summons Inklings; big single hits.',
    enemies: [{ type: 'blot', x: 690, y: 290 }] },
];
