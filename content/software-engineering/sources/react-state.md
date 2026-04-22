# State in React

1. State is data a component remembers between renders; useState returns the current value and a setter function.
2. Calling the setter schedules a re-render with the new value.
3. State behaves like a snapshot: right after calling the setter, the variable in the current render still holds the old value.
4. When the next value depends on the previous one, pass an updater function, such as setCount(c => c + 1).
5. React batches several state updates in the same event into a single re-render.
6. Never mutate a state object or array directly; create a new copy with the change, because React compares old and new values with Object.is to decide what changed.
7. Each component instance has its own state; two copies of the same component do not share it.
8. When two components need the same state, move it up to their closest common parent and pass it down as props. This is called lifting state up.
