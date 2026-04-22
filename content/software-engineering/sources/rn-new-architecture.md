# React Native's New Architecture

1. The New Architecture replaces the old asynchronous bridge, where JavaScript and native code exchanged serialized JSON messages.
2. JSI, the JavaScript Interface, lets JavaScript hold references to native C++ objects and call their methods directly, without serializing messages.
3. Fabric is the new rendering system. It supports React's concurrent features such as Suspense and transitions.
4. TurboModules are the new native modules. They are loaded lazily when first used, instead of all at startup.
5. Codegen generates type-safe glue code between JavaScript and native code from typed specs.
6. The New Architecture has been enabled by default since React Native 0.76.
7. In Expo SDK 55 and later the New Architecture is always on and cannot be disabled.
8. Libraries that use native code must support the New Architecture to work with it, so check a library's compatibility before adopting it.
