# Unions and narrowing

1. A union type means a value can be one of several types, written with a vertical bar, such as string | number.
2. On a union, TypeScript only allows operations that are valid for every member of the union.
3. Narrowing is how TypeScript works out the exact type inside a branch, using checks such as typeof, instanceof, the in operator, or equality.
4. A discriminated union gives each member a shared literal field, such as status: 'loading' | 'success' | 'error', and checking that field narrows to one member.
5. Discriminated unions make impossible states unrepresentable, for example data can only exist when status is 'success'.
6. Assigning the narrowed value to a variable of type never in the default branch of a switch makes the compiler report any case you forgot to handle.
7. A type guard is a function whose return type is value is SomeType, which narrows the value wherever the function returns true.
