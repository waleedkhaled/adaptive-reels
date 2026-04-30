// Render templates and visual limits the writer must respect.
// Pure (no Node imports): the Remotion bundle imports this file too.

export const RENDER_TEMPLATES = {
  'kinetic-text':
    'Big animated on-screen text; image visuals fill the background. Good for hooks, definitions and everyday analogies.',
  'visual-focus':
    'A code snippet, flow diagram or equation fills the top of the screen, captions below. Good when code or a diagram carries the idea.',
} as const;
export type RenderTemplateId = keyof typeof RENDER_TEMPLATES;

/** What fits legibly on a 720 px phone frame: 44 characters at 22 px, shrinking to about 20 px at 48. */
export const CODE_LIMITS = { maxLines: 12, maxLineLength: 48 } as const;

export const FLOW_LIMITS = { maxNodes: 6, maxPerLayer: 3, maxLayers: 4 } as const;

export interface FlowLayoutNode {
  id: string;
  label: string;
  layer: number;
  index: number;
  layerSize: number;
}

/**
 * Layers nodes top to bottom by longest path from a source; edges that point
 * back up (cycles such as a retry loop) are ignored for layering.
 */
export function layoutFlow(
  nodes: { id: string; label: string }[],
  edges: { from: string; to: string }[],
): FlowLayoutNode[] {
  const layer = new Map(nodes.map((n) => [n.id, 0]));
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  // Relax forward edges only (by declaration order), so cycles terminate.
  for (let pass = 0; pass < nodes.length; pass++) {
    for (const e of edges) {
      if (!layer.has(e.from) || !layer.has(e.to)) continue;
      if (order.get(e.to)! <= order.get(e.from)!) continue;
      layer.set(e.to, Math.max(layer.get(e.to)!, layer.get(e.from)! + 1));
    }
  }
  const byLayer = new Map<number, string[]>();
  for (const n of nodes)
    byLayer.set(layer.get(n.id)!, [...(byLayer.get(layer.get(n.id)!) ?? []), n.id]);
  return nodes.map((n) => {
    const ids = byLayer.get(layer.get(n.id)!)!;
    return {
      id: n.id,
      label: n.label,
      layer: layer.get(n.id)!,
      index: ids.indexOf(n.id),
      layerSize: ids.length,
    };
  });
}

/** Problems with a flow diagram; empty when valid. */
export function flowProblems(
  nodes: { id: string; label: string }[],
  edges: { from: string; to: string }[],
): string[] {
  const problems: string[] = [];
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) problems.push('flow node ids must be unique');
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to))
      problems.push(`flow edge ${e.from} -> ${e.to} references an unknown node`);
  }
  const laid = layoutFlow(nodes, edges);
  const layers = Math.max(...laid.map((n) => n.layer)) + 1;
  if (layers > FLOW_LIMITS.maxLayers)
    problems.push(`flow is ${layers} levels deep; keep it to ${FLOW_LIMITS.maxLayers}`);
  if (laid.some((n) => n.layerSize > FLOW_LIMITS.maxPerLayer)) {
    problems.push(
      `flow has more than ${FLOW_LIMITS.maxPerLayer} boxes side by side; restructure it`,
    );
  }
  return problems;
}

/** The catalogue as text for the writer prompt. */
export function catalogueForPrompt(): string {
  const templates = Object.entries(RENDER_TEMPLATES)
    .map(([id, d]) => `- "${id}": ${d}`)
    .join('\n');
  return `Render templates (field "template"):
${templates}

Visual kinds (field "visual" of each segment):
- {"kind": "kinetic_text"}: the on-screen text animates large. Default when nothing else helps.
- {"kind": "code", "language": "ts" | "tsx" | "js" | "json" | "python" | "sql" | "yaml" | "bash", "code": "...", "highlight_lines": [1-based line numbers], "check": "compiles" | "should_error" | "none", "shows_mistake": true | false}:
  at most ${CODE_LIMITS.maxLines} lines, each at most ${CODE_LIMITS.maxLineLength} characters, 2-space indentation.
  ts/tsx snippets are type-checked as a standalone module (strict mode; "react" and "react-native" are importable): use "compiles" for code that type-checks, "should_error" only when the snippet is meant to produce a TypeScript compile error, "none" only for non-TypeScript code.
  Set "shows_mistake": true whenever the code is deliberately bad (a bug, an anti-pattern, a risky practice), even if it compiles; the narration must say it is a mistake. Correct code that the viewer should copy uses false.
  highlight_lines may only name lines that exist in the snippet.
- {"kind": "flow", "nodes": [{"id": "kebab-id", "label": "max 18 chars"}], "edges": [{"from": "id", "to": "id", "label": "optional, max 14 chars"}]}:
  boxes and arrows drawn top to bottom in the order nodes are listed; 2-${FLOW_LIMITS.maxNodes} nodes, at most ${FLOW_LIMITS.maxPerLayer} side by side, at most ${FLOW_LIMITS.maxLayers} levels.
- {"kind": "image", "prompt": "..."}: an illustration of an everyday scene or metaphor. Never ask for text, code, screens or diagrams in an image.
- {"kind": "equation", "latex": "..."}: a short formula, e.g. Big-O notation.`;
}
