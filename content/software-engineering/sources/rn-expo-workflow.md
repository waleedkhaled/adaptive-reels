# The Expo workflow

1. Expo Go is an app from the store that can run your project instantly, but it only includes a fixed set of native modules.
2. When you need a library with native code that Expo Go does not include, you build a development build: your own version of the app with your native dependencies.
3. With Continuous Native Generation, the android and ios folders are generated from your app config by npx expo prebuild instead of being edited by hand.
4. Config plugins change the generated native projects, for example to add permissions or settings, so native changes live in configuration.
5. npx expo install installs versions of libraries that are compatible with your Expo SDK version.
6. EAS Build builds your app binaries in the cloud, so you do not need Xcode or Android Studio on your machine for release builds.
7. EAS Update sends over-the-air updates of JavaScript and assets; changes to native code still need a new build through the app stores.
