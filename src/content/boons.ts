import type { Api, Enemy } from '../combat/state';
import type { BoonDef, DuoDef, PatronDef, PatronId } from './types';

export const PATRONS: Record<PatronId, PatronDef> = {
  ember: { name: 'Ember', color: '#e0582a' },
  frost: { name: 'Frost', color: '#3d8fd1' },
  storm: { name: 'Storm', color: '#c99a00' },
  scribe: { name: 'Scribe', color: '#7a4bb5' },
};

export const DUO_COLOR = '#c2307a';

const near = (api: Api, e: Enemy, r: number) =>
  api.living().filter((o) => o !== e && Math.hypot(o.x - e.x, o.y - e.y) < r);

/**
 * Patron boons. Written against "Strike hit", "Ward", "block absorbed" etc.
 * so they work on any shape (decision 6).
 */
export const BOONS: BoonDef[] = [
  // ---- Ember ----
  {
    id: 'searing', patron: 'ember', slot: 'strike', name: 'Searing Stroke',
    desc: 'Strike hits apply 2 Burn.',
    effect: { onStrikeHit: (api, e) => api.status(e, 'burn', 2) },
  },
  {
    id: 'cinder', patron: 'ember', slot: 'ward', name: 'Cinder Ward',
    desc: 'Ward gives +2 Block. Enemies whose attack your Ward stops gain 3 Burn.',
    effect: { wardBlock: 2, onBlockAbsorbed: (api, a) => api.status(a, 'burn', 3) },
  },
  {
    id: 'brand', patron: 'ember', slot: 'sigil', name: 'Brand',
    desc: 'Sigil: circle enemies to deal 3 and apply 3 Burn. Strikes through it add 2 Burn.',
    effect: { sigil: { damage: 3, status: 'burn', n: 3, carry: { status: 'burn', n: 2 } } },
  },
  {
    id: 'flashpoint', patron: 'ember', slot: 'passive', name: 'Flashpoint',
    desc: 'Crossings deal +3 damage and apply 2 Burn.',
    effect: { crossingFlat: 3, onCrossingHit: (api, e) => api.status(e, 'burn', 2) },
  },
  // ---- Frost ----
  {
    id: 'rime', patron: 'frost', slot: 'strike', name: 'Rime Stroke',
    desc: 'Strike hits apply 2 Chill.',
    effect: { onStrikeHit: (api, e) => api.status(e, 'chill', 2) },
  },
  {
    id: 'glacial', patron: 'frost', slot: 'ward', name: 'Glacial Ward',
    desc: 'Ward gives +4 Block. Strikes that start from your Ward apply 2 Chill.',
    effect: { wardBlock: 4, onStrikeHit: (api, e, ctx) => ctx.fromWard && api.status(e, 'chill', 2) },
  },
  {
    id: 'frostring', patron: 'frost', slot: 'sigil', name: 'Frost Ring',
    desc: 'Sigil: circle enemies to deal 3 and apply 3 Chill. Strikes through it add 2 Chill.',
    effect: { sigil: { damage: 3, status: 'chill', n: 3, carry: { status: 'chill', n: 2 } } },
  },
  {
    id: 'deepcold', patron: 'frost', slot: 'passive', name: 'Deep Cold',
    desc: 'Chill no longer fades over time.',
    effect: { chillNoFade: true },
  },
  // ---- Storm ----
  {
    id: 'arc', patron: 'storm', slot: 'strike', name: 'Arc Stroke',
    desc: 'Strike hits deal +1 damage per different enemy your Strikes have hit this turn (this one included), and apply 1 Shock.',
    effect: {
      strikeBonus: (api, e) => new Set([...api.c.hitThisTurn, e.id]).size,
      onStrikeHit: (api, e) => api.status(e, 'shock', 1),
    },
  },
  {
    id: 'static', patron: 'storm', slot: 'ward', name: 'Static Ward',
    desc: 'Ward gives +1 Block. Enemies whose attack your Ward stops take 5 damage.',
    effect: {
      wardBlock: 1,
      onBlockAbsorbed: (api, a) => {
        api.emit({ t: 'bolt', a: { x: api.c.player.x, y: api.c.player.y }, b: { x: a.x, y: a.y }, color: PATRONS.storm.color });
        api.damage(a, 5, { color: PATRONS.storm.color });
      },
    },
  },
  {
    id: 'thunderring', patron: 'storm', slot: 'sigil', name: 'Thunder Ring',
    desc: 'Sigil: circle enemies to deal 5 and apply 2 Shock. Strikes through it add 1 Shock.',
    effect: { sigil: { damage: 5, status: 'shock', n: 2, carry: { status: 'shock', n: 1 } } },
  },
  {
    id: 'arcnode', patron: 'storm', slot: 'passive', name: 'Arc Node',
    desc: 'Crossings also zap the 2 nearest enemies for 4.',
    effect: {
      onCrossing: (api, at) => {
        const hits = api.living().sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y)).slice(0, 2);
        for (const e of hits) {
          api.emit({ t: 'bolt', a: at, b: { x: e.x, y: e.y }, color: PATRONS.storm.color });
          api.damage(e, 4, { color: PATRONS.storm.color });
        }
      },
    },
  },
  // ---- Scribe (rares) ----
  {
    id: 'deepwell', patron: 'scribe', slot: 'passive', rare: true, name: 'Deep Well',
    desc: '+1 Ink every turn.',
    effect: { inkBonus: 1 },
  },
  {
    id: 'spiral', patron: 'scribe', slot: 'glyph', rare: true, name: 'New Glyph: Spiral',
    desc: 'Draw a spiral: pulls every enemy toward its center and deals 2. Cost 1, cooldown 3.',
    effect: { grantsSpiral: true },
  },
];

export const DUOS: DuoDef[] = [
  {
    id: 'steam', patrons: ['ember', 'frost'], name: 'Steam',
    desc: 'When Burn and Chill meet on an enemy, it explodes: 8 damage to it and 4 to enemies nearby. Both statuses are removed.',
    effect: {
      interceptStatus: (api, e, s) => {
        if (!((s === 'burn' && e.chill > 0) || (s === 'chill' && e.burn > 0))) return false;
        e.burn = 0;
        e.chill = 0;
        api.emit({ t: 'text', x: e.x, y: e.y - e.r - 34, text: 'STEAM!', color: DUO_COLOR, size: 24 });
        api.emit({ t: 'ring', x: e.x, y: e.y, r: 120, color: DUO_COLOR });
        api.emit({ t: 'shake', amount: 10 });
        const others = near(api, e, 150);
        api.damage(e, 8, { color: DUO_COLOR });
        for (const o of others) api.damage(o, 4, { color: DUO_COLOR });
        return true;
      },
    },
  },
  {
    id: 'shatter', patrons: ['frost', 'storm'], name: 'Shatter',
    desc: 'Strikes deal double damage to enemies with 2+ Chill.',
    effect: {
      strikeMult: (api, e) => {
        if (e.chill < 2) return 1;
        api.emit({ t: 'text', x: e.x, y: e.y - e.r - 34, text: 'SHATTER', color: PATRONS.frost.color, size: 16 });
        return 2;
      },
    },
  },
  {
    id: 'wildfire', patrons: ['ember', 'storm'], name: 'Wildfire',
    desc: 'When Shock triggers on a Burning enemy, its Burn spreads to every enemy nearby.',
    effect: {
      onShockTrigger: (api, e) => {
        if (e.burn <= 0) return;
        const b = e.burn;
        api.emit({ t: 'text', x: e.x, y: e.y - e.r - 34, text: 'WILDFIRE', color: PATRONS.ember.color, size: 16 });
        for (const o of near(api, e, 170)) {
          api.status(o, 'burn', b);
          api.emit({ t: 'bolt', a: { x: e.x, y: e.y }, b: { x: o.x, y: o.y }, color: PATRONS.ember.color });
        }
      },
    },
  },
];
