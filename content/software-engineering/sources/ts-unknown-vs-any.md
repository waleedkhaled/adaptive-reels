# unknown vs any

1. any turns off type checking for a value: you can call any method or read any property, and errors only show up at runtime.
2. unknown means the type is not known yet: TypeScript lets you store and pass the value, but not use it until you narrow it.
3. Narrowing an unknown value, for example with typeof value === 'string', makes it safe to use in that branch.
4. any spreads: a value derived from an any value is also any, so one any can silently remove checking from much of a codebase.
5. JSON.parse returns any, so parsed data looks typed but is not checked.
6. Data from outside your program, such as API responses, should be treated as unknown and validated at runtime, for example with a schema library such as Zod.
7. In strict mode, the error variable in a catch clause has type unknown, so you must check it before using properties like message.
8. The noImplicitAny compiler option reports places where TypeScript would otherwise silently infer any.
