// Whether the feed is on screen: its route is focused and the app is in the
// foreground. Nothing plays, settles or times out while it is hidden (under
// the map, on the You tab, in the background).
let focused = false;
let foreground = true;

export const isFeedVisible = (): boolean => focused && foreground;

export function setFeedFocused(value: boolean): void {
  focused = value;
}

export function setForeground(value: boolean): void {
  foreground = value;
}
