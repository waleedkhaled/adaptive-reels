# Components and props in React

1. A React component is a JavaScript function that returns JSX describing what should appear on screen.
2. Component names must start with a capital letter. A lowercase tag such as div is treated as a built-in element, not as your component.
3. Props are the inputs to a component. They are written like attributes in JSX and arrive in the function as a single object.
4. Props are read-only. A component must never modify its own props; to change what is shown over time it uses state instead.
5. When a parent re-renders and passes new props, the child component renders again with the new values.
6. The special children prop holds whatever is nested between a component's opening and closing tags.
7. Data flows one way in React: from parent to child through props.
8. In TypeScript, a component's props are described with a type or interface, for example function Greeting({ name }: { name: string }).
9. With typed props, passing a prop of the wrong type or forgetting a required prop is a compile-time error instead of a bug found at runtime.
