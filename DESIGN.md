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
| 12 | Rare glyphs | New glyph shapes (Zigzag, Spiral…) are rare picks with cooldowns | They stay special without crowding your turn |
| 13 | Enemies | Need formations and behaviors that push back against each shape (spread out, bunched up, shielded, moving) | Otherwise one shape is always best, and that's linear again |
| 14 | Run structure | Branching map with **Fight**, **Elite**, **Calligrapher** (Hammer shop/pick), **Rest** and **Boss** rooms. A Hammer is guaranteed to be available in the first few rooms | Room choice adds replay value and lets you steer your build |

## Shape design rule

**Every shape has to want a different battlefield.** If every shape still wants enemies lined up, the change is only cosmetic.

Example Strike Hammers:
- **Zigzag**: each corner jumps to a target, so it wants enemies **spread out**.
- **Loop / Curve**: leaves a lingering trail (fire, etc.) that hurts enemies standing in or walking through it. It rewards **zoning and cutting off paths**.
- **Stab**: a short stroke that hits one target hard, and longer strokes do less damage. It rewards **precision and focusing one enemy**.

Example Ward Hammer:
- **Wall**: draw a barrier between you and one attacker in place of a circle around yourself.

## Current prototype (v0), `prototype/index.html`

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
1. Hammers (shape-changing Strike and Ward Hammers, plus a few small tweak Hammers) and the Calligrapher room.
2. Branching map with the room types from decision 14.
3. Rewrite patron boons to be shape-agnostic, and add the patron/shape bonuses.
4. Enemy formations and behaviors that push back against each shape.
5. Rebalance after playtesting.

## Open questions
- What exactly does the Rite do, and should it be drawn rather than pressed as a button?
- Does Sigil also get shape Hammers, or only Strike and Ward?
- Meta-progression between runs (a Hades-style mirror or unlocks)?
- Engine/stack for the real version (start: TypeScript + Vite + Canvas 2D).
