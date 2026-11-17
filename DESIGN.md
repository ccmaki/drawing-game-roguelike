# Sigilfall — Design Doc

A turn-based roguelike where you **draw your spells directly on the battlefield**.
Combat is shaped like Slay the Spire, and the build system is shaped like Hades.

## Pillars

1. **Where you draw matters.** A spell's power comes from where the stroke goes, what it passes through and what it crosses. It is not a gesture password.
2. **Builds come from combining things, not adding them.** Boons change how your moves behave, so two runs with the same moves can play completely differently. This is the main fix for the "Slay the Spire 2 gets linear" problem.
3. **Planning, not precision.** Shape recognition is forgiving. Difficulty comes from deciding what to draw and where, never from drawing perfectly.

## Decision log

| # | Area | Decision | Why |
|---|------|----------|-----|
| 1 | Combat | Turn-based, Slay the Spire style: enemy intents shown ahead of time, block vs. attack each turn | Drawing while moving in real time fought against itself |
| 2 | Casting | Draw directly on the battlefield. **No** separate drawing pad with targeting | A separate pad turns shapes into buttons and loses the spatial combos |
| 3 | Resource | **Ink** is the energy: 3 per turn. Glyphs cost 1–2. Repeating a glyph in the same turn costs +1 | Pushes you to mix glyphs without forcing you to |
| 4 | Glyph availability | Every unlocked glyph is always available, with no random hand | Hades-like: your moves are always there, and variety comes from boons and enemies |
| 5 | Slots | **Strike** (attack), **Ward** (block), **Sigil** (special, locked until a boon unlocks it), **Rite** (ultimate with a cooldown) | Maps onto Hades's attack, dash, special and call |
| 6 | Patron boons | Add elements and statuses to a slot. One patron per slot, so a new pick replaces the old one. Written to work on **any** shape | Keeps element separate from shape |
| 7 | Hammers | Change a glyph's **shape** and rules (Strike becomes a Zigzag, Loop, Stab…). **At most one shape-changing Hammer per slot.** Smaller Hammers tweak behavior without changing the shape | Shape × element = many builds. The patron boon alone forcing a shape would give only about 3 fixed playstyles |
| 8 | Patron/shape bonus | A patron gets a bonus effect when its element matches a fitting shape (Storm + Zigzag = an extra jump) | Keeps the flavor without forcing the shape |
| 9 | Duo boons | Need at least one boon from each of the two patrons, and then you still have to pick the duo boon when it's offered | Prerequisites make duos feel earned |
| 10 | Combos | **Spatial combos** are built in and free (crossing strokes, a line leaving your Ward, a line passing through your Sigil). **Status reactions** come from duo boons. **No order-based combos** | Order combos turn into a memorized rotation when glyphs are always available |
| 11 | Combo cost | Spatial combos cost no extra ink and have no cooldown | You already paid for the strokes, and geometry is the limit |
| 12 | Rare glyphs | New glyph shapes (Zigzag, Spiral…) are rare picks with cooldowns. *Zigzag part superseded by #17* | They stay special without crowding your turn |
| 13 | Enemies | Need formations and behaviors that push back against each shape (spread out, bunched up, shielded, moving) | Otherwise one shape is always best, and that's linear again |
| 14 | Run structure | Branching map with **Fight**, **Elite**, **Calligrapher** (Hammer shop/pick), **Rest** and **Boss** rooms. A Hammer is guaranteed to be available in the first few rooms | Room choice adds replay value and lets you steer your build |
| 15 | Stack / process | Prototype only. TypeScript + Vite + Canvas 2D, no engine. The build is **one self-contained HTML file**, played through a private claude.ai artifact (no GitHub Pages). Game logic is kept free of DOM/canvas so it can move to an engine later | The goal now is finding the fun, not building an app. An engine choice can wait until the game is worth building |
| 16 | Hammers | A shape Hammer **replaces** its slot's default shape. With Zigzag, a straight line no longer casts Strike. With Wall, a circle around yourself no longer casts Ward | Forces a different battlefield. Recognition only has to tell apart the shapes you own, so it gets more forgiving (pillar 3) |
| 17 | Glyphs | Zigzag is a Strike Hammer only. The rare Zigzag glyph is removed. Spiral stays as the one rare glyph | Two versions of the same shape would blur what Hammers do |
| 18 | Shapes | "Loop / Curve" becomes **Curve**: any open stroke. 3 dmg to enemies touched, plus an ink trail lasting 2 enemy turns. Enemies **moving through** it take 5, enemies **standing in** it at the end of their action take 2 (once per enemy per enemy turn) | A closed loop can't be told apart from the Ward/Sigil circle. The trail only pays off against movement, which is the zoning role |
| 19 | Shapes | **Stab** hits only the first enemy the stroke touches. Damage falls with stroke length: 14 at ≤80px down to 6 at ≥250px | Rewards precision and focusing one target |
| 20 | Shapes | **Wall** (Ward Hammer): an open stroke that touches no enemy and crosses an attacker's straight path to you. It fully blocks that attacker for this enemy turn. If it crosses several paths, it blocks the hardest hitter. Ward boons' flat Block bonuses still apply as Block. Replaces the Ward circle | Strong against one big attacker, weak against many or flanking ones |
| 21 | Shapes | Walls must be drawn on **your side** of the field (left of x=400, shown as a dashed line). *(provisional, needs review)* | Found in browser testing: with Curve + Wall, a zoning trail in front of enemies (touching none) became a Wall. That's exactly how Curve is meant to be used |
| 22 | Ink | Shape-changed Strikes cost 1 ink with no cooldown. The +1 repeat rule counts per glyph (Strike, Ward, Sigil, Spiral), not per shape | A Hammer changes how your Strike works, not how often you can use it |
| 23 | Combos | Every Strike shape can cross other Strikes and get infused by the Sigil. "Starting inside your Ward" also counts starting within 30px of a Wall. Live Curve trails count as crossable lines | Keeps spatial combos working whatever your shapes |
| 24 | Hammers | Shape details *(provisional, needs review)*: Zigzag body 4, each corner jumps 6 to the nearest enemy within 150px of that corner that this Zigzag hasn't hit. Max 3 jumps, and corners that find nobody don't use one up. Each enemy is hit once per Zigzag | "Each corner jumps to a target" only wants spread enemies if corners have a reach and enemies can't be hit twice |
| 25 | Hammers | Tweak Hammers (stack, never change shape): **Heavy Nib** (+3 per Strike hit, second Strike costs +2 extra instead of +1), **Wide Nib** (+14px hit reach), **Echo** (first Strike each turn re-hits every enemy it damaged at half damage, no on-hit effects), **Wet Ink** (if nothing hit your Block during the enemy turn, half of it carries over), **Long Reach** (needs Wall: blocks a second attacker whose path passes within 40px). A new shape Hammer replaces the old one in that slot, and tweaks that required the old shape are lost | Small, readable changes that combine with shapes rather than add raw stats |
| 26 | Patron boons | Rewritten against "Strike hit", "Ward", "block absorbed" and similar hooks, never a shape. **Arc Stroke** becomes +1 dmg per different enemy your Strikes have hit this turn, this one included, plus 1 Shock. **Glacial Ward** becomes "Strikes that start from your Ward apply 2 Chill". **Shatter** applies to Strikes | Decision 6: patrons must work on any shape |
| 27 | Patron/shape bonus | **Storm + Zigzag**: +1 jump. **Ember + Curve**: the trail lasts +1 turn and applies 2 Burn when it hurts. **Frost + Wall**: blocked attackers gain 2 Chill. **Storm + Stab**: a Stab consumes all Shock on its target, +6 per stack. Active when the slot's patron boon and shape match. Line and Circle get none | Decision 8, one fitting pair per new shape |
| 28 | Enemies | Enemies use free positions and **move** (no fixed rows). New enemies: **Mite** (tiny, bunched: punishes Stab), **Skitter** (scatters away from allies: punishes Line), **Charger** (runs at you: rewards Curve), **Flanker** (moves above or below you: punishes Wall), **Shieldbearer** (deflects Strikes coming from the 120° arc facing you, so you hit it from above, below or behind. Crossings, statuses, Sigil and Rite are not deflected), **Hulk** (one huge target: rewards Stab and Wall) | Decision 13. Playtesting showed enemies "stand still and let you line them up" |
| 29 | Run structure | One act: 8 rows plus the boss, 2–4 rooms per row, no crossing paths. Row 1 is all Fights. **Every path meets a Calligrapher in room 2 or 3.** Elites appear from room 4. The last row before the boss is all Rest | Decision 14 with concrete numbers. The guaranteed Calligrapher gets a Hammer into every run early |
| 30 | Rewards | Fight: pick 1 of 3 boons. Elite: a boon, then a Hammer pick. Calligrapher: pick 1 of 3 Hammers (at most 2 shape Hammers per offer, skip allowed), no currency. Rest: heal 30% of max HP. The automatic +10 heal between fights is removed | Healing becomes a route choice. There's no currency yet, so no shop |

## Shape design rule

**Every shape has to want a different battlefield.** If every shape still wants enemies lined up, the change is only cosmetic.

Example Strike Hammers:
- **Zigzag**: each corner jumps to a target, so it wants enemies **spread out**.
- **Loop / Curve**: leaves a lingering trail (fire, etc.) that hurts enemies standing in or walking through it. It rewards **zoning and cutting off paths**.
- **Stab**: a short stroke that hits one target hard, and longer strokes do less damage. It rewards **precision and focusing one enemy**.

Example Ward Hammer:
- **Wall**: draw a barrier between you and one attacker in place of a circle around yourself.

Current shapes (v1):

| Slot | Shape | Wants | Pushed back by |
|------|-------|-------|----------------|
| Strike | Line (default) | Enemies lined up | Skitters (spread out), Shieldbearer (head-on lines bounce off), Quillshots (reposition) |
| Strike | Zigzag | Enemies spread out, one corner near each | Bunched groups: a Line does more total |
| Strike | Curve | Enemies that move: cut off their path | Enemies that stand still take only 2 per turn |
| Strike | Stab | One target worth focusing | Mite swarms, summons |
| Ward | Circle (default) | Steady damage from several enemies | Big single hits |
| Ward | Wall | One big attacker | Flankers, several attackers at once |

## Current prototype (v1), `src/`

TypeScript modules built into one HTML file (see CLAUDE.md). Everything from v0 below is kept unless a later decision changed it, plus:
- **Hammers** (#16–#25): Zigzag, Curve and Stab Strikes, the Wall Ward, five tweak Hammers.
- **Shape-agnostic patron boons** and **patron/shape bonuses** (#26–#27).
- **Moving enemies and formations** that push back against each shape (#28). Each encounter's data has a `pushback` note.
- **Branching map** with Fight, Elite, Calligrapher, Rest and Boss rooms (#29–#30).
- **Playtest tools** under the game: set the seed, grant any boon or Hammer, start any encounter, heal, add ink, kill all, show recognition stats while drawing.
- Recognition change: corner detection samples at least 8px apart, so hand jitter on short strokes isn't read as corners (a short shaky line used to read as a zigzag, which would have broken Stab).

## v0 prototype, `prototype/index.html`

One HTML file using canvas, with no build step. Contents:
- **Glyphs:** Line = Strike (6 dmg to every enemy it passes through). Circle around yourself = Ward (6 block). Circle around enemies = Sigil (needs a boon). Zigzag and Spiral are rare unlocks with cooldowns. Rite is a button: Inkstorm, 7 damage to all enemies, costs 2 ink, cooldown 3.
- **Shape recognition:** resample the stroke to 64 points, then use straightness, total turning angle, whether the stroke closes, and corner count.
- **Spatial combos:** crossing lines burst for 3 damage. A line starting inside your Ward gets +2 damage. A line passing through your Sigil picks up its element.
- **Statuses:** Burn deals damage equal to its stacks each turn, then drops by 1. Chill gives −1 enemy damage per stack and fades by 1 per turn. Shock adds +3 to the next hit.
- **Patrons:** Ember, Frost and Storm, each with a Strike, Ward, Sigil and passive boon. Scribe offers the rares (Deep Well +1 ink, the Zigzag glyph, the Spiral glyph).
- **Duo boons:** Steam (Ember + Frost), Shatter (Frost + Storm), Wildfire (Ember + Storm).
- **Enemies:** Inkling, Bulwark, Quillshot (moves between rows), Warden (shields its allies) and The Blot (boss that summons).
- **Run:** a fixed sequence of 5 fights, picking 1 of 3 boons after each, with a +10 heal between fights.

### What playtesting showed
- Overall it works, but it's **too linear**: Ward plus one straight line through everything solves almost every turn.
- Boons are mostly additive (they stack effects onto the same move), so builds don't change how you play.
- The enemies basically stand still and let you line them up.

## Next steps
1. ~~Hammers and the Calligrapher room~~ (v1)
2. ~~Branching map~~ (v1)
3. ~~Shape-agnostic patron boons and patron/shape bonuses~~ (v1)
4. ~~Enemy formations and behaviors that push back against each shape~~ (v1)
5. **Playtest v1.** Main questions: does each shape actually feel like it wants a different battlefield? Is Line + Ward still the answer to everything? Are the Wall's "your side" rule and the Curve trail readable?
6. Rebalance after playtesting. All provisional numbers are in `src/content/tuning.ts` and the content files.

## Open questions
- What exactly does the Rite do, and should it be drawn rather than pressed as a button?
- Does Sigil also get shape Hammers, or only Strike and Ward?
- Meta-progression between runs (a Hades-style mirror or unlocks)?
- Engine for the real version. The prototype stays engine-free for now (#15). Decide once the game feels worth building. Retest how drawing *feels* (input sampling, touch latency) on the target engine and device.
- Should Sigil and Rite get shape Hammers too?
- Should the Calligrapher become a shop once there's a currency?
