# Flexbox layout in React Native

1. React Native lays out views with Flexbox, using a layout engine called Yoga.
2. flexDirection defaults to column in React Native, so children stack top to bottom, while on the web it defaults to row.
3. justifyContent aligns children along the main axis, and alignItems aligns them along the cross axis.
4. alignItems defaults to stretch, so children fill the cross axis unless they have a fixed size.
5. flex: 1 makes a view expand to fill the space available along its parent's main axis; siblings with flex 1 and flex 2 share space in a one to two ratio.
6. In React Native flexShrink defaults to 0, while on the web it defaults to 1.
7. gap, rowGap and columnGap add space between children without margins on each child.
8. position: 'absolute' places a view relative to its parent, taking it out of the normal flex flow.
