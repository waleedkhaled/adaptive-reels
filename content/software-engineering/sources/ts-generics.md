# Generics in TypeScript

1. Generics let a function or type work with many types while keeping them connected, using a type parameter such as T.
2. function first<T>(items: T[]): T | undefined returns the same type as the array's elements, whatever that type is.
3. TypeScript usually infers the type parameter from the arguments, so you rarely need to write first<number>(...).
4. Constraints limit a type parameter, for example T extends { id: string } accepts any type that has a string id.
5. Built-in types are generic too: Array<T>, Promise<T> and Record<K, V>, and React's useState<T>.
6. React components can be generic, such as a List component that takes items: T[] and a renderItem function that receives a T.
7. Generics keep type information that any would throw away.
