import { describe, expect, it } from 'vitest';
import { buildCatalog, railOrder } from './catalog';
import { keyedRandom, keyedShuffle, pickIndex } from './random';
import {
  fixtureCatalog,
  fixtureGraph,
  manifestFor,
  realCatalog,
  realGraph,
} from './testing/fixtures';

describe('keyed random draws', () => {
  it('is a pure function of the seed and the key', () => {
    expect(keyedRandom(14, 'pool', 3)).toBe(keyedRandom(14, 'pool', 3));
    expect(keyedRandom(14, 'pool', 3)).not.toBe(keyedRandom(14, 'pool', 4));
    expect(keyedRandom(14, 'pool', 3)).not.toBe(keyedRandom(15, 'pool', 3));
    expect(keyedRandom(14, 'pool', 3)).not.toBe(keyedRandom(14, 'tie', 3));
  });

  it('is uniform enough: 10 buckets over 20k ordinals within 10% of 2000', () => {
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 20_000; i++) {
      const u = keyedRandom(7, 'pool', i);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      buckets[pickIndex(10, u)]! += 1;
    }
    for (const n of buckets) expect(Math.abs(n - 2000)).toBeLessThan(200);
  });

  it('shuffles into a permutation, the same way for the same key', () => {
    const a = keyedShuffle([0, 1, 2, 3], 9, 'shuffle', 'item', 0);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    expect(keyedShuffle([0, 1, 2, 3], 9, 'shuffle', 'item', 0)).toEqual(a);
    const orders = new Set<string>();
    for (let p = 0; p < 50; p++)
      orders.add(keyedShuffle([0, 1, 2, 3], 9, 'shuffle', 'item', p).join());
    expect(orders.size).toBeGreaterThan(10);
  });
});

describe('buildCatalog on the fixture graph', () => {
  const catalog = fixtureCatalog();

  it('indexes topics, concepts, edges, reels and items', () => {
    expect(catalog.topics.map((t) => t.id)).toEqual(['alpha', 'beta', 'gamma']);
    expect(catalog.concepts).toHaveLength(12);
    const a1 = catalog.conceptById.get('a1')!;
    expect(a1.isRoot).toBe(true);
    expect(a1.dependents).toEqual(['a2', 'a5']);
    expect(a1.related).toEqual(['b2']);
    expect(catalog.conceptById.get('a4')!.ancestors).toEqual(new Set(['a1', 'a2', 'a3']));
    expect(catalog.conceptById.get('b4')!.prereqs).toEqual(['b2', 'b3']);
    expect(catalog.conceptById.get('g3')!.prereqs).toEqual(['a2', 'g2']);
    expect(catalog.conceptById.get('g1')!.related).toEqual([]);
    expect(a1.reels.map((r) => r.angle)).toEqual(['intro', 'example', 'pitfall']);
    expect(catalog.reelCount).toBe(36);
    expect(catalog.itemById.get('a1--intro--q1')).toMatchObject({
      reelId: 'a1--intro',
      answerIndex: 0,
      choiceCount: 4,
    });
    expect(catalog.topicById.get('beta')?.shortTitle).toBe('Beta');
  });

  it('skips reels of unknown concepts and tolerates missing reels', () => {
    const graph = fixtureGraph();
    const manifest = manifestFor(graph, { missing: ['a1--example'] });
    manifest.reels.push({ ...manifest.reels[0]!, reel_id: 'zz--intro', concept_id: 'zz' });
    const catalog2 = buildCatalog(graph, manifest);
    expect(catalog2.conceptById.get('a1')!.reels.map((r) => r.angle)).toEqual(['intro', 'pitfall']);
    expect(catalog2.problems).toEqual(['reel "zz--intro" has unknown concept "zz"']);
  });

  it('orders rails depth-first with every in-topic prerequisite above', () => {
    expect(railOrder('alpha', catalog).map((r) => `${r.conceptId}@${r.level}`)).toEqual([
      'a1@0',
      'a2@1',
      'a3@2',
      'a4@3',
      'a5@1',
    ]);
    // The diamond: b4 goes under b3, the in-topic prerequisite placed last; b2 becomes a "+ needs" line.
    const beta = railOrder('beta', catalog);
    expect(beta.map((r) => r.conceptId)).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(beta[3]).toMatchObject({ parentId: 'b3', needs: ['b2'], implied: [] });
    const gamma = railOrder('gamma', catalog);
    expect(gamma.map((r) => r.conceptId)).toEqual(['g1', 'g2', 'g3']);
    expect(gamma[2]).toMatchObject({ parentId: 'g2', needs: ['a2'] });
  });
});

describe('rail order on the real graph (UX.md 3.5)', () => {
  const catalog = realCatalog();

  it('is prerequisite-safe in all 5 topics', () => {
    for (const topic of catalog.topics) {
      const rows = railOrder(topic.id, catalog);
      expect(rows).toHaveLength(8);
      const position = new Map(rows.map((r, i) => [r.conceptId, i]));
      for (const row of rows) {
        for (const p of catalog.conceptById.get(row.conceptId)!.prereqs) {
          if (position.has(p)) expect(position.get(p)!).toBeLessThan(position.get(row.conceptId)!);
        }
      }
    }
  });

  it('puts Performance and re-renders at row 4 of React Native, then the other four', () => {
    expect(catalog.topicById.get('react-native')!.conceptIds).toEqual([
      'rn-core-components',
      'rn-flexbox-layout',
      'rn-lists-virtualization',
      'rn-performance-rerenders',
      'rn-navigation',
      'rn-platform-code',
      'rn-new-architecture',
      'rn-expo-workflow',
    ]);
  });

  it('has the rail specials: 33 connectors, 4 "+ needs" lines and 1 implied edge for 38 prerequisites', () => {
    const rows = catalog.topics.flatMap((t) => railOrder(t.id, catalog));
    const connectors = rows.filter((r) => r.parentId !== null).length;
    const needs = rows.flatMap((r) => r.needs.map((n) => `${r.conceptId}<-${n}`));
    const implied = rows.flatMap((r) => r.implied.map((n) => `${r.conceptId}<-${n}`));
    expect(connectors).toBe(33);
    expect(needs.sort()).toEqual([
      'binary-search-debugging<-reproduce-before-fixing',
      'llm-unreliable-dependency<-structured-output',
      'prompt-injection-guardrails<-tool-use-agents',
      'rn-performance-rerenders<-react-memoization',
    ]);
    expect(implied).toEqual(['retrieval-augmented-generation<-tokens-context-windows']);
    expect(connectors + needs.length + implied.length).toBe(38);
    const injection = rows.find((r) => r.conceptId === 'prompt-injection-guardrails')!;
    expect(injection).toMatchObject({ level: 0, parentId: null, stub: true });
    expect(railOrder('systems-design', catalog).at(-1)?.conceptId).toBe(
      'prompt-injection-guardrails',
    );
    const binary = rows.find((r) => r.conceptId === 'binary-search-debugging')!;
    expect(binary.parentId).toBe('break-down-problems');
    const rag = rows.find((r) => r.conceptId === 'retrieval-augmented-generation')!;
    expect(rag.parentId).toBe('hallucinations');
  });

  it('keeps a concept with 2 reels (the rejected llm-unreliable-dependency--example)', () => {
    const concept = catalog.conceptById.get('llm-unreliable-dependency')!;
    expect(concept.reels.map((r) => r.angle)).toEqual(['intro', 'pitfall']);
    expect(catalog.reelCount).toBe(119);
    expect(realGraph().nodes.filter((n) => n.kind === 'concept')).toHaveLength(40);
  });
});
