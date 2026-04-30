import { describe, expect, it } from 'vitest';
import { typeCheckSnippet } from './codecheck';

describe('typeCheckSnippet', () => {
  it('accepts a typed React component', () => {
    const code = `function Greeting({ name }: { name: string }) {\n  return <h1>Hello {name}</h1>;\n}\nconst el = <Greeting name="Ada" />;`;
    expect(typeCheckSnippet(code, 'tsx')).toEqual([]);
  });

  it('accepts React Native imports', () => {
    const code = `import { Text, View } from 'react-native';\nexport const Card = () => (\n  <View>\n    <Text>Hi</Text>\n  </View>\n);`;
    expect(typeCheckSnippet(code, 'tsx')).toEqual([]);
  });

  it('reports a missing required prop with its line', () => {
    const code = `function Greeting({ name }: { name: string }) {\n  return <h1>{name}</h1>;\n}\nconst el = <Greeting />;`;
    const errors = typeCheckSnippet(code, 'tsx');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^line 4: .*name/);
  });

  it('flags calling a method on unknown', () => {
    expect(
      typeCheckSnippet(`const data: unknown = JSON.parse('{}');\ndata.trim();`, 'ts')[0],
    ).toMatch(/line 2/);
  });

  it('does not clash with DOM globals', () => {
    expect(typeCheckSnippet(`const name = 'x';\nconst status = 1;`, 'ts')).toEqual([]);
  });
});
