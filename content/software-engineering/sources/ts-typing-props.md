# Typing props in TypeScript

1. Describe a component's props with a type alias or interface, for example type Props = { title: string; count: number }.
2. Mark optional props with a question mark, such as subtitle?: string, and give defaults in the destructuring, such as { size = 16 }.
3. Type function props by their signature, for example onPress: () => void or onChange: (value: string) => void.
4. Type children that can be anything React can render as React.ReactNode.
5. React.ComponentProps<typeof Button> gives you the props of an existing component, so a wrapper can accept all of them and add its own.
6. With typed props, a missing required prop or a prop of the wrong type is a compile-time error at the place the component is used.
7. Many teams type props directly on the function parameter instead of using React.FC, which keeps children explicit.
