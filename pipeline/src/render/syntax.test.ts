import { describe, expect, it } from 'vitest';
import { displayCode, highlightCode, roleOf } from './syntax';

describe('syntax roles', () => {
  it('maps the innermost known Prism type', () => {
    expect(roleOf(['keyword'])).toBe('keyword');
    expect(roleOf(['template-string', 'interpolation', 'keyword'])).toBe('keyword');
    expect(roleOf(['template-string', 'string'])).toBe('literal');
    expect(roleOf(['class-name', 'constant'])).toBe('name');
    expect(roleOf(['tag', 'attr-name'])).toBe('plain');
    expect(roleOf(['tag', 'script', 'language-javascript'])).toBe('plain');
    expect(roleOf(['tag', 'punctuation'])).toBe('muted');
    expect(roleOf(['comment'])).toBe('muted');
    expect(roleOf([])).toBe('plain');
  });

  it('colours a TSX line the way DESIGN.md says', () => {
    const [line] = highlightCode('const n: number = use(1, "a"); // c', 'tsx');
    const role = (text: string) => line!.find((t) => t.text.includes(text))?.role;
    expect(role('const')).toBe('keyword');
    expect(role('number')).toBe('name');
    expect(role('use')).toBe('name');
    expect(role('1')).toBe('literal');
    expect(role('"a"')).toBe('literal');
    expect(role('// c')).toBe('muted');
  });

  it('keeps one token list per line, and plain text for languages without a grammar', () => {
    expect(highlightCode('a\n\nb', 'ts')).toHaveLength(3);
    expect(highlightCode('echo $HOME', 'bash')).toEqual([[{ text: 'echo $HOME', role: 'plain' }]]);
  });

  it('shows code with tabs expanded and trailing blank lines removed', () => {
    expect(displayCode('if (a) {\n\treturn 1;  \n}\n\n')).toBe('if (a) {\n  return 1;\n}');
  });
});
