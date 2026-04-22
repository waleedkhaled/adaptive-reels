# Performance and re-renders in React Native

1. React Native runs your JavaScript on a JavaScript thread, while the UI thread draws native views and handles touches.
2. To look smooth at 60 frames per second, each frame has about 16.7 milliseconds; work that blocks the JavaScript thread longer causes dropped frames.
3. When a component re-renders, its children re-render too, unless they are memoized and their props did not change.
4. Creating new objects, arrays or functions in render gives memoized children new props every time, which defeats memoization.
5. Animations driven by the native driver or by Reanimated worklets run on the UI thread, so they stay smooth even when JavaScript is busy.
6. console.log calls slow down production apps and should be removed or stripped from release builds.
7. Hermes is the default JavaScript engine in React Native and is optimised for fast startup on mobile.
8. Measure with a profiler, such as the React DevTools Profiler, before optimising, so you fix the slow part instead of guessing.
