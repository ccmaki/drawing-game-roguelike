import { type Pt, dist } from '../core/vec';
import { randomSeed } from '../core/rng';
import { BOON, BOONS, DUO, DUO_COLOR, DUOS, ENCOUNTER, ENCOUNTERS, HAMMER, HAMMERS, PATRONS, T } from '../content';
import type { HammerDef } from '../content/types';
import { analyze, rawShape } from '../geometry/recognize';
import {
  activeShapeBonuses, canRite, castRite, castStroke, enemyPhase, glyphLabel, inkCost, interpret, living,
  maxInk, refreshEffects, strikeForm, wardForm, type Combat,
} from '../combat';
import { Renderer } from '../render/renderer';
import {
  boonOffers, type BoonOffer, endCombat, enterNode, hammerOffers, newRun, nextChoices, pickBoon, pickHammer,
  rest, type Run, startEncounter,
} from '../run/run';
import type { MapNode, RoomType } from '../run/map';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ICON: Record<RoomType, string> = { fight: '⚔', elite: '☠', calligrapher: '✒', rest: '♨', boss: '◉' };
const ROOM_NAME: Record<RoomType, string> = { fight: 'Fight', elite: 'Elite', calligrapher: 'Calligrapher', rest: 'Rest', boss: 'Boss' };
const SLOTNAME: Record<string, string> = { strike: 'Strike boon', ward: 'Ward boon', sigil: 'Sigil boon', passive: 'Passive', glyph: 'Rare glyph' };
const ENEMY_BEAT_MS = 260;

type Screen = 'map' | 'combat' | 'pick' | 'end';

export class App {
  private run!: Run;
  private screen: Screen = 'map';
  private drawing: Pt[] | null = null;
  private showStats = false;
  private renderer: Renderer;
  private cv = $<HTMLCanvasElement>('cv');

  constructor() {
    this.renderer = new Renderer(this.cv);
    this.bindInput();
    this.buildDebug();
    this.newRun(randomSeed());
    const loop = () => {
      this.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    (window as unknown as { __run: () => Run }).__run = () => this.run;
  }

  private get c(): Combat | null {
    return this.run.combat;
  }

  // ---------------------------------------------------------------- flow

  newRun(seed: number): void {
    this.run = newRun(seed);
    this.renderer.reset();
    this.showMap();
  }

  private showMap(): void {
    this.screen = 'map';
    this.hideModals();
    const box = $('mapBox');
    const { map } = this.run;
    const rows = map.rows.length;
    const pos = (n: MapNode) => ({
      x: ((n.row + 0.5) / rows) * 100,
      y: n.type === 'boss' ? 50 : ((n.col + 0.5) / 4) * 100,
    });
    const reach = new Set(nextChoices(this.run).map((n) => n.id));
    let svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">';
    for (const n of Object.values(map.nodes))
      for (const id of n.next) {
        const a = pos(n);
        const b = pos(map.nodes[id]!);
        const walked = this.run.visited.includes(n.id) && (this.run.visited.includes(id) || reach.has(id));
        svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${walked ? '#f3ead8' : '#5d5346'}" stroke-width="${walked ? 0.6 : 0.35}" stroke-dasharray="${walked ? '' : '1 1'}" vector-effect="non-scaling-stroke" style="stroke-width:${walked ? 3 : 2}px"/>`;
      }
    svg += '</svg>';
    box.innerHTML = svg;
    for (const n of Object.values(map.nodes)) {
      const p = pos(n);
      const b = document.createElement('button');
      b.className = `node${reach.has(n.id) ? ' reach' : ''}${this.run.visited.includes(n.id) ? ' done' : ''}${n.type === 'boss' ? ' boss' : ''}`;
      b.style.left = `${p.x}%`;
      b.style.top = `${p.y}%`;
      b.textContent = ICON[n.type];
      b.title = ROOM_NAME[n.type];
      b.disabled = !reach.has(n.id);
      b.onclick = () => this.enter(n.id);
      box.appendChild(b);
    }
    $('mapModal').classList.add('show');
    this.ui();
  }

  private enter(id: string): void {
    const n = enterNode(this.run, id);
    this.hideModals();
    if (this.run.combat) {
      this.screen = 'combat';
      this.renderer.reset();
    } else if (n.type === 'calligrapher') {
      this.offerHammers('The Calligrapher', 'Choose a Hammer. It changes how a move works.', () => this.showMap());
    } else if (n.type === 'rest') {
      const heal = rest(this.run);
      this.showPick('Rest', `You rest and recover ${heal} HP (${this.run.hp}/${this.run.maxHp}).`, [], 'Continue', () => this.showMap());
    }
    this.ui();
  }

  private onCombatOver(): void {
    const c = this.c!;
    const enc = this.run.encounter;
    const node = this.run.at ? this.run.map.nodes[this.run.at] : null;
    if (c.phase === 'lost') {
      endCombat(this.run);
      this.showPick('Your ink ran dry', `Fell at ${enc?.name ?? 'a fight'}. Seed ${this.run.seed}.`, [], 'New run', () => this.newRun(randomSeed()));
      this.screen = 'end';
      return;
    }
    endCombat(this.run);
    if (node?.type === 'boss') {
      this.showPick('The Blot is erased!', `You won with ${this.run.hp}/${this.run.maxHp} HP. Seed ${this.run.seed}.`, [], 'New run', () => this.newRun(randomSeed()));
      this.screen = 'end';
      return;
    }
    const after = node?.type === 'elite'
      ? () => this.offerHammers('Elite spoils', 'The elite dropped a Hammer.', () => this.showMap())
      : () => this.showMap();
    this.offerBoons(`${enc?.name ?? 'Fight'} cleared`, 'Choose a boon.', after);
  }

  // ---------------------------------------------------------------- pick screens

  private hideModals(): void {
    for (const id of ['mapModal', 'pick']) $(id).classList.remove('show');
  }

  private showPick(title: string, sub: string, cards: HTMLElement[], btn: string, onBtn: (() => void) | null): void {
    this.screen = 'pick';
    this.hideModals();
    $('pickTitle').textContent = title;
    $('pickSub').textContent = sub;
    const box = $('cards');
    box.innerHTML = '';
    for (const c of cards) box.appendChild(c);
    const b = $<HTMLButtonElement>('pickBtn');
    b.textContent = btn;
    b.onclick = onBtn;
    $('pick').classList.add('show');
    this.ui();
  }

  private card(band: string, color: string, name: string, slot: string, desc: string, extra: string, onClick: () => void, duo = false): HTMLElement {
    const el = document.createElement('div');
    el.className = `card${duo ? ' duo' : ''}`;
    el.innerHTML = `<div class="band" style="background:${color}">${band}</div><div class="nm">${name}</div><div class="sl">${slot}</div><div class="ds">${desc}</div>${extra}`;
    el.onclick = onClick;
    return el;
  }

  private offerBoons(title: string, sub: string, then: () => void): void {
    const cards = boonOffers(this.run).map((b: BoonOffer) => {
      const choose = () => {
        pickBoon(this.run.build, b.id);
        then();
      };
      if (b.duo) return this.card(`Duo · ${PATRONS[b.patrons[0]].name} + ${PATRONS[b.patrons[1]].name}`, DUO_COLOR, b.name, 'Duo boon', b.desc, '', choose, true);
      const cur = b.slot === 'strike' || b.slot === 'ward' || b.slot === 'sigil' ? this.run.build.slots[b.slot] : null;
      const rp = cur ? `<div class="rp">Replaces ${BOON[cur]!.name}</div>` : '';
      return this.card(PATRONS[b.patron].name + (b.rare ? ' · rare' : ''), PATRONS[b.patron].color, b.name, SLOTNAME[b.slot]!, b.desc, rp, choose);
    });
    this.showPick(title, sub, cards, cards.length ? '' : 'Continue', cards.length ? null : then);
  }

  private offerHammers(title: string, sub: string, then: () => void): void {
    const offers = hammerOffers(this.run);
    const cards = offers.map((h: HammerDef) => {
      const cur = h.kind === 'shape' ? this.run.build.shape[h.slot] : null;
      const extra = `${h.wants ? `<div class="wn">Wants: ${h.wants}</div>` : ''}${cur ? `<div class="rp">Replaces ${HAMMER[cur]!.name}</div>` : ''}`;
      return this.card(`Hammer · ${h.slot}${h.kind === 'shape' ? ' shape' : ''}`, h.kind === 'shape' ? '#5b4636' : '#7a6a58', h.name, h.kind === 'shape' ? `Changes your ${h.slot}'s shape` : `Tweaks your ${h.slot}`, h.desc, extra, () => {
        pickHammer(this.run.build, h.id);
        then();
      });
    });
    this.showPick(title, sub, cards, cards.length ? 'Skip' : 'Nothing left to forge. Continue', then);
  }

  // ---------------------------------------------------------------- combat input

  private bindInput(): void {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (ev) => {
      if (this.screen !== 'combat' || this.c?.phase !== 'player') return;
      cv.setPointerCapture(ev.pointerId);
      this.drawing = [this.renderer.toField(ev)];
    });
    cv.addEventListener('pointermove', (ev) => {
      if (!this.drawing) return;
      const p = this.renderer.toField(ev);
      if (dist(p, this.drawing[this.drawing.length - 1]!) > 2.5) this.drawing.push(p);
    });
    const up = () => {
      const d = this.drawing;
      this.drawing = null;
      if (!d || !this.c || this.c.phase !== 'player') return;
      castStroke(this.c, d);
      this.afterAction();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => (this.drawing = null));
    $('endBtn').onclick = () => this.endTurn();
    $('riteBtn').onclick = () => this.rite();
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        this.endTurn();
      }
      if (e.key === 'r' || e.key === 'R') this.rite();
    });
  }

  private rite(): void {
    if (this.screen === 'combat' && this.c && castRite(this.c)) this.afterAction();
  }

  private afterAction(): void {
    const c = this.c;
    if (!c) return;
    this.renderer.consume(c);
    this.ui();
    if (c.phase === 'won' || c.phase === 'lost') setTimeout(() => this.onCombatOver(), 800);
  }

  private endTurn(): void {
    const c = this.c;
    if (this.screen !== 'combat' || !c || c.phase !== 'player') return;
    this.drawing = null;
    const g = enemyPhase(c);
    const step = () => {
      const r = g.next();
      this.renderer.consume(c);
      this.ui();
      if (!r.done) setTimeout(step, ENEMY_BEAT_MS);
      else this.afterAction();
    };
    step();
  }

  // ---------------------------------------------------------------- HUD

  private ui(): void {
    const run = this.run;
    const c = this.c;
    const node = run.at ? run.map.nodes[run.at] : null;
    const room = node ? `Room ${node.row + 1}/${run.map.rows.length} · ${ROOM_NAME[node.type]}` : 'Start';
    $('status').textContent = `${room}${c && run.encounter ? ` · ${run.encounter.name} · Turn ${c.turn}` : ''} · HP ${c ? c.player.hp : run.hp}/${run.maxHp} · seed ${run.seed}`;

    const b = run.build;
    const sForm = strikeForm(b);
    const wForm = wardForm(b);
    const hasSpiral = b.boons.has('spiral');
    if (c) {
      const max = maxInk(c);
      let ph = '';
      for (let i = 0; i < Math.max(max, c.ink); i++) ph += `<span class="pip ${i < c.ink ? 'on' : ''}"></span> `;
      $('pips').innerHTML = ph;
    } else $('pips').innerHTML = '';
    const chip = (name: string, cost: string, cls = '') => `<div class="chip ${cls}"><span class="n">${name}</span> <span class="c">${cost}</span></div>`;
    const cost = (g: 'strike' | 'ward' | 'sigil' | 'spiral') => (c ? `cost ${inkCost(c, g)}` : `cost ${T.cost[g]}`);
    const FN = { line: '— Line', zigzag: '⚡ Zigzag', curve: '∿ Curve', stab: '↣ Stab' } as const;
    $('chips').innerHTML =
      chip(`Strike: ${FN[sForm]}`, cost('strike')) +
      chip(`Ward: ${wForm === 'wall' ? '▮ Wall' : '◯ Circle'}`, cost('ward')) +
      chip('◎ Sigil', b.slots.sigil ? cost('sigil') : 'locked', b.slots.sigil ? '' : 'locked') +
      (hasSpiral ? chip('@ Spiral', c && c.cd.spiral > 0 ? `cd ${c.cd.spiral}` : cost('spiral'), c && c.cd.spiral > 0 ? 'cd' : '') : '');
    const rb = $<HTMLButtonElement>('riteBtn');
    rb.disabled = !c || this.screen !== 'combat' || !canRite(c);
    rb.textContent = c && c.cd.rite > 0 ? `Rite: Inkstorm (cd ${c.cd.rite})` : `Rite: Inkstorm (${T.rite.cost} ink · ${T.rite.damage} to all)`;
    $<HTMLButtonElement>('endBtn').disabled = !c || this.screen !== 'combat' || c.phase !== 'player';

    const STRIKE_HELP = {
      line: '<b>Line</b> through enemies → <b>Strike</b> 6 dmg each.',
      zigzag: '<b>Zigzag</b> → <b>Strike</b>: 4 to enemies touched, each corner jumps 6 to the nearest other enemy near it. Spread targets = more jumps.',
      curve: '<b>Any open stroke</b> → <b>Curve Strike</b>: 3 to enemies touched + an ink trail for 2 turns (5 to enemies that move through it, 2 to ones standing in it).',
      stab: '<b>Short straight stroke</b> → <b>Stab</b>: hits only the first enemy. 14 at ≤80px, down to 6 at 250px+.',
    };
    const WARD_HELP = {
      circle: '<b>Circle around yourself</b> → <b>Ward</b> 6 Block.',
      wall: '<b>Stroke on your side of the dashed line, across an attacker’s path</b> (touching no enemy) → <b>Wall</b>: fully blocks the hardest-hitting attacker it crosses.',
    };
    $('help').innerHTML = `${STRIKE_HELP[sForm]}<br>${WARD_HELP[wForm]}<br>
      <b>Circle around enemies</b> → <b>Sigil</b> (needs a Sigil boon).${hasSpiral ? ' <b>Spiral</b> → pull enemies together.' : ''}<br>
      <b>Cross two Strikes</b> (or a Strike and a trail) → burst (free combo).<br>
      <b>Strike starting from your Ward/Wall</b> → +2 dmg. <b>Strike through your Sigil</b> → carries its element.<br>
      Using the same glyph again in a turn costs <b>+1 ink</b>. Enemy intents show above their heads. A grey arc = front guard: hit it from above, below or behind.<br>
      <span class="muted"><span style="color:${PATRONS.ember.color}">● Burn</span> deals its stacks each turn · <span style="color:${PATRONS.frost.color}">● Chill</span> −1 enemy dmg per stack · <span style="color:${PATRONS.storm.color}">● Shock</span> next hit +3</span>`;

    const line = (color: string, name: string, kind: string, desc: string) =>
      `<div class="boon"><span class="dot" style="background:${color}"></span><b>${name}</b> <span class="muted">(${kind})</span> — ${desc}</div>`;
    const parts: string[] = [];
    for (const id of b.boons) {
      const bd = BOON[id];
      const dd = DUO[id];
      if (bd) parts.push(line(PATRONS[bd.patron].color, bd.name, SLOTNAME[bd.slot]!, bd.desc));
      else if (dd) parts.push(line(DUO_COLOR, dd.name, 'Duo', dd.desc));
    }
    for (const id of b.hammers) {
      const h = HAMMER[id]!;
      parts.push(line('#a08a6e', h.name, `${h.slot} ${h.kind === 'shape' ? 'shape Hammer' : 'Hammer'}`, h.desc));
    }
    for (const sb of activeShapeBonuses(b)) parts.push(line(PATRONS[sb.patron].color, `★ ${sb.name}`, 'patron/shape bonus', sb.desc));
    $('build').innerHTML = parts.join('') || '<span class="muted">Nothing yet. Win a fight for a boon; visit a Calligrapher for a Hammer.</span>';
    const pc = (p: string) => [...b.boons].some((id) => BOON[id]?.patron === p);
    $('duos').innerHTML = DUOS.map((d) => {
      const got = b.boons.has(d.id);
      const ok = d.patrons.every(pc);
      return `<div class="boon"><span class="dot" style="background:${DUO_COLOR}"></span><b>${d.name}</b> <span class="muted">needs ${PATRONS[d.patrons[0]].name} + ${PATRONS[d.patrons[1]].name}</span> ${got ? '<span class="ok">✓ owned</span>' : ok ? '<span class="ok">can appear</span>' : ''}</div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- frame

  private frame(): void {
    const c = this.screen === 'combat' || this.screen === 'pick' || this.screen === 'end' ? this.c : null;
    let preview: string | null = null;
    let debugText: string | null = null;
    if (c && this.drawing && this.drawing.length > 6) {
      const it = interpret(c, this.drawing);
      preview = it.ok ? glyphLabel(it) : null;
      if (this.showStats) {
        const a = analyze(this.drawing);
        if (a)
          debugText = `raw=${rawShape(a)}  len=${a.length.toFixed(0)}  straight=${a.straightness.toFixed(2)}  turn=${(a.turning / Math.PI).toFixed(2)}π\ncorners=${a.corners.length}  closed=${a.closed}  → ${it.ok ? glyphLabel(it) : it.msg}`;
      }
    }
    const first = c && this.run.visited.length === 1 && c.turn <= 2 && c.phase === 'player';
    this.renderer.frame({
      combat: c,
      drawing: this.drawing,
      preview,
      debugText,
      hint: first ? 'Draw a line through enemies to Strike · a circle around yourself to Ward · then End turn' : null,
    });
  }

  // ---------------------------------------------------------------- playtest tools

  private buildDebug(): void {
    const body = $('debugBody');
    const opt = (v: string, t: string) => `<option value="${v}">${t}</option>`;
    body.innerHTML = `
      <div class="row"><input id="dbSeed" size="10" placeholder="seed"><button id="dbNew">New run with seed</button></div>
      <div class="row"><select id="dbBoon">${[...BOONS, ...DUOS].map((b) => opt(b.id, b.name)).join('')}</select><button id="dbBoonBtn">Grant boon</button></div>
      <div class="row"><select id="dbHammer">${HAMMERS.map((h) => opt(h.id, `${h.name} (${h.slot})`)).join('')}</select><button id="dbHammerBtn">Grant Hammer</button></div>
      <div class="row"><select id="dbEnc">${ENCOUNTERS.map((e) => opt(e.id, `${e.kind}: ${e.name}`)).join('')}</select><button id="dbEncBtn">Fight it now</button></div>
      <div class="row"><button id="dbHeal">Full heal</button><button id="dbInk">+3 ink</button><button id="dbKill">Kill all</button><button id="dbMap">Back to map</button></div>
      <label class="row"><input type="checkbox" id="dbStats"> show recognition stats while drawing</label>
      <div class="muted" id="dbNote" style="flex-basis:100%"></div>`;
    $('dbNew').onclick = () => {
      const s = Number($<HTMLInputElement>('dbSeed').value);
      this.newRun(Number.isFinite(s) && s > 0 ? s : randomSeed());
    };
    const regrant = () => {
      if (this.c) refreshEffects(this.c);
      this.ui();
    };
    $('dbBoonBtn').onclick = () => {
      pickBoon(this.run.build, $<HTMLSelectElement>('dbBoon').value);
      regrant();
    };
    $('dbHammerBtn').onclick = () => {
      pickHammer(this.run.build, $<HTMLSelectElement>('dbHammer').value);
      regrant();
    };
    const encSel = $<HTMLSelectElement>('dbEnc');
    const note = () => ($('dbNote').textContent = `Pushback: ${ENCOUNTER[encSel.value]?.pushback ?? ''}`);
    encSel.onchange = note;
    note();
    $('dbEncBtn').onclick = () => {
      if (this.c) endCombat(this.run);
      startEncounter(this.run, ENCOUNTER[encSel.value]!);
      this.hideModals();
      this.screen = 'combat';
      this.renderer.reset();
      this.ui();
    };
    $('dbHeal').onclick = () => {
      this.run.hp = this.run.maxHp;
      if (this.c) this.c.player.hp = this.c.player.maxHp;
      this.ui();
    };
    $('dbInk').onclick = () => {
      if (this.c) this.c.ink += 3;
      this.ui();
    };
    $('dbKill').onclick = () => {
      const c = this.c;
      if (!c || (c.phase !== 'player' && c.phase !== 'enemy')) return;
      for (const e of living(c)) c.api.damage(e, 9999, { raw: true });
      c.phase = 'won';
      this.afterAction();
    };
    $('dbMap').onclick = () => {
      if (this.c) endCombat(this.run);
      this.showMap();
    };
    $<HTMLInputElement>('dbStats').onchange = (e) => (this.showStats = (e.target as HTMLInputElement).checked);
  }
}
