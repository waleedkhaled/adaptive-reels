# Navigation in React Native

1. React Native does not include navigation; the most common library is React Navigation, and Expo Router adds file-based routing on top of it.
2. A stack navigator keeps screens in a stack: navigating pushes a new screen on top, and going back pops it.
3. Screens lower in a stack stay mounted when you push a new screen, so their state is still there when you go back.
4. The native stack navigator uses the platform's own navigation components, so transitions and gestures feel native.
5. Tab navigators switch between sibling screens and usually keep each tab's state while you switch.
6. Route params pass data to a screen. The React Navigation docs recommend passing minimal data such as an ID, not whole objects.
7. In Expo Router, a file at app/profile.tsx becomes the /profile route, and folders create nested routes.
8. Deep linking maps a URL to a screen, so a link can open the app directly on that screen.
