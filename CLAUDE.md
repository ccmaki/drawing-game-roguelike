# Sigilfall: working notes for Claude

Turn-based roguelike where you draw spells on the battlefield. **DESIGN.md is the source of truth**
for design: pillars, decision log, shape rule, what playtesting showed. Read it before changing mechanics.

This is a **prototype**, not a product. The goal is finding out whether the drawing combat is fun.
No app polish (menus, saves, accessibility, responsive tuning) unless asked. An engine may come later,
so keep game logic engine-free.

## The design rules

- **Whenever we make a design decision, add it to the decision log in DESIGN.md with the reason.**
  Next number, area, the decision, and *why*. If a later decision replaces an earlier one, update
  the old row to say "superseded by #N", not delete it.
- **Don't make design decisions silently.** Ask, or list them for approval. If implementation forces
  a call that wasn't discussed (an edge case, a number, a conflict between two mechanics), make the
  smallest reasonable call, log it with "(provisional, needs review)", and call it out to the user.
- New shapes must follow the **shape design rule**: every shape wants a different battlefield, and some
  formation should push back against it. Update the shape table in DESIGN.md.
- Balance numbers live in `src/content/tuning.ts` (or the content data files). Numbers ported from the
  v0 prototype are marked `(v0)`. Everything else is provisional until playtested.

## Commands

```bash
npm install
npm test            # vitest: recognition, combat, map/run, content integrity
npm run typecheck
npm run build       # → dist/index.html, ONE self-contained file (no external assets)
npm run dev         # local dev server (the user can't run this; it's for you)
```

Always run `npm test` and `npm run build` before committing.

## How the user plays it

The user can't run the game locally. After a build, publish `dist/index.html` as a claude.ai
**artifact** and update the same artifact each version so the link stays stable. There is no
GitHub Pages deploy (decision #15).

You can drive the built page yourself with Playwright (pre-installed) to check that things work in
a real browser. `window.__run()` exposes the run state, and the "Playtest tools" panel under the
game can grant boons/Hammers, start any encounter and show recognition stats.

## Code layout

```
src/
  core/        vec math, seeded Rng (ALL randomness goes through Rng)
  geometry/    stroke helpers + raw shape recognition (line/circle/zigzag/spiral/open)
  combat/      pure combat logic, no DOM or canvas
    state.ts     types: Combat, Enemy, Build, Effect (the boon/Hammer hook interface)
    interpret.ts what a stroke casts, given the build's shapes
    cast.ts      Strike forms, Ward/Wall, Sigil, Spiral, Rite, crossings, turn start
    enemyTurn.ts enemy turn as a generator (each yield = one animation beat)
    effects.ts   collects active effects from boons, duos, Hammers, patron/shape bonuses
  content/     DATA: boons, duos, hammers (+ shape bonuses), enemies, encounters, tuning
  run/         map generation, run flow, boon/Hammer offers
  render/      canvas renderer (reads state, turns GameEvents into effects)
  ui/          DOM: HUD, map, pick screens, playtest tools
tests/         vitest, no browser needed
prototype/     v0 single-file prototype: reference only, don't edit
```

## Conventions

- **Combat logic stays pure.** `combat/`, `geometry/`, `run/` never touch the DOM, canvas or
  `Math.random`. They push presentation `GameEvent`s to `combat.events`, and the renderer consumes them.
  That's what makes the logic testable and portable to an engine.
- **Content is data.** A new boon, Hammer, enemy or formation should normally be one entry in
  `src/content/`. Boons and Hammers use the `Effect` interface: summed numbers, flags, or hooks
  (`onStrikeHit`, `onBlockAbsorbed`, ...). Hooks get an `Api` object; content files only import types
  from combat. If an effect needs a new hook, add it to `Effect` in `combat/state.ts` and call it from
  the engine. Don't special-case boon ids in engine code.
- Boons are written against "Strike hit", "Ward", "block absorbed" etc., never a specific shape
  (decision 6).
- Add or extend tests for every mechanic change. Combat tests use `fight()` from `tests/helpers.ts`
  with exact enemy positions and synthetic strokes (`line`, `circle`, `polyline`, `arc`, `spiral`).
- TypeScript strict. Keep the build a single HTML file (vite-plugin-singlefile). Don't add runtime
  dependencies without asking.
