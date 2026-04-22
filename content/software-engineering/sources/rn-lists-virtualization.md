# Lists and virtualization

1. ScrollView renders all of its children at once, which is fine for short content but slow and memory hungry for long lists.
2. FlatList is a virtualized list: it renders only the items in and near the visible area, and unmounts items far off screen.
3. FlatList renders 10 items initially by default, controlled by initialNumToRender.
4. windowSize controls how much is kept rendered, measured in screen heights; the default is 21, meaning 10 screens above, 10 below and the visible one.
5. Each item needs a stable key, given through a key on the item or a keyExtractor function; using the array index breaks when items are inserted or removed.
6. When every row has the same height, getItemLayout lets FlatList skip measuring rows, which makes scrolling to an index fast.
7. Wrapping the row component in React.memo stops unchanged rows from re-rendering when the list's parent re-renders.
8. Third-party lists such as FlashList recycle row views instead of creating new ones, which can make long lists smoother.
