import type { Pt } from '../core/vec';

/**
 * Presentation events. Combat logic only pushes these; the renderer turns them
 * into floating text, rings, bolts and shakes. Keeping them as data is what lets
 * the logic run (and be tested) without a canvas.
 */
export type GameEvent =
  | { t: 'text'; x: number; y: number; text: string; color: string; size: number }
  | { t: 'ring'; x: number; y: number; r: number; color: string }
  | { t: 'bolt'; a: Pt; b: Pt; color: string }
  | { t: 'hit'; id: number; amount: number; color: string }
  | { t: 'death'; id: number }
  | { t: 'lunge'; id: number }
  | { t: 'playerHit'; amount: number }
  | { t: 'ghost'; pts: Pt[]; color: string }
  | { t: 'shake'; amount: number };
