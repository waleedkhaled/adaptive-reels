# Effects in React

1. useEffect runs code after React has updated the screen, to synchronise a component with something outside React, such as a network request, a subscription or a timer.
2. The dependency array tells React when to re-run the effect: only when one of the listed values changed since the last render.
3. An effect can return a cleanup function, which React runs before re-running the effect and when the component unmounts.
4. In development, Strict Mode mounts components, unmounts them and mounts them again, so effects run twice to reveal missing cleanup.
5. If a value can be computed from props or state during render, compute it directly instead of storing it in state with an effect.
6. Logic that responds to a specific user action belongs in the event handler, not in an effect.
7. Leaving a value out of the dependency array makes the effect use a stale value; the react-hooks/exhaustive-deps lint rule warns about this.
8. When fetching data in an effect, ignore responses that arrive after the inputs changed, or an older response can overwrite a newer one.
