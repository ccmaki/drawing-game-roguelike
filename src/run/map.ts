import type { Rng } from '../core/rng';

export type RoomType = 'fight' | 'elite' | 'calligrapher' | 'rest' | 'boss';

export interface MapNode {
  id: string;
  row: number;
  col: number;
  type: RoomType;
  next: string[];
}

export interface GameMap {
  rows: MapNode[][];
  nodes: Record<string, MapNode>;
  bossId: string;
}

/** Map shape (decision 18). Rows are 0-based; the boss sits after the last row. */
export const MAP_CFG = {
  rows: 8,
  cols: 4,
  paths: 4,
  /** Every path meets a Calligrapher on one of these rows (rooms 2–3). */
  calligrapherRows: [1, 2] as const,
  row1CalligrapherChance: 0.4,
  eliteFromRow: 3,
  weights: { fight: 50, elite: 22, calligrapher: 14, rest: 14 } as Record<Exclude<RoomType, 'boss'>, number>,
};

const nid = (row: number, col: number) => `${row}:${col}`;

function weighted<K extends string>(rng: Rng, w: Record<K, number>): K {
  const entries = Object.entries(w) as [K, number][];
  let r = rng.next() * entries.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of entries) if ((r -= v) < 0) return k;
  return entries[0]![0];
}

export function generateMap(rng: Rng): GameMap {
  const { rows, cols, paths } = MAP_CFG;
  const nodes: Record<string, MapNode> = {};
  const edges = new Set<string>(); // "row:a>b" from row to row+1
  const node = (row: number, col: number): MapNode =>
    (nodes[nid(row, col)] ??= { id: nid(row, col), row, col, type: 'fight', next: [] });

  const starts: number[] = [];
  for (let p = 0; p < paths; p++) {
    let s = rng.int(cols);
    if (p === 1) while (s === starts[0]) s = rng.int(cols);
    starts.push(s);
  }

  for (const start of starts) {
    let col = start;
    node(0, col);
    for (let row = 0; row < rows - 1; row++) {
      const opts = rng.shuffle([col - 1, col, col + 1].filter((n) => n >= 0 && n < cols));
      // Never cross an existing edge in this row (straight down never crosses).
      const crosses = (to: number) =>
        [...edges].some((e) => {
          const [r, ab] = e.split(':');
          if (Number(r) !== row) return false;
          const [a, b] = ab!.split('>').map(Number) as [number, number];
          return (a < col && b > to) || (a > col && b < to);
        });
      const to = opts.find((o) => !crosses(o)) ?? col;
      edges.add(`${row}:${col}>${to}`);
      const from = node(row, col);
      const nx = node(row + 1, to);
      if (!from.next.includes(nx.id)) from.next.push(nx.id);
      col = to;
    }
  }

  const boss: MapNode = { id: 'boss', row: rows, col: 0, type: 'boss', next: [] };
  nodes[boss.id] = boss;
  const rowList: MapNode[][] = [];
  for (let r = 0; r < rows; r++)
    rowList.push(Object.values(nodes).filter((n) => n.row === r).sort((a, b) => a.col - b.col));
  for (const n of rowList[rows - 1]!) n.next = [boss.id];
  rowList.push([boss]);

  // Room types.
  const parents = (n: MapNode) => Object.values(nodes).filter((p) => p.next.includes(n.id));
  const [c1, c2] = MAP_CFG.calligrapherRows;
  for (const n of rowList[0]!) n.type = 'fight';
  for (const n of rowList[c1]!) n.type = rng.chance(MAP_CFG.row1CalligrapherChance) ? 'calligrapher' : 'fight';
  for (const n of rowList[c2]!)
    n.type = parents(n).some((p) => p.type !== 'calligrapher') ? 'calligrapher' : rng.chance(0.5) ? 'rest' : 'fight';
  for (let r = c2 + 1; r < rows - 1; r++)
    for (const n of rowList[r]!) {
      const w = { ...MAP_CFG.weights };
      if (r < MAP_CFG.eliteFromRow) w.elite = 0;
      n.type = weighted(rng, w);
    }
  for (const n of rowList[rows - 1]!) n.type = 'rest';

  return { rows: rowList, nodes, bossId: boss.id };
}

/** Every path from a row-0 node to the boss (for tests). */
export function allPaths(map: GameMap): MapNode[][] {
  const out: MapNode[][] = [];
  const walk = (n: MapNode, acc: MapNode[]) => {
    const path = [...acc, n];
    if (!n.next.length) out.push(path);
    for (const id of n.next) walk(map.nodes[id]!, path);
  };
  for (const n of map.rows[0]!) walk(n, []);
  return out;
}
