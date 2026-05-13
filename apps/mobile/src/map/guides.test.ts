import { describe, expect, it } from 'vitest';
import { railGuides } from './guides';

const rows = [
  { conceptId: 'a', depth: 0, parentId: null },
  { conceptId: 'b', depth: 1, parentId: 'a' },
  { conceptId: 'c', depth: 2, parentId: 'b' },
  { conceptId: 'd', depth: 1, parentId: 'a' },
  { conceptId: 'e', depth: 0, parentId: null },
];

describe('rail guides', () => {
  it('draws a start under the parent, through-lines between, and an end at each child', () => {
    const g = railGuides(rows, () => false);
    expect(g[0]).toEqual([{ column: 0, kind: 'start', lit: false }]);
    // b ends a's first connector and carries the line on to d; it also starts its own.
    expect(g[1]).toEqual(
      expect.arrayContaining([
        { column: 0, kind: 'end', lit: false },
        { column: 0, kind: 'through', lit: false },
        { column: 1, kind: 'start', lit: false },
      ]),
    );
    expect(g[2]).toEqual(
      expect.arrayContaining([
        { column: 1, kind: 'end', lit: false },
        { column: 0, kind: 'through', lit: false },
      ]),
    );
    expect(g[3]).toEqual([{ column: 0, kind: 'end', lit: false }]);
    expect(g[4]).toEqual([]);
  });

  it('lights the connectors of a learned parent only', () => {
    const g = railGuides(rows, (id) => id === 'b');
    expect(g[1]!.find((x) => x.kind === 'start')!.lit).toBe(true);
    expect(g[2]!.find((x) => x.kind === 'end')!.lit).toBe(true);
    expect(g[3]![0]!.lit).toBe(false);
  });

  it('never draws one piece twice in a row', () => {
    const g = railGuides(
      [
        { conceptId: 'p', depth: 0, parentId: null },
        { conceptId: 'x', depth: 1, parentId: 'p' },
        { conceptId: 'y', depth: 1, parentId: 'p' },
        { conceptId: 'z', depth: 1, parentId: 'p' },
      ],
      () => false,
    );
    expect(g[0]).toHaveLength(1);
    expect(g[2]!.filter((x) => x.kind === 'through')).toHaveLength(1);
  });
});
