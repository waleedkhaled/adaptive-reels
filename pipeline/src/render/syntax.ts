// Syntax roles for code in reels (DESIGN.md "Code block"): identifiers and
// operators plain, keywords heavier, strings and numbers one tint, function,
// type and tag names another, comments and punctuation muted. Pure: shared by
// the Node renderer and the Remotion bundle.
import { normalizeTokens, Prism } from 'prism-react-renderer';

export type SyntaxRole = 'plain' | 'keyword' | 'literal' | 'name' | 'muted';

export interface CodeToken {
  text: string;
  role: SyntaxRole;
}

const GRAMMAR: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  json: 'json',
  python: 'python',
  sql: 'sql',
  yaml: 'yaml',
};

/** Prism token types, innermost first wins; unknown types defer to their parent. */
const ROLE: Record<string, SyntaxRole> = {
  comment: 'muted',
  prolog: 'muted',
  doctype: 'muted',
  cdata: 'muted',
  punctuation: 'muted',
  keyword: 'keyword',
  string: 'literal',
  char: 'literal',
  number: 'literal',
  boolean: 'literal',
  regex: 'literal',
  'attr-value': 'literal',
  url: 'literal',
  function: 'name',
  'function-variable': 'name',
  'class-name': 'name',
  builtin: 'name',
  tag: 'name',
  decorator: 'name',
  'attr-name': 'plain',
  operator: 'plain',
  property: 'plain',
  'property-access': 'plain',
  parameter: 'plain',
  // An expression inside a JSX attribute is code again, not part of the tag name.
  script: 'plain',
};

export function roleOf(types: string[]): SyntaxRole {
  for (let i = types.length - 1; i >= 0; i--) {
    const role = ROLE[types[i]!];
    if (role) return role;
  }
  return 'plain';
}

/** Splits code into lines of role-tagged tokens. Languages without a grammar stay plain. */
export function highlightCode(code: string, language: string): CodeToken[][] {
  const grammar = GRAMMAR[language] ? Prism.languages[GRAMMAR[language]!] : undefined;
  if (!grammar) return code.split('\n').map((line) => [{ text: line, role: 'plain' }]);
  return normalizeTokens(Prism.tokenize(code, grammar)).map((line) => {
    const tokens: CodeToken[] = [];
    for (const token of line) {
      if (!token.content) continue;
      const role = roleOf(token.types);
      const last = tokens[tokens.length - 1];
      if (last && last.role === role) last.text += token.content;
      else tokens.push({ text: token.content, role });
    }
    return tokens;
  });
}

/**
 * Code as it is shown: tabs expanded to two spaces (the snippet convention),
 * trailing spaces and trailing blank lines removed.
 */
export function displayCode(code: string): string {
  return code
    .replace(/\t/g, '  ')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n+$/, '');
}
