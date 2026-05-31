# Media

Captured 2026-10-05 in Expo Go (SDK 57) on the iOS Simulator (iPhone 17 Pro, iOS 26.0), running the production JS bundle from Metro. Screenshots are full-resolution `xcrun simctl io <udid> screenshot` captures resized to 600 px wide with `sips`. The GIF and MP4 are cut with ffmpeg from one continuous `xcrun simctl io <udid> recordVideo` take, with the demo clock on and Focus mode.

- `feed.png`: a reel ("State in React + TS") with code on screen and its "why this reel" strip: "Deepen. Unlocked by Components and props." Screenshot, 600 px.
- `adapt.png`: just after tapping "More like this" on "Core components in React Native", the strip changes to "Next: Components and props. Undo". Screenshot, 600 px.
- `card.png`: the first-check quiz card ("First check: Core components.") with answer B selected, before "Check answer". Screenshot, 600 px.
- `explanation.png`: after "Check answer", the "Correct." verdict, the explanation and the progress panel (Seen to Checked, "Back in about 1 min. Correct then: Learned."). Screenshot, 600 px.
- `review.png`: the delayed review card for the same concept, 65 s after the first answer: "Review. Answered Core components 1m 05s ago." Screenshot, 600 px.
- `map.png`: the knowledge map with the "Day 3" sample profile loaded (labelled "Sample data"), showing learned, checked, due, seen and locked cells and a "Review now, 1 question" dock. Screenshot, 600 px.
- `you.png`: the You tab with Focus mode, the Demo clock switched on, sound and haptics, and the sample profiles. Screenshot, 600 px.
- `demo.gif`: 36 s loop, 360 px wide, 12 fps. A reel and its strip, "More like this", the next reel's strip ("Because you tapped More like this"), a first-check card answered, about 42 s of the next reel sped up 14x, the review card answered (Checked to Learned), then the map replay. Dead time is cut out; palettegen/paletteuse with Bayer dithering.
- `demo.mp4`: the same cut as the GIF, 720 px wide, H.264 at 30 fps, `-movflags +faststart`, no audio.
