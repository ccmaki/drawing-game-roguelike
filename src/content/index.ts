import { BOONS, DUOS } from './boons';
import { ENCOUNTERS } from './enemies';
import { HAMMERS, SHAPE_BONUSES } from './hammers';
import type { BoonDef, DuoDef, EncounterDef, HammerDef } from './types';

export { BOONS, DUOS, PATRONS, DUO_COLOR } from './boons';
export { HAMMERS, SHAPE_BONUSES } from './hammers';
export { ENEMIES, ENCOUNTERS } from './enemies';
export { FIELD, T } from './tuning';
export type * from './types';

const byId = <V extends { id: string }>(list: V[]): Record<string, V> => Object.fromEntries(list.map((v) => [v.id, v]));

export const BOON: Record<string, BoonDef> = byId(BOONS);
export const DUO: Record<string, DuoDef> = byId(DUOS);
export const HAMMER: Record<string, HammerDef> = byId(HAMMERS);
export const ENCOUNTER: Record<string, EncounterDef> = byId(ENCOUNTERS);
export const SHAPE_BONUS = byId(SHAPE_BONUSES);
