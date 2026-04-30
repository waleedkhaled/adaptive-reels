import type { Visual } from '@reels/schemas';
import { describe, expect, it } from 'vitest';
import {
  codeSize,
  prettierOptions,
  reformatSnippet,
  remapHighlights,
  REFORMAT_COLUMNS,
} from './reformat';

type CodeVisual = Extract<Visual, { kind: 'code' }>;
const code = (src: string, over: Partial<CodeVisual> = {}): CodeVisual => ({
  kind: 'code',
  language: 'ts',
  code: src,
  highlight_lines: [],
  check: 'compiles',
  shows_mistake: false,
  ...over,
});

describe('highlight remapping', () => {
  it('follows a line that moved', () => {
    const before = 'function f({ base }: { base: number }) {\n  return base * 2;\n}';
    const after = 'function f({\n  base,\n}: {\n  base: number;\n}) {\n  return base * 2;\n}';
    expect(remapHighlights(before, after, [2])).toEqual([6]);
  });

  it('highlights every line a split line became', () => {
    const before = 'const a = 1;\nconst r = await callModel(req.body.text);\nreturn r;';
    const after = 'const a = 1;\nconst r = await callModel(\n  req.body.text,\n);\nreturn r;';
    expect(remapHighlights(before, after, [2])).toEqual([2, 3, 4]);
  });

  it('keeps identical lines in order and follows blank lines', () => {
    const before = 'a();\n\nb();\nb();';
    expect(remapHighlights(before, before, [2, 3, 4])).toEqual([2, 3, 4]);
  });

  it('gives up when a highlighted line is gone', () => {
    expect(remapHighlights('a();\nzzzzzzzz();', 'a();', [2])).toBeNull();
  });
});

describe('Prettier options', () => {
  it("keep the snippet's quotes, semicolons and arrow parens", () => {
    expect(prettierOptions("import x from 'y';\nconst f = u => u;", 'ts')).toMatchObject({
      singleQuote: true,
      semi: true,
      arrowParens: 'avoid',
      printWidth: REFORMAT_COLUMNS,
    });
    expect(prettierOptions('import x from "y"\nconst f = (u: number) => u', 'ts')).toMatchObject({
      singleQuote: false,
      semi: false,
      arrowParens: 'always',
    });
  });
});

describe('reformatting a snippet', () => {
  const long = [
    'type Req = { body: { text: string } };',
    'const callModel = async (t: string) => t;',
    '',
    'async function summary(req: Req) {',
    '  const r = await callModel(req.body.text);',
    '  return { summary: r };',
    '}',
  ].join('\n');

  it('needs it: 43 columns do not fit at 26 px', () => {
    expect(codeSize(code(long), 26)).toBeNull();
    expect(codeSize(code(long), 24)).toBe(25);
  });

  it('reaches 42 columns, still compiles and keeps its highlight', async () => {
    const result = await reformatSnippet(code(long, { highlight_lines: [5] }));
    if ('reason' in result) throw new Error(result.reason);
    expect(Math.max(...result.code.split('\n').map((l) => l.length))).toBeLessThanOrEqual(42);
    expect(result.highlight_lines).toEqual([5, 6, 7]);
    expect(result.code.split('\n')[4]).toBe('  const r = await callModel(');
  });

  it('keeps a deliberate type error', async () => {
    const wrong = [
      'type User = { readonly name: string };',
      'const u: User = { name: "Ada" };',
      'function rename(user: User, next: string) {',
      '  user.name = next;',
      '}',
    ].join('\n');
    const result = await reformatSnippet(
      code(wrong, { check: 'should_error', highlight_lines: [4] }),
    );
    if ('reason' in result) throw new Error(result.reason);
    // The signature splits into four lines, so the assignment moves from line 4 to line 7.
    expect(result.code.split('\n')[6]).toBe('  user.name = next;');
    expect(result.highlight_lines).toEqual([7]);
  });

  it('leaves languages without a formatter alone', async () => {
    expect(await reformatSnippet(code('print(1)', { language: 'python', check: 'none' }))).toEqual({
      reason: 'no formatter for python',
    });
  });

  it('refuses code Prettier cannot parse', async () => {
    const result = await reformatSnippet(code('const = ;'));
    expect('reason' in result && result.reason).toMatch(/Prettier could not parse/);
  });
});
