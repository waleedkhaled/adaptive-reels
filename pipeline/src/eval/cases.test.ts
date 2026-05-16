import { ReelSpec } from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import { gateG1, quoteProblems } from '../gates';
import { caseId, DEFECTS, PLANTED, plant, type Defect } from './cases';
import { loadGolden } from './golden';

const golden = loadGolden();
const byId = new Map(golden.map((g) => [g.file.reel_id, g]));

describe('eval golden set', () => {
  it('has at least 16 checked specs', () => {
    expect(golden.length).toBeGreaterThanOrEqual(16);
    for (const g of golden) expect(g.file.label_source, g.file.reel_id).not.toBe('unchecked');
  });

  // G1 type-checks every snippet: allow for a slow CI machine.
  it('every good spec passes the deterministic checks', { timeout: 60_000 }, () => {
    for (const g of golden) {
      expect(gateG1(g.spec, g.job).issues, g.file.reel_id).toEqual([]);
      expect(quoteProblems(g.spec, g.job.concept.card.text), g.file.reel_id).toEqual([]);
    }
  });
});

describe('planted defects', () => {
  it('has three cases per defect type, each on a golden spec, with unique ids', () => {
    const ids = PLANTED.map(caseId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const defect of Object.keys(DEFECTS) as Defect[]) {
      expect(
        PLANTED.filter((c) => c.defect === defect),
        defect,
      ).toHaveLength(3);
    }
    for (const c of PLANTED) expect(byId.has(c.base), caseId(c)).toBe(true);
  });

  // Type-checks every planted snippet (about 40 compiler runs): allow for a slow CI machine.
  it(
    'each planted spec is schema-valid, differs from its base, and passes G1 and the quote check',
    { timeout: 60_000 },
    () => {
      for (const c of PLANTED) {
        const g = byId.get(c.base)!;
        const planted = plant(c, g.spec);
        const id = caseId(c);
        expect(() => ReelSpec.parse(planted), id).not.toThrow();
        expect(JSON.stringify(planted), id).not.toBe(JSON.stringify(g.spec));
        expect(gateG1(planted, g.job).issues, id).toEqual([]);
        expect(quoteProblems(planted, g.job.concept.card.text), id).toEqual([]);
      }
    },
  );

  it('planting never edits the golden spec itself', () => {
    for (const c of PLANTED) {
      const g = byId.get(c.base)!;
      const before = JSON.stringify(g.spec);
      plant(c, g.spec);
      expect(JSON.stringify(g.spec), caseId(c)).toBe(before);
    }
  });
});
