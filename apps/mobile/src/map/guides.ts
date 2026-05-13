// Rail connectors as per-row guide segments (DESIGN.md Components, "Rail row
// and connectors"): no SVG and no measuring, each row draws its own pieces and
// they stretch with the row.
//   start   in the parent's row, from under its tile to the row's bottom
//   through a full-height line in rows between a parent and a later child
//   end     from the child's row top to its tile's centre, then the elbow
export type GuideKind = 'start' | 'through' | 'end';

export interface Guide {
  /** The parent's depth: the guide runs down that tile column. */
  column: number;
  kind: GuideKind;
  /** The parent is Learned: drawn solid in `proven`, else dashed. */
  lit: boolean;
}

export interface GuideRow {
  conceptId: string;
  depth: number;
  parentId: string | null;
}

export function railGuides(rows: GuideRow[], isLit: (conceptId: string) => boolean): Guide[][] {
  const out: Guide[][] = rows.map(() => []);
  const index = new Map(rows.map((r, i) => [r.conceptId, i]));
  const add = (i: number, g: Guide) => {
    const list = out[i]!;
    const same = list.find((x) => x.column === g.column && x.kind === g.kind);
    if (same) same.lit ||= g.lit;
    else list.push(g);
  };
  rows.forEach((row, i) => {
    if (row.parentId === null) return;
    const j = index.get(row.parentId);
    if (j === undefined || j >= i) return;
    const parent = rows[j]!;
    const lit = isLit(parent.conceptId);
    add(j, { column: parent.depth, kind: 'start', lit });
    for (let k = j + 1; k < i; k++) add(k, { column: parent.depth, kind: 'through', lit });
    add(i, { column: parent.depth, kind: 'end', lit });
  });
  return out;
}
