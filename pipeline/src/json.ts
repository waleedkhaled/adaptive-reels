/** Pull the first JSON object out of a model reply (tolerates code fences and stray prose). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new SyntaxError('no JSON object in model output');
  return JSON.parse(text.slice(start, end + 1));
}

export function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string[] {
  return issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
}
