// Type-checks ts/tsx snippets from reel specs with the TypeScript compiler, so
// code shown on screen is known to compile (or, for pitfalls, known to fail).
import path from 'node:path';
import ts from 'typescript';
import { REPO_ROOT } from './config';

const OPTIONS: ts.CompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
  types: [],
  skipLibCheck: true,
  noEmit: true,
};

// Lives inside the repo so "react" and "react-native" resolve from node_modules.
const VIRTUAL_DIR = path.join(REPO_ROOT, 'pipeline', '.snippet');

/** Compiler errors for a snippet, as readable strings with snippet line numbers. */
export function typeCheckSnippet(code: string, language: 'ts' | 'tsx'): string[] {
  const file = path.join(VIRTUAL_DIR, `snippet.${language}`);
  // Force module scope so declarations cannot clash with DOM globals like `name`.
  const source = `${code}\nexport {};\n`;
  const host = ts.createCompilerHost(OPTIONS, true);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, ...rest) =>
    path.resolve(fileName) === file
      ? ts.createSourceFile(fileName, source, languageVersion, true)
      : getSourceFile(fileName, languageVersion, ...rest);
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (fileName) => path.resolve(fileName) === file || fileExists(fileName);
  host.readFile = ((readFile) => (fileName: string) =>
    path.resolve(fileName) === file ? source : readFile(fileName))(host.readFile.bind(host));

  const program = ts.createProgram([file], OPTIONS, host);
  const sourceFile = program.getSourceFile(file)!;
  const diagnostics = [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ];
  return diagnostics.map((d) => {
    const message = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    if (d.file && d.start !== undefined) {
      const { line } = d.file.getLineAndCharacterOfPosition(d.start);
      return `line ${line + 1}: ${message}`;
    }
    return message;
  });
}
