# ADR 0008: Feed playback with a FlatList pager, a pool of 3 players, activation and settle thresholds, and file-first playback

- **Status:** Accepted
- **Decided:** 2026-10-04 · **Recorded:** 2026-10-05
- **Sources:** `docs/PERFORMANCE.md` sections 2.1 to 2.5 and 6.4 (written and reviewed 2026-10-04), `docs/PLAN.md` M3 and owner decisions of 2026-10-04, `PRODUCT.md` (brief decision 4: "a native paged list with 3 video players, questions in the same pager")

This record was written after the decision. It describes the decision as the code implements it on 2026-10-05.

## Context

- One vertical pager shows reels, retrieval cards and session summaries.
- Targets: p95 under 500 ms from activation to playback over 50 swipes, at most 3 video decoders, audio never overlapping (`docs/PLAN.md` M3).
- expo-video on SDK 57, in Expo Go: `useVideoPlayer(source)` destroys and re-creates the native player when the source changes; overlapping `replaceAsync` loads are fixed for iOS only in SDK 58; the App Store Expo Go 57.0.9 predates the expo-video 57.0.5 cache fixes (`docs/PERFORMANCE.md` 2.2, 2.4).
- The agent re-plans after every settle, and a quick action can change the next reel while the current one plays ([ADR 0002](0002-deterministic-pure-learning-agent.md)).
- The library may be unreachable at demo time (a phone away from the Mac's Wi-Fi).

## Decision

1. **Pager.** Core `FlatList` with native paging: `pagingEnabled`, `getItemLayout` from the measured height, `windowSize` 5, `initialNumToRender` 1, `maxToRenderPerBatch` 2, `removeClippedSubviews` off. The pager is locked while a card or summary is the settled item (`apps/mobile/src/feed/Feed.tsx:95-97,199-220`). The chrome is mounted once, outside the list.
2. **Two moments** (`Feed.tsx:71-86`):
   - **Activation**, 60% visible with no minimum time: play state only. Pause the other players, rewind those that do not hold the open impression, and play this reel only if its player already holds it (`controller.ts:140-180`).
   - **Settle**, at least 95% visible for 100 ms: close the impression, call the agent, log, assign players and flush (`controller.ts:250-312`).
3. **Player pool.** `POOL = 3` players created once with `createVideoPlayer(null)`, looping, with explicit buffer options (40 s forward buffer) and no time-update events (`apps/mobile/src/feed/players.ts:28-46`, `lib/store.ts:92`). The reel with ordinal `k` always uses player `k % 3` (`players.ts:48`). Cards have no ordinal and no player.
4. **Serialised loads.** `assign()` chains `replaceAsync` per player with a generation token, so only the latest request finishes, and marks the player loaded when it resolves (`players.ts:51-79`). At settle the window around the anchor reel is assigned: the anchor, the next and the previous reel; the two reels after are queued for download (`controller.ts:233-247`).
5. **Mounting.** A cell mounts a `VideoView` only while its player holds that reel: on iOS for the active reel and its neighbours, on Android for the active reel only. A ground-colour cover stays until the first frame (`apps/mobile/src/feed/ReelCell.tsx`).
6. **File-first source.** `sourceFor()` returns the `file://` copy when the cached file has exactly the manifest's byte count; otherwise it streams the URL and queues a download (`apps/mobile/src/lib/downloads.ts:36-50`). Downloads run 2 at a time into a `.part` file that is moved into place only at the right size. "Save all for offline" in You queues every reel; files the manifest no longer lists are deleted at boot (`downloads.ts:107-137`, `lib/store.ts:136-141`).
7. **Recovery.** A load error, a rejected load or no first frame 5 s after settle reloads once (a file source falls back to the URL); a stalled clock 1 s after `play()` reloads the player once; a second failure shows Try again and Skip (`apps/mobile/src/feed/health.ts`).

## Alternatives considered

- **react-native-pager-view or FlashList.** Held as fallbacks, in that order, if the list fights the players (`docs/PERFORMANCE.md` 2.1). FlatList was chosen "for parity with Bluesky's production feed on this stack and because of the mixed-item freeze report (#40376), not because recycling has no benefit" (2.1).
- **A player per cell with `useVideoPlayer(source)`.** Rejected: on SDK 57 it destroys and re-creates the native player when the source changes (2.2), and the number of decoders would follow the number of mounted cells.
- **Settle on `onMomentumScrollEnd`, or at 100% visibility.** Rejected: the event is not emitted for a release without momentum and has been skipped on Android for programmatic scrolls, which is how cards advance; and React Native 0.86 floors offsets, so a page at rest can read about 99.9% visible and never settle (2.1).
- **expo-video's built-in cache (`useCaching: true`).** Rejected for now (2.4): the iOS cache fixes are not in the App Store Expo Go 57.0.9, the iOS cache has a 5 s request timeout and keys on the URL with no revalidation. The keep rule: switch only if `playing_ms` p50 improves by at least 100 ms with zero player errors over 60 swipes on both platforms.
- **Pin the next slot instead of the next reel.** Rejected (2.5): pinning a slot pushed a due review behind one more whole reel, about 123 s after the answer on the demo clock, outside the 60 to 120 s window of M5. The agent commits the next reel and places cards before it.

## Consequences

### Good

- At most 3 players exist by construction, and the previous, current and next reels always sit on different players, with or without cards between them. A re-plan that changes the next reel reloads one player; one that does not change it costs no player work.
- Activation does no accounting, agent work or loading, so the work during a swipe is play and pause on players that are already loaded.
- Saved reels play with no network, and every start logs whether it came from a file or the network (`reel_first_frame.source`).
- Reel start p95 was 470 ms on the iOS Simulator against the 500 ms pass line (`docs/PLAN.md` status, 2026-10-05).

### Bad

- The device checks are still open: Android, the 60-swipe spike and performance on a phone (`docs/PLAN.md` status). Three decoders on a mid-range Android phone are untested (`docs/PERFORMANCE.md` R7).
- A reel that is not yet on disk is fetched twice, once streamed and once downloaded (`docs/PERFORMANCE.md` section 8). The OS may purge the cache directory (6.4).
- Settle needs 100 ms at 95% visibility, so the reel end, the agent call and the logging run after the page is still. A fast flick passes over planned items without settling on them.
- The stall watchdog runs on both platforms in code, while `docs/PERFORMANCE.md` 2.3 plans it for Android only.
- In development, `FlatList` refuses new viewability pairs on a mounted list, so the list's key includes the module's load time and the list remounts after a Fast Refresh of `Feed.tsx` (`Feed.tsx:66-69`).
