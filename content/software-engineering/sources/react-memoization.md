# Memoization in React

1. useMemo caches the result of a calculation between renders and recalculates only when its dependencies change.
2. useCallback caches a function so the same function object is reused between renders until its dependencies change.
3. React.memo skips re-rendering a component when its props are the same as last time, comparing each prop with Object.is.
4. A new object, array or function passed as a prop on every render makes React.memo useless for that component.
5. Memoization is a performance optimisation, not a guarantee; code must still work correctly if the cache is discarded.
6. Memoizing everything adds code and comparison work; measure first and memoize where re-renders are actually slow.
7. React Compiler is a build-time tool that adds memoization automatically, reducing the need for manual useMemo and useCallback.
