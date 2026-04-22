# Core components in React Native

1. React Native core components such as View, Text, Image and ScrollView render real native platform views, not HTML inside a web view.
2. On iOS a View becomes a UIView, and on Android it becomes an android.view.View.
3. React Native has no div, span or p elements. View is the basic container and Text displays text.
4. Text strings must be rendered inside a Text component. A bare string placed directly inside a View causes the error "Text strings must be rendered within a <Text> component".
5. Styles are plain JavaScript objects, usually created with StyleSheet.create, and property names are camelCase, such as backgroundColor and fontSize.
6. React Native lays out views with Flexbox, and flexDirection defaults to column, unlike the web where it defaults to row.
7. Sizes in React Native styles are unitless density-independent pixels, so 16 means roughly the same physical size on screens with different pixel densities.
8. The same component code runs on both iOS and Android. Platform differences can be handled with Platform.OS or with files ending in .ios.tsx and .android.tsx.
