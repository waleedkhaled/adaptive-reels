# Platform-specific code

1. Platform.OS tells you which platform the code is running on, for example 'ios' or 'android'.
2. Platform.select picks a value per platform, such as Platform.select({ ios: 12, android: 16 }).
3. Metro picks platform-specific files automatically: importing ./Button loads Button.ios.tsx on iOS and Button.android.tsx on Android.
4. Use platform-specific files when a component differs a lot per platform, and Platform.OS checks for small differences.
5. Platform.Version gives the operating system version, which helps when a feature exists only on newer OS versions.
6. Some behaviour differs by platform even with the same code, so features should be tested on both iOS and Android devices.
7. Keeping most code shared and isolating platform differences in a few places keeps an app easier to maintain.
