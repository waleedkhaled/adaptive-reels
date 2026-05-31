# Knowledge map: three concepts and the judging

Three designers each produced a concept from a different angle; three judges scored them through different lenses.

## Scores

| Lens        | Heatmap | Graph | Hybrid | Winner                                                       |
| ----------- | ------- | ----- | ------ | ------------------------------------------------------------ |
| learner     | 7       | 6.5   | 7.5    | hybrid                                                       |
| ergonomics  | 6       | 6.5   | 7.5    | hybrid (Matrix + Rail). It wins on its own merits for this l |
| engineering | 7       | 4.5   | 7.5    | hybrid (Matrix + Rail), on build cost rather than on being a |

## Judge: learner

**Winner:** hybrid

### heatmap: 7/10

Strengths:

- Most honest encoding of the three: Seen is a grey dot (not partial blue), the legend can state one rule ('Watching adds a dot. Only answering fills a cell.'), the headline counts only box >= 2, and watching triggers no celebratory panel.
- Handles the checked-but-not-due case correctly ('Comes back in 40 s. Answering early does not count', no start button). This matches PLAN.md ('Correct before dueAt -> no promotion'); the hybrid omits this state.
- Best 'what is next': a default dock with three ranked, reasoned suggestions (due, just unlocked, opens N concepts), each with a one-tap play button and a numbered pin on its cell. This directly answers the Mastery Grids finding that only 29% could find weak points from the grid alone.
- Strongest in-feed progress beat: a persistent map chip in the feed plus a 280x148 panel with 13x15 pt marks and a three-line change text, so the fill-in is seen at the moment of the answer, not only when the map is opened.
- Computed button labels never over-promise ('Start with <first unmet prerequisite>', 'Stops before this unlocks'), and the demo script is the only one that scripts the branch where the review is not yet due at card 2.
- Legend doubles as live counts, so it carries information instead of being a static key.

Weaknesses:

- No concept titles at rest. 40 anonymous 37 pt cells answer 'how much' but not 'what do I know'; names need a tap, a non-obvious slide gesture, or the Outline mode that replaces the map instead of sitting beside it.
- Locked slots at 1.18:1 contrast are effectively invisible on a real phone, so a fresh map reads as 6 outlines on an empty screen and the size of the road ahead (34 concepts) is not visible. The headline unlock is then six anonymous outlines appearing, which is abstract for an audience.
- 'Why is this locked' is never answered at rest: chevrons and a ragged right edge are a weak cue that a first-time viewer will not decode in 5 seconds; the reason only appears after a tap.
- The path line runs under cells that are not on the path (for Performance and re-renders it passes under Flexbox, Navigation and others, with only stop dots marking the real prerequisites). It can be misread as 'all of these come first'; the author already lists it as the first thing to drop.
- Large mark vocabulary for a 5-second read: dot, half, full, tick, double tick, three outline states, amber badge, numbered pins, stop dots, arrowheads, dashed outlines, diagonal hairline, '+N new', interest bars.
- The three-bar interest glyph beside each lane name sits next to progress counts and is likely to be read as progress.

### graph: 6.5/10

Strengths:

- The clearest causal picture of an unlock: the lit line travels from the learned node down the edges and the children open. A viewer sees why six concepts opened without any explanation.
- Best at-rest answer to 'why is this locked': unmet edges are dashed, and cross-topic prerequisites are named in a pill beside the node with the foreign concept's state.
- Selecting a locked node numbers its unmet ancestors in the order the gap session will serve them, which turns 'Step 1 of 3' into something visible.
- Titles are always visible for the focused topic and targets are large (at least 104x88 pt); open nodes carry a play triangle, so 'this is tappable and startable' is obvious.
- The in-feed moment shows an 8-node topic tree at 160x120, which is more legible than a 40-cell miniature, and the card stays until the learner swipes.
- Honest about the delayed check in the action layer: 'Checked now, Learned after a second, delayed check' and a disabled 'Delayed check in 0:42' countdown.

Weaknesses:

- Only 8 of 40 concepts are legible at once. The whole-map view is five 54x54 thumbnails with 8 pt dots (4 pt when locked) in which the five mastery levels cannot be told apart, so 'the knowledge map fills in' is really 'one topic fills in'.
- No global headline such as '1 of 40 learned'. After the demo the canvas shows 7 of 8 React Native nodes changed, which overstates progress against 1 of 40 unless the viewer reads the strip counts.
- The hero topic is the one most likely to be misread: React Native's six depth-1 children wrap into two rows of three, so Platform-specific code sits directly under Flexbox layout and reads as a second prerequisite level. Same issue in Problem solving. Verified in graph.json: all six are siblings at depth 1.
- The cross-topic curiosity story is hidden. In the demo, reel 2 is Components and props in another topic; its progress lands on a thumbnail dot, not on the canvas the audience is looking at. RELATED_TO appears only as chips.
- Learned gets a tick. A tick reads as 'done', which is the Execute Program failure the research warns about; the heatmap and hybrid reserve the tick for Retained.
- The thumbnail trees keep their real layout at a size where the layout carries almost no information beyond the n/8 count; that is close to decoration.

### hybrid: 7.5/10

Strengths:

- The only design where 'what do I know' is answered in words at rest for a whole topic (8 full titles with state labels) while all 40 states and the '1 of 40 learned' headline stay on the same screen.
- The rail is a file-tree or git-log idiom that working developers read instantly, and it removes the graph design's wrapped-row ambiguity: Core components with six indented children cannot be mistaken for two levels.
- Locked concepts stay visible (dots at 3.3-3.9:1 in the matrix, muted but readable titles in the rail), so the road ahead and its size are legible, unlike the heatmap's near-invisible slots.
- 'Why is this locked' is answered at rest for in-topic edges (tree connectors) and for the 3 cross-topic edges (inline '+ needs Memoization (React + TS)'), and across topics on selection via the matrix highlight without any diagonal lines.
- The map-open replay combines both strengths: the tile fills, then six titled rows light up down the rail with their connectors, while the matrix tiles flip and the header rolls 0 to 1 of 40. Titles opening is a more meaningful unlock than anonymous outlines.
- The action is always one tap away: the map opens with the agent's suggested gap already selected and a Start button in the dock; rail rows are full-width 44 pt targets.
- The demo script opens with a 5-second baseline look at the empty map, which gives the later fill-in a before and after.

Weaknesses:

- Dense: header, summary line, matrix with labels, meters and counts, a 7-item legend, stage header, 8 rows and a dock. The link between the matrix row and the stage is a 3 pt bar, and the two use different orders (depth tier vs depth-first), so the nth tile is not the nth row.
- The in-feed progress chip, which is the first and most watched fill-in beat of the demo, draws the map at 7 pt per tile (78x47 pt). Half fill versus full fill is not readable at that size; the beat is carried by the text alone.
- Honesty is weaker than the heatmap: the 'Checked, then Learned after a later correct answer' line lives only in the expanded panel, Seen uses the same sky outline as mastery states, and the checked-but-not-due state is not defined, so Start could lead to a correct answer that cannot promote.
- Only one suggested gap is shown, against three ranked ones in the heatmap.
- The 34x3 pt interest meter directly under each topic label looks like a progress bar on a progress screen.
- Vertical fit has almost no slack. On the hero topic one row grows to 52 pt for the '+ needs' line, which uses 8 of the 9 spare points; any tab bar or shorter phone makes the stage scroll and cuts the eight-row unlock wave. Legend words are 10 pt.
- The rail is a tree drawn over a DAG: Prompt injection and guardrails appears at root indent while locked (its only prerequisite is in another topic) but at the far right of the matrix, and Binary-search debugging needs a merge elbow from a parent listed below it.

### Ideas to graft onto the winner

- From heatmap: the honesty rule and its encoding. Make Seen a neutral grey mark and state one line in the legend: 'Watching adds a dot. Only answering fills a cell.' Keep sky for states earned by a correct check.
- From heatmap: the checked-but-not-due state with no start button and the text 'Comes back in 40 s. Answering early does not count.' From graph: show it as a live countdown ('Delayed check in 0:42'), which makes the spacing rule visible during the demo.
- From heatmap: three ranked 'Next up' suggestions (due first, then just unlocked, then most dependents) with a reason that states the payoff ('Opens 6 React Native concepts', from both heatmap and graph). In the hybrid, put numbered pins 1-3 on the matrix tiles and let the dock show number 1 with a way to step to 2 and 3.
- From heatmap: the larger in-feed answer panel (about 280x148 pt, marks about 13 pt, three text lines) and the rule that watching a reel triggers no panel. From graph: draw that panel as the affected topic only (8 marks or the mini rail, with the connector lighting before the children open) and keep it on screen until the learner swipes when a concept becomes Learned.
- From heatmap: a small persistent map chip in the feed as the entry point to the map, so there is always a way in and seen marks accumulate in view.
- From heatmap: a legend that doubles as live counts, replacing the hybrid's separate summary line and static legend. This removes one stratum and frees about 22 pt of height.
- From heatmap: button labels that name the starting point on the button itself for locked targets ('Start with Components and props') plus the line 'Stops before this unlocks', and the wrong-answer text 'Checked to Seen. Another angle is coming.'
- From graph: on selecting a locked concept, number its unmet ancestors 1, 2, 3 in gap-session order on the rail rows and matrix tiles.
- From graph: show the foreign prerequisite's state glyph and remaining count on the cross-topic line ('+ needs Memoization (React + TS), 3 steps away'), and draw unmet rail connectors dashed as well as slate so edge state does not rely on colour alone.
- From graph: a 'changed since last visit' dot on matrix rows that are not on stage, so progress in other topics (for example the seen mark on Components and props) is not missed.
- From heatmap: the demo script's explicit branch for the case where the review is not yet due at card 2 (first check on another concept, then the overdue guard serves the review in the next slot).

### The winner must fix

- Rebuild the in-feed progress moment. At 7 pt per tile the level change is unreadable, and this is the beat the audience sees twice before the map is ever opened. Use a panel of roughly 280x148 pt or show only the affected topic at a readable size.
- Define the checked-but-not-due state. As written, Start on such a concept leads to a check that PLAN.md says cannot promote ('Correct before dueAt -> no promotion'). Show the countdown and no primary button. Also decide whether a due review from the map is one card or the plan's three items.
- Move the delayed-check rule out of the expanded panel into the always-visible layer: a one-line rule in the legend and state wording in the collapsed dock (for example 'Checked. Becomes Learned after a later correct answer').
- Make Seen visually distinct from retrieval-earned states (neutral grey mark) so partial sky cannot read as partial mastery.
- Fix the matrix-to-rail mapping. Use one order in both (default to the rail order in the matrix and give up the tier gaps if needed) and attach the stage to the selected row with more than a 3 pt bar (caret, shared tint or notch). Check with 3 to 5 people that they can say which row the stage is showing; if they cannot, reduce the matrix to five topic tabs with counts.
- Remove the interest meter from under the topic labels for the demo. Keep interest as words in the stage header only; next to progress tiles the meter reads as a progress bar.
- Reclaim vertical slack and raise text sizes. On the hero topic the '+ needs' row leaves about 1 pt spare on a 390x844 phone. Merge the summary line and legend, confirm the screen is a pushed Stack route with no tab bar, bring 10 pt legend and 11 pt '+ needs' text up to at least 12 pt, and verify on the actual demo phone that all eight rows of the unlock wave are visible without scrolling.
- Resolve the tree-versus-DAG cases so the rail never contradicts the matrix: give Prompt injection and guardrails a visible inbound stub from 'Tool use and agents (AI engineering)' instead of showing it as a locked root, and test the Binary-search debugging merge elbow or replace it with a second '+ needs' line.
- Tighten the demo script. The review at '2:12 to 2:25' is the optimistic case (box 1 is due 60 s after card 1, and Focus serves a card every 2 reels); write the fallback branch, keep the map sequence to about 20 s, steer to Core components (the only root that unlocks 6; others unlock 2 or 3), check that a second Core components reel at slot 4 passes the no-repeat filter, and confirm Focus mode, demo clock and Reduce Motion off before presenting.
- Settle the gap-session wording with PLAN.md before building: 15 of 40 concepts have two or more unmet ancestors and cannot be reached in 6 items, and one correct check leaves a prerequisite Checked, so the tapped concept stays locked. The dock must say where the session starts and where it stops, and the plan must confirm that a session may serve a still-locked target.
- Add a seeded sample profile for the states the 3-minute clock cannot reach (Retained needs box 3, which is minutes away on the demo clock; a due marker rarely survives on the map because the overdue guard serves it in the next slot), and label it clearly as sample data.

## Judge: ergonomics

**Winner:** hybrid (Matrix + Rail). It wins on its own merits for this lens, not for being a hybrid: its main surface is a labelled list of 358x44 pt rows in the thumb zone, which is the only form of the three that keeps full titles, large targets, a linear screen-reader order and growing text at the same time. The graph has bigger targets but its 12 pt two-line labels have no scaling headroom (measured), and the heatmap shows no titles at rest, has sub-44 pt targets for all 40 concepts and a 1.18:1 locked state. The hybrid's defects are real but sit in the secondary matrix and in fixed caps, and each has a direct fix below.

### heatmap: 6/10

Strengths:

- Best large-text path of the three: dock and Outline text scale to 1.6x and the screen opens in Outline (52 pt rows, full titles) automatically at font scale 1.5 or more.
- Most rigorous non-colour encoding: three independent channels (fill level, outline, corner flag), grey rather than sky for Seen, only sky/amber/neutrals carry meaning. I recomputed its contrast claims against #0B1220 and they hold (7.70, 6.76, 11.23, 16.32; amber vs sky 1.00).
- Selecting is free and the only committing control is a 50 pt full-width button in the bottom thumb zone; the Next up rows put 44x44 play buttons in the dock, so the demo path can be driven from the bottom 300 pt.
- Screen reader design is thorough: 40 real buttons with label plus value that names prerequisites, lane labels as headers, focus moved to the dock with sendAccessibilityEvent, a spoken equivalent for the replay.
- Only concept that handles Reduce Motion explicitly for Reanimated CSS transitions (AccessibilityInfo.isReduceMotionEnabled plus reduceMotionChanged) instead of assuming the library follows the system setting.
- No pinch, pan or long-press.

Weaknesses:

- Zero concept titles are visible at rest: 40 unlabelled cells, one title at a time in the dock after a tap or slide. On 'legibility of 40 labelled items' the Map view is the weakest; the labelled alternative is a separate mode behind a 136x32 pt control (32 pt high) in the top-right corner, the hardest spot to reach.
- Every concept's only direct target in the Map view is under-size: 37x44 pt at 390, 33x44 at 360 dp (37 dp pitch against Android's 48 dp) with 4 pt gaps. It passes WCAG 2.5.8 but the compensation is a path gesture (lane slide) whose start cells sit at x 16-53, next to the system back-swipe edge on both platforms.
- Locked slots are 1.18:1 (verified). On a fresh profile 34 of 40 interactive buttons fail the 3:1 non-text minimum; the fix is an optional setting that is off by default.
- Selection dims other cells to 35% opacity: the ready outline falls to about 1.97:1 and a learned fill to 2.40:1 (computed), so context disappears for low-vision users exactly when they are orienting.
- Fixed-height dock contradicts the text-scaling claim: selected content is 238-262 pt in 265 available (3 pt slack). At 1.3x the 20 pt title of the longest concept runs to 3 lines (measured), and nothing says what happens between 1.0x and the 1.5x Outline switch.
- Lanes 1-2 (y 155-311) are in the stretch zone for one-handed use; the due flag is a 10 pt colour dot with no glyph; box 4 is two ticks inside a 37 pt cell.
- VoiceOver swipe path is about 45 stops before the dock, and where focus returns after closing the dock is not specified.

### graph: 6.5/10

Strengths:

- Best touch targets by a wide margin: 44 pt discs with whole-cell hit areas. My check of the coordinates gives a smallest cell of about 80x88 pt (73 dp wide at 360 dp), not the claimed 104 everywhere, but still far above 44 pt / 48 dp.
- Eight concepts are labelled in place with their edges visible without any selection; nothing needs pinch or pan.
- Cleanest contrast at rest: no deliberately sub-3:1 state. Locked dashed ring is 3.93:1 on #0B1220 and dashed versus solid ring is a real non-colour cue.
- Best due encoding: 18 pt amber badge with a clock glyph and a dark separator ring, so it never depends on amber against sky.
- Numbered badges (1, 2, 3) on unmet prerequisites encode the path with numerals, not just highlight and dimming.
- The in-feed result card stays until the learner swipes, so there is no timed auto-dismiss for slow readers or screen-reader users.
- Good screen-reader model: node value states what it needs and opens, topological focus order, topic cards as tabs, List alternative. Canvas swipe gives a thumb-zone way to change topic.

Weaknesses:

- Dynamic type is the weakest of the three. Labels are 12 pt, centred, two lines, in hand-tuned slots. Measured in Helvetica Neue semibold: 'Hallucinations' is 79.8 pt in an 80 pt slot at default size (its neighbour is 80 pt away and sits 40 pt from the canvas edge) and 104 pt at the claimed 1.3x cap; 'Retrieval-augmented' is 154 pt in a 130 pt slot; four long titles go to 3 lines and run into the 16 pt bus gutter. Real headroom is about 1.0-1.1x, and the List fallback is only 'offered', not automatic.
- At 360 dp the canvas scales by 0.916 but text does not, so the tightest slots shrink to about 73 dp and labels clip even at default size.
- The whole-map overview is 8 pt dots (4 pt when locked): five levels are not distinguishable at that size, open versus seen is a white ring versus a sky ring (hue only), and concepts in the strip are not individually tappable.
- Only 8 of 40 at full size; the topic strip (y 95-183), Key and List (y 47-91) and the root node of every tree (y about 217, the first thing tapped) all sit in the hardest zone for one-handed use.
- Selection dims off-path items to 45%: muted locked labels fall to 2.49:1 and white labels to 4.28:1 (computed).
- The expanded dock (about 520 pt) covers the canvas, so the numbered path and its list cannot be seen together; cross-topic ancestors are hidden behind a small '+3 in React+TS' pill of unspecified text size.
- Reduce Motion path does not address whether CSS transitions or the SVG dash animation follow the system setting.

### hybrid: 7.5/10

Strengths:

- The primary reading and tapping surface is a list: 8 full titles at 14 pt, left-aligned, in 358x44 pt rows at y 335-723, with the 48 pt Start button directly below. The whole act path is in the one-handed thumb zone and the screen opens with the suggested gap already selected.
- List rows are the most robust form for text scaling. Measured: every title still fits two lines at 1.3x even at the deepest indent (the 36-character title in 198 pt); rows simply grow and the stage scrolls.
- Cleanest screen-reader path: the matrix is exposed as 5 tabs with the 40 tiles hidden, then 8 buttons with state and prerequisites in words, then the dock and Start. About 16 stops in overview, detail, action order, and swipe order equals visual order.
- No sub-3:1 state at rest (locked dot 3.93:1 on the background, 3.28:1 on the stage; verified), six distinct shapes that survive greyscale, and state words in the rail ('Learned', 'New', clock plus 'Due') backing the shapes.
- Honest about its small targets: every 22 pt tile has a full-size equivalent on the same screen, which is the WCAG 2.5.8 Equivalent exception, and a mis-tap commits nothing.
- No pinch, pan or long-press; press-and-slide is a shortcut only.

Weaknesses:

- No large-text path at all: rail and dock cap at 1.3x, matrix labels at 1.2x, and accessibility sizes simply clamp. The 1.2x cap does not even fit its own column: 'Problem solving' measures 93.5 pt at 13 pt and 112 pt at 1.2x in a 100 pt column ('Systems design' 111 pt).
- The layout fills 844 pt with 9 pt to spare and the dock is a fixed 72 pt for three text lines plus a 48 pt button, so any text scaling or a tab bar causes clipping.
- Text below platform minimums: 10 pt legend words, 11 pt '+ needs' lines (which are tappable) and eyebrow, 12 pt summary.
- Matrix targets: tiles are 24x36 pt hit areas at 390 (the bare 2.5.8 minimum) and 20x36 at 360 dp (below it); topic rows are 36 pt high with no spacing, and they are the only way to switch topic, at y 119-299 in the hardest reach zone.
- Due on a tile is a 7 pt amber dot at 1.0:1 against sky with no glyph; too small to rely on shape and position.
- Selection and replay dimming break contrast: rail rows at 50% put muted locked titles at 2.66:1 (white titles 4.69:1); matrix tiles at 35% put the sky outline at 2.40:1 and the locked dot at 1.49:1 (computed).
- The matrix is ordered by depth tier and the rail depth-first, so the same concept has a different ordinal position in the two views and a 2 pt ring on a 22 pt tile is the only link.
- 34x3 pt interest meter is too thin to perceive; the 92 pt Start button is right-aligned (cross-thumb for left-handed use); the first-check chip in the feed auto-fades at 2.6 s; only the replay sets Reduce Motion explicitly, the ordinary CSS transitions do not.

### Ideas to graft onto the winner

- From heatmap: an automatic large-text mode. Above a font scale of about 1.35-1.5, collapse the matrix to a compact 5-tab topic row and let the rail scroll with text scaling to at least 1.6x. The hybrid's rail is already an outline, so this is a layout switch, not a new screen.
- From heatmap: wire Reduce Motion explicitly for every Reanimated CSS transition (AccessibilityInfo.isReduceMotionEnabled plus the reduceMotionChanged listener), not only for the replay.
- From heatmap: keep availability on its own channel (outline presence) so a concept that is 'checked but still locked' is drawable on the tile, instead of only being explained in the dock.
- From heatmap: a 'Next up' list of 2-3 numbered suggestions with 44x44 play buttons in the dock, and a full-width 50 pt primary button instead of a 92 pt right-aligned one.
- From heatmap: move screen-reader focus deliberately (sendAccessibilityEvent focus) to the stage header on topic change, and give the stage header the header role.
- From graph: the due badge with a clock glyph and dark separator ring (as large as the tile allows, at least 10 pt), plus a per-topic due count with the clock in the matrix count column.
- From graph: numbered badges (1, 2, 3) on unmet prerequisites in the rail when a concept is selected, so the path is marked positively by numerals instead of by dimming everything else.
- From graph: the in-feed result stays until the learner swipes on; no 2.6 s auto-fade.
- From graph: horizontal swipe on the stage card to page between topics, so topic switching is possible from the thumb zone; the matrix rows stay as the tap and screen-reader alternative.
- From graph: put the legend behind a 'Key' button and spend the freed 30 pt on taller matrix rows.

### The winner must fix

- Text scaling: remove the 1.2x/1.3x caps on rail and dock (allow at least 1.6x), make the stage a scroll view from the start, give the dock a minimum height instead of a fixed 72 pt, and add the automatic large-text layout. Fix the topic label column now: 'Problem solving' is 112 pt at 1.2x in a 100 pt column.
- Minimum text size 11 pt everywhere, 12-13 pt for anything tappable. The 10 pt legend goes behind a Key button; the 11 pt '+ needs' line either becomes part of a row at least 44 pt high or moves into the dock.
- Matrix targets: topic rows to 42-44 pt high (use the legend's 30 pt). Guarantee a tile pitch of at least 24 dp at 360 dp (shorter topic names free about 24 dp of label column), or at that width treat a matrix tap as row-level only and keep per-tile picking for press-and-slide.
- Due flag: replace the 7 pt dot with a larger badge that has its own shape or glyph and a dark ring; never depend on amber against sky (1.0:1). Check it and the seen-versus-checked shapes in greyscale and a colour-blindness simulator at 18-22 pt.
- Dimming: do not use opacity to push text under 4.5:1 or glyphs under 3:1. Muted titles on the stage need at least 80% opacity to stay at 4.5:1 (computed), which is too little dimming to read as dimming; mark the chain positively instead (bar, thicker connector, numbers).
- Use one order for the matrix and the rail, or the 2 pt selection ring on a 22 pt tile is the only link between the two views.
- Add a thumb-zone way to change topic (swipe on the stage or previous/next controls in the stage header); the matrix at y 119-299 is the only switch today.
- Screen reader details: wrap the five rows in a tablist, announce state changes with announceForAccessibility, throttle the polite live region so the post-replay retarget does not double-speak, and when the dock expands to 340 pt hide the covered rail rows from accessibility and scroll the selected row into view.
- Low-vision margin: the locked dot and 1.5 pt slate connectors are 3.28:1 on the stage. Lift slate to about #8291A8 (4.88:1 on the stage, 5.85:1 on the background) or switch it when the system contrast setting is on (isDarkerSystemColorsEnabled on iOS, isHighTextContrastEnabled on Android are in the current React Native docs; confirm on 0.86).
- Drop the 34x3 pt interest meter or make it at least 6 pt high; the words in the stage header already carry it.
- Thumb-test on a 360 dp Android phone and an iPhone one-handed before the demo, including press-and-slide next to the system back gesture.

## Judge: engineering

**Winner:** hybrid (Matrix + Rail), on build cost rather than on being a hybrid: it is the cheapest of the three at equal function (about 3.5 days core, 5.5-6.5 full) and needs no path routing, no hand-tuned coordinates and no second list screen. As written its implementation plan is less careful than the heatmap's, so the win depends on the must-fix list. All three should hold 60 fps on a mid-range Android if animated views stay under about 100 and only transform, opacity and colour animate; none needs a dev build.

### heatmap: 7/10

Strengths:

- Best layout discipline of the three: layout.ts derives every x/y/w/h from window width alone, nothing uses onLayout, and cells and the SVG overlay share the same numbers. Its invariants hold against content/software-engineering/graph.json (I recomputed: 38 prerequisite edges, 35 in-topic, 3 cross-topic and all 3 between adjacent lanes).
- Animates only transform, opacity and colour (fill is scaleY with transformOrigin bottom); no animated SVG props; the path overlay is one static SVG mounted only during a selection.
- Replay by Reanimated CSS transitionDelay is the least animation code of the three; transitionDelay is documented for Android and iOS.
- Library risk is low: every version quoted matches Expo SDK 57's bundledNativeModules.json (reanimated 4.5.1, worklets 0.10.1, svg 15.15.4, gesture-handler ~2.32.0), all in Expo Go, no dev build.
- States an explicit cut order and a zero-cost fallback for the path lines (role marks without lines).
- Handles Reduce Motion explicitly through AccessibilityInfo, which is needed: Reanimated documents its ReduceMotion setting only for withTiming/withSpring and layout animations, not CSS transitions.

Weaknesses:

- Largest build surface: grid, two-mode dock, Next-up ranking with pins, path overlay with cross-lane elbows, lane-slide gesture, a second Outline view, a feed chip at two scales, and a legend with live counts. The 6-day figure is optimistic; I estimate 7-8 days to build well on both platforms.
- The 4.5-day cut removes Outline, which is the design's only labelled view and its large-text fallback, so the cheap version is weaker than it looks.
- About 80-90 animated views on the map (40 cells x wrapper + fill, plus rings and badges), close to Reanimated's guideline of 100 on low-end Android; selection dims 30+ of them at once.
- A 1-second ticker re-renders the screen while focused, and the lane slide sets React state on every cell crossing (grid, dock and overlay re-render). Pan plus Pressable coexistence is untested.
- 'The replay is just a snapshot swap' understates it: headline, lane counters, legend counts, '+6 new' and pins still need a JS timeline.
- Each cell has about 12 overlay sub-states across three channels (dot, half, tick, double tick, 45% locked-with-level, haloed badge, pin, ring, stop dot, arrowhead, dashed outline, hairline). The fill needs overflow hidden, so rings and badges must live in sibling layers; many combinations to check on device.
- Vertical fit is tight on a 360x800 dp Android: compact mode needs about 725 dp plus system bars, which overflows with 3-button navigation, and the scroll fallback then competes with the lane pan.

### graph: 4.5/10

Strengths:

- Lowest live view count: 8 nodes and at most 8 paths on the canvas, large touch targets, tap only.
- No runtime layout engine; layout is static data with a Vitest validator.
- All libraries are in Expo Go at SDK 57 versions, and it names a fallback for the travelling line (a lit copy revealed by a clip view).

Weaknesses:

- Layout is hand-tuned data, not logic: 40 node coordinates, polylines with lengths, label widths and ports. Tests can check presence and bounds but not label collisions, and every graph change means re-laying out a topic by hand.
- Uniform scaling by (width-32)/358 shrinks positions but not the 12 pt labels. At 360 dp the column distance is about 109 dp against 104-136 pt label widths, and Android font metrics differ from iOS, so two-line titles need per-topic tuning on device.
- The hero beat depends on animated SVG strokeDashoffset through useAnimatedProps, sequenced trunk, bus, drops over shared bus segments. That needs per-segment paths and lengths; the author has not run it on a device.
- Eleven SVG instances (5 canvases in a pager, 5 strip thumbnails, 1 in-feed mini-graph) for a screen the demo shows for 10-40 seconds.
- Still needs a separate List view (1 day) for accessibility and large text, so two screens get built.
- Highest cost: 7 days claimed, 8-10 by my estimate; the author concedes a grid is 2-3 days cheaper.
- Fixed 92 pt row pitch: the Systems design tree needs 5 rows (about 450 dp), which does not fit a 360x800 dp phone with 3-button navigation.
- Locked, the default state for 34 of 40 nodes, is a dashed circular border; that needs a device check on Android or has to move into the SVG layer.
- Says 'no gesture handler' but specifies a draggable dock, so it needs PanResponder or the claim is wrong.

### hybrid: 7.5/10

Strengths:

- Smallest build with the same function: the rail is plain flex rows, so React Native lays out full titles with no text-fit work, no edge routing and no cross-lane geometry.
- The rail is itself the labelled, 44 pt, screen-reader path, so no second Outline or List screen is needed (0.5-1 day saved against the other two).
- One StateTile component reused at four sizes; at most 8 connectors on screen; the matrix exposes 5 accessibility elements instead of 40.
- Layout, display state and gap plan are pure functions in packages/agent with Vitest.
- All libraries are bundled in Expo Go; the withTiming replay has a documented reduceMotion parameter.
- A credible 3.5-day core; I estimate 5.5-6.5 days for the full version.

Weaknesses:

- Rail elbows are positioned from onLayout over variable-height rows (44 or 52 pt, two-line titles, font scale up to 1.3). That costs an extra layout pass, draws connectors a frame late on every topic switch, and cannot be unit-tested.
- The dock animates height (72 to 340), a layout property, against Reanimated's performance guidance.
- Gesture.Pan().minDistance(0) over Pressable rows will compete with taps, and sliding across rows swaps the whole 8-row stage under the finger.
- About 98 animated views if every tile gets a wrapper and a fill (49 tiles), plus rows and connectors: at or over the 100 guideline for low-end Android.
- The vertical budget is exact (9 pt slack on 844 pt). On a 360x800 dp Android the fixed regions and system bars leave about 354-386 dp for a stage that needs 388 or more, so the stage scrolls and the unlock wave can be partly off-screen.
- Two orderings (matrix by depth tier, rail depth-first) mean two layout functions and a mapping to keep in sync; each state change is also drawn twice (matrix tile and rail tile).
- The estimate excludes the Expo Router migration: apps/mobile is still the blank template (App.tsx, no src/app) with none of reanimated, svg or gesture-handler installed.

### Ideas to graft onto the winner

- From heatmap: the no-measurement rule. All geometry comes from a pure function of window size and insets, shared by tiles and connectors, with Vitest invariants (8 concepts per topic, all 35 in-topic edges represented, the 3 cross-topic edges listed).
- From heatmap: replay as 'show the last-seen snapshot, then swap to live state with a CSS transitionDelay per tile', with a short JS timeline only for counters and labels. It replaces per-tile shared values and withDelay chains.
- From heatmap: explicit Reduce Motion handling with AccessibilityInfo.isReduceMotionEnabled plus the reduceMotionChanged listener, switching transition durations by hand.
- From heatmap: one ordering function with a test that the order is prerequisite-safe, used by both the matrix and the rail (or at least a tested one-to-one mapping between the two orders).
- From heatmap: a feed chip that stays mounted, so 40 views are not mounted at the moment of the answer and haptic; animate only its transform and opacity.
- From heatmap: the Android touch note. The row itself carries the enlarged touch area, because Android does not deliver touches outside a parent's bounds and hitSlop will not rescue 18-22 pt tiles.
- From heatmap: the sample-profile switch (Fresh / Day 3 / Week 2) as shared fixtures, so every tile state can be checked on device and in tests without waiting for the clock.
- From heatmap: a written cut order and a no-lines fallback (role marks and dimming only) if connectors misbehave on a device.
- From graph: the edge-coverage validator. A Vitest check that every PREREQUISITE_OF edge is drawn as a primary-parent connector, listed as a '+ needs' line, or transitively implied, and that RELATED_TO de-duplicates to 11 pairs.
- From graph: light connectors with plain views (a lit copy or a colour transition) instead of animating SVG stroke props.

### The winner must fix

- Remove onLayout-positioned SVG from the rail. Draw connectors as per-row guide Views (the file-tree technique: for each row, a flag per indent level for 'ancestor has later siblings' plus an elbow at its own level), computed in buildMapLayout and unit-tested. Connector colour becomes a backgroundColor transition and react-native-svg is no longer needed on this screen. Show Binary-search debugging's second parent as a '+ needs' line like the other three two-parent concepts.
- Make row heights deterministic: 44 or 52 pt decided by layout data, fixed numberOfLines, capped font scale. The stage then needs no measurement.
- Do not animate dock height. Render the expanded panel as an absolutely positioned fixed-height view and animate translateY and opacity. Reanimated's synchronous-UI-props flags are static, off by default, and cannot be changed in Expo Go, so layout-property animation is the likeliest place to drop frames on Android.
- Cut press-and-slide from the first version. If it returns, give the matrix a single gesture owner (taps handled inside the gesture, not by Pressable), limit the slide to one row, and swap the stage only on release.
- Write a pure fit function (window height, insets, font scale) that picks the mode: full, legend behind a Key button, 32 pt matrix rows, or scrolling stage. Test it at 360x800, 390x844, 393x852 and 412x915, with gesture and 3-button navigation. When the stage scrolls, the replay must scroll the changed row into view before the wave.
- Cap animated views. Dim whole matrix rows and rail rows as containers where a whole row dims; give animated wrappers only to tiles that can change in the current replay; keep the total well under 100.
- Use one animation mechanism per property (CSS transitions for tile state, one small timeline for counters), and drive the matrix tile and rail tile from the same displayed-state value so they cannot drift.
- Replace any per-second ticker for due flags with a single timeout scheduled for the next due time.
- Measure on a mid-range Android in a production-like bundle (npx expo start --no-dev --minify, or an EAS preview build). Expo Go in dev mode understates performance and hides nothing a release build would fix.
- Re-plan the estimate: add the Expo Router migration and library installs, build the 3.5-day core first (matrix, rail, dock, snapshot replay, feed chip), then the expanded panel and interest meter.
- Check the dashed related-ring on 18-22 pt tiles on an Android device; if it renders unevenly, use a different mark such as a small dot under the tile.

## Concept (heatmap): Stepped Lanes (heatmap-first knowledge map)

Five topic lanes of 8 cells, each lane broken into prerequisite steps that read left to right; watching only adds a grey dot, blue is earned only by retrieval, and tapping a cell draws its path and names the next step in a fixed bottom dock.

```
+--------------------------------------+
| <  Knowledge map       [Map|Outline] |
| 1/40     .  28 Locked  [ ] 8 Ready   |
| learned  o   2 Seen     =  1 Checked |
|          #   1 Learned  v  0 Retained|
| React Native ***         1/8 +6 new  |
| [#]>[ ][ ][ ][ ][ ][ ]>{.}           |
|  o------o------+--------^            |
| React + TS **. |               0/8   |
| [=]> .  . >(.) .  . > .  .           |
|  o---o---------o                     |
| Problem solving *..            0/8   |
| [o][ ]> .  .  . (.) .  .             |
| AI engineering *..             0/8   |
| [o]> .  .  . > .  .  . > .           |
| Systems design (age of AI) *.. 0/8   |
| [ ]> .  .  . > . > . > .  .          |
|======================================|
|  .  Performance and re-renders    x  |
| Locked. 4 concepts stand before it.  |
| NEEDS  [ ] Lists and virtualization  |
|         .  Memoization (React + TS)  |
| RELATED (Effects) (Time complexity)  |
| [ Start with Components and props ]  |
| 6 items. Stops before this unlocks.  |
+--------------------------------------+
Key: . locked  [ ] ready  [o] seen
[=] checked  [#] learned  v retained
{} selected  () related  > next step
o--^ path drawn only for the selection
```

### Layout

Designed on 390x844 pt (safe area 47 top, 34 bottom). Screen background is flat #0B1220 so the contrast numbers below hold. Nothing scrolls at this size; the overview and the detail are visible together.

REGIONS (y from top)

- 0-47 status bar.
- 47-91 header, 44 pt: back chevron (44x44), title "Knowledge map" 17 pt semibold, right-aligned segmented control "Map | Outline" 136x32.
- 91-147 summary band, 56 pt. Left block (92 pt wide): "1" in 34 pt bold tabular figures, "/40" 17 pt muted, "learned" 12 pt below; the word line becomes "learned, 1 due" with the amber badge when anything is due. Right block (254 pt): the legend doubles as live counts, 3 columns x 2 rows, each item 84x24 = a 14x16 sample cell + count + word, in ascending order: Locked, Ready, Seen / Checked, Learned, Retained. Only box >= 2 counts in the headline.
- 155-545 grid, 390 pt: five lanes of 78 pt each = 18 label line + 4 gap + 44 cells + 12 path gutter.
- 545-844 dock, 299 pt (265 usable + 34 home-indicator inset), surface #13213D, top radius 20, 1 px top border at 8% white. It is a plain view on this screen, not a modal and not a route, so it never covers the grid.

LANES (the heatmap)

- Cell 37x44 pt, radius 8. Gap inside a step 4 pt. Gap between steps 12 pt with a 6 pt chevron in #64748B. Lanes are left-aligned at x=16; row widths are 332-356 pt, so the right edge is ragged on purpose: with the chevrons it tells the eye that a column does not mean the same depth in every lane.
- Cell width formula: w = min(44, floor((W - 32 - 60) / 8)). 360 dp gives 33, 375 gives 35, 390/393 give 37, 402 gives 38, 412 gives 40, 440 gives 43.
- Order inside a lane: prerequisite depth, then position of the first in-lane prerequisite, then file order. Checked against graph.json: with this order all 35 in-topic prerequisite edges run left to right, and the 3 cross-topic ones all connect vertically adjacent lanes.
- Real lanes (">" is a step break):
  1 React Native: Core components > Flexbox layout, Lists and virtualization, Navigation, Platform-specific code, New Architecture, Expo workflow > Performance and re-renders
  2 React and TypeScript: Components and props > State, Typing props > Effects, Memoization, Unions and narrowing > Generics, unknown vs any
  3 Problem solving: Reproduce before fixing, Breaking down problems > Reading error messages, Binary-search debugging, Rubber duck debugging, Time complexity, Trade-offs, When to ask for help
  4 AI engineering: Tokens and context windows > Prompting, Hallucinations, Cost and latency > Retrieval-augmented generation, Structured output, Evals > Tool use and agents
  5 Systems design in the age of AI: Caching > Queues and async work, Rate limiting, Observability > Idempotency > LLM calls as unreliable dependencies > Prompt injection and guardrails, Fallbacks and graceful degradation
- Lane label line: topic name 13 pt semibold, a 12x10 three-bar interest glyph, and right-aligned "1/8" (12 pt tabular, muted) plus "+6 new" in sky after an unlock.

DOCK, DEFAULT ("Next up")

- 24 pt header row "Next up", then 3 rows of 64 pt: numbered pin (1-3), 28x32 sample cell, title 16 pt semibold, reason 13 pt muted ("Just unlocked by Core components", "Review due now", "Opens 3 concepts"), and a 44x44 play button. The same numbers sit as pins on the three cells in the grid.
- Ranking: due cells first, then just-unlocked cells (max one per lane), then ready-but-not-learned cells with the most dependents. Checked cells that are not yet due are left out, because nothing can be done with them yet.

DOCK, SELECTED

- 12 pad; title row 28 pt (20 pt semibold, wraps to 52 pt for the 36-character title) with sample cell and a 44x44 close button; status line 20 pt; path block 76 pt (two columns "Needs" and "Unlocks", up to 2 rows of 30 pt each with full titles, then "+4 more"); related chips row 28 pt; primary button 50 pt full width; one 13 pt honesty line. Total 238 pt, or 262 pt with a wrapped title, inside the 265 available.

SMALLER SCREENS

- Window height under 780: lane 72 pt (label 16, gutter 8) and band 48 pt. Under 700: the grid scrolls and the selected lane is scrolled above the dock.

COMPANION IN THE FEED

- A 76x52 pt map chip at the top right of the feed: the same five stepped lanes at 0.16 scale (marks 6x7 pt). It is the entry to this screen and the place where progress is first shown.

### Encodings

Three separate channels, so a cell can be for example "checked + locked + due" without a new colour. Every state has a shape cue; colour only reinforces. Contrast ratios are computed against #0B1220.

CHANNEL 1, LEVEL = how full the cell is

- Unseen: empty interior.
- Seen: 10 pt centred dot in grey #9AA7BD (7.7:1). Grey on purpose: watching is exposure, not mastery, so it must not look like partial blue.
- Checked (box 1): bottom half filled #0EA5E9 (6.8:1) with a flat edge at 50%, outline in the same colour.
- Learned (box 2): completely filled #7DD3FC (11.2:1), no glyph.
- Retained (box 3-4): completely filled #E0F2FE (16.3:1) with a 14 pt tick in #0B1220; box 4 gets two ticks. The tick is what separates it from Learned, because the two fills are only 1.45:1 apart.
  Rule the legend can state in one line: "Watching adds a dot. Only answering fills a cell."

CHANNEL 2, AVAILABILITY = the outline

- Locked (prerequisites not learned): no outline, slot fill #172238 (1.18:1). Quiet by design, no lock glyph: on a fresh profile 34 of 40 cells are locked and must not read as a wall of locks. If a locked cell already has a level (possible after a gap session), its dot or half fill is drawn at 45% opacity.
- Ready (roots, or all prerequisites learned): 1.5 pt outline #9AA7BD. This is the marked state.
- Just unlocked: 2 pt outline #7DD3FC plus "+N new" in the lane label, until the concept is seen or the next map visit.

CHANNEL 3, FLAGS = corner badges, never fills

- Due for review: 10 pt amber #FBBF24 dot centred on the top-right corner with a 2 pt #0B1220 halo. Amber and sky are 1.0:1 against each other, so amber never touches a sky fill; against the halo it is 11.2:1. Also written out in the dock and in the summary ("1 due"). At most 2 pulses when it becomes due while the map is open, never a loop.
- Next-up pin: 16 pt #F5F7FB circle with a dark numeral on the top-left corner, only while the dock shows "Next up".
- Selected: 2 pt #F5F7FB ring drawn 2 pt outside the cell.
- During a selection: prerequisites keep full opacity and get a stop dot below; direct unlocks keep full opacity and get an arrowhead; related concepts get a 1.5 pt dashed #F5F7FB outline; everything else drops to 35% opacity.
- Hidden for the session ("Not for me"): a diagonal hairline; the dock offers Undo (optional for the demo).

INTEREST

- Not shown in cells. Interest comes from behaviour and mastery from retrieval; mixing them in one cell would blur the product's main claim.
- Shown per topic only: a three-bar glyph next to the lane name with 1, 2 or 3 bars lit (topic interest below 0.4, 0.4-0.6, above 0.6; the onboarding priors 0.3 and 0.7 give 1 and 3 bars). Grey only. Pink is not used for any state because it collapses into the muted grey for red-green colour-blind viewers.

WHAT THE 3-MINUTE DEMO CAN SHOW

- Locked, Ready, Seen, Checked, Learned, Just unlocked, and briefly Due on a checked cell. Retained and "learned and due" cannot occur on the demo clock; they stay in the legend and are shown with a seeded sample profile.

### Prerequisite display

The grid's weakness is that it hides prerequisites. This design shows them in four layers, from always-on to on-demand.

1. AT REST, POSITION. Each lane is cut into steps with a chevron between them, so "left comes first" is visible without any lines. Steps are per lane, not global columns.

2. AT REST, STATE. The outline channel is prerequisite information in summary form: no outline means something earlier is not learned yet; an outline means it is open now. The unlock wave (see progress moment) is that same information changing.

3. ON SELECTION, A PATH LINE (react-native-svg overlay, only for the selected concept).

- In each involved lane one horizontal line runs in the 12 pt gutter under the cells, from the earliest prerequisite to the furthest direct unlock. It has a stop dot with a 6 pt stub under every prerequisite in the chain, a junction under the selected cell, and arrowheads up into each direct unlock. Because prerequisites are always to the left and unlocks to the right, the line never crosses a cell and needs no crossing logic.
- The 3 cross-topic prerequisite edges (Memoization to Performance and re-renders; Structured output to LLM calls as unreliable dependencies; Tool use and agents to Prompt injection and guardrails) are drawn as short elbows through the label line between the two adjacent lanes; that label is dimmed while a selection is active.
- Line colour #F5F7FB, 1.5 pt. Largest case: Fallbacks and graceful degradation, 7 prerequisites across lanes 4 and 5 = two lines and one elbow.
- The line shows the route, not every individual edge; exact direct prerequisites are named in the dock.
- If the lines look cluttered on a real phone, drop them and keep the stop-dot, arrowhead and dimming roles. That fallback costs nothing.

4. IN THE DOCK, NAMES.

- Status line in words: "Locked. 4 concepts stand before it."
- "Needs" column: the direct prerequisites (never more than 2) with their state cell and full title, the lane name added when it is another topic. "Unlocks" column: up to 2 titles and "+4 more".
- Related (RELATED_TO, de-duplicated to the 11 real pairs, 9 of them across topics): no lines. Dashed outline on the related cells and named chips in the dock, for example "Effects" and "Time complexity". Tapping a chip selects that cell.

5. OUTLINE VIEW (the other half of the Map | Outline control). The same 40 concepts as an indented prerequisite outline per topic: 52 pt rows, full titles, 16 pt indent per step, tree rails, state in words, and "also needs Memoization (React and TypeScript)" on the 4 concepts with two prerequisites. This is the labelled tree for anyone who wants to read structure rather than glance at it, and the fallback for large text and narrow phones.

Not built: a whole-graph node-link view. Its widest layer has 20 nodes, which is 17.9 pt per node on this screen.

### Interactions

Principle: selecting is free, acting is explicit. A mis-tap on a 37 pt cell costs nothing, and the only committing control is a 50 pt button.

TAP A CELL

- Selects it: selection ring, other cells dim to 35% in 150 ms, the path line fades in, the dock cross-fades from "Next up" to the concept. Light haptic.
- Tap another cell: selection moves, the dock stays open.
- Tap the same cell, the close button, or empty space: deselect, dock returns to "Next up".

SLIDE ALONG A LANE (supplement, never required)

- Touch a lane and slide sideways: the selection moves cell by cell with a selection haptic tick and the dock title updates live. This is how someone reads all 8 titles of a topic in about two seconds, and it makes up for cells narrower than 44 pt.

LONG-PRESS

- Not used. Everything is reachable by tap; no hidden gesture carries a function.

ZOOM

- No pinch zoom and no panning. Three fixed levels instead: the map chip in the feed (glance), this screen (overview), the dock or Outline (detail).

DETAIL (the dock, not a sheet)

- Title, state in words with box and timing ("Checked, box 1 of 4, review in 40 s"; "Locked. Needs Lists and virtualization and Memoization"), the Needs / Unlocks block, related chips, one primary button, one honesty line.
- Rows in Needs / Unlocks and related chips are tappable and select that concept.

STARTING A GAP SESSION

- The button label is computed from the agent's own gap-session planner, so it cannot promise what the session will not do (3 items per target, capped at 6):
  - Ready cell with nothing unlearned before it: "Start session, 3 items, about 1 min".
  - One unlearned prerequisite: "Start with <prerequisite>, 6 items". Line below: "Ends with a first check on <concept>."
  - Two or more unlearned prerequisites (15 cells on a fresh profile): "Start with <first unmet prerequisite>". Line below: "6 items. Stops before this unlocks." The status line says how many concepts stand before it.
  - Due cell: "Review now, 1 card".
  - Checked but not due: no primary button; text "Comes back in 40 s. Answering early does not count."
  - Learned or retained: secondary button "Rewatch a reel" and the next review time.
- Honesty line where it applies: "One correct answer makes it Checked. It becomes Learned after a second correct answer later."
- Pressing the button pushes the session route with the target and source "map"; when the session ends the app returns here and the replay runs.
- "Next up" rows: tap a row to select its cell; tap its play button to start that session in one tap.

EVENTS TO ADD

- map_opened {changed_count}; map_cell_selected {concept, level, locked, due, via: tap | slide | pin | chip}; gap_session_started gains {source, first_target, planned_items}.

### Progress moment

The mastery store updates the instant a card is answered (this keeps the plan's "heatmap updates immediately" test true). What the learner sees is staged in two places.

A. IN THE FEED, RIGHT AFTER THE ANSWER
The map chip (76x52 pt, top right) opens into a 280x148 pt panel: the stepped lanes at 0.35 scale (marks 13x15 pt) on the left, three text lines on the right.

First correct check (Seen to Checked), 2.2 s in total:

- 0 ms: the tapped option shows Correct; success haptic.
- 120 ms: panel fades and scales in (220 ms).
- 350 ms: the concept's mark fills from empty to half, rising from the bottom over 450 ms, easing cubic-bezier(0.2, 0, 0, 1). Text: "Core components", "Seen to Checked", "Back in about 1 min to make it stick".
- 2000 ms: panel closes (200 ms). The chip keeps the new state.

Correct delayed review (Checked to Learned, with unlock), 2.8 s in total:

- 0 ms: Correct; success haptic.
- 120 ms: panel in (220 ms).
- 350 ms: the mark rises from half to full over 500 ms; the second text line changes to "Checked to Learned".
- 850 ms: one pulse on that mark, scale 1 to 1.2 and back (260 ms).
- 1000 ms: unlock wave. The newly open marks get their outline one after another, left to right, 80 ms apart, 240 ms each, with a soft tick per mark. For Core components that is 6 marks and ends at 1640 ms. Third line fades in: "+6 unlocked in React Native".
- 2600 ms: panel closes (200 ms).

Wrong answer: the level drops one step in 300 ms without a pulse; text "Checked to Seen. Another angle is coming."
End of a reel (Unseen to Seen): the chip mark gets its grey dot with a 200 ms fade and no panel. Watching should not feel like a win.
Tapping the panel or chip opens the map.

B. ON THE MAP, REPLAY ON OPEN
The screen first draws the picture from the learner's last visit, then plays what changed (at most about 2.5 s, never loops):

- 300 ms after the screen appears: unchanged cells dim to 40% (180 ms).
- 480 ms: each changed cell, oldest change first, 120 ms apart: the fill rises to its new level over 500 ms with one ring pulse. When a cell reaches Learned, the headline ticks "0/40" to "1/40" and the lane counter "0/8" to "1/8".
- Then the unlock wave in that lane: slot to outlined cell, left to right, 90 ms apart, 300 ms each, while the legend counts tick (Locked 34 to 28, Ready up by 6) and the lane label gains "+6 new".
- Last 300 ms: cells return to full opacity; the dock's first "Next up" row names a just-unlocked concept and the pins 1-3 appear.
  If the map is already open when something changes, the same per-cell animation plays live.

REDUCE MOTION
No pulse, no stagger, no rising fill: old and new states cross-fade in 200 ms, changed cells hold a white ring for 1.5 s, the counters still change, and the screen reader hears "Core components is now learned. 6 concepts unlocked in React Native."

### Demo story

Setup before presenting: Focus mode, demo clock on, Reduce Motion off (on Android also the developer option "Animation off"), fresh profile.

0:00 Onboarding. Pick React Native. The feed opens; the map chip at the top right shows 40 dim marks with 6 outlined ones in the first position of each lane (two in Problem solving). That is the honest starting picture: 6 ready, 34 locked, 0 of 40 learned.

0:05 Reel 1, Core components. Reason chip: "Because you picked React Native". Tap "More like this". At the end the chip's first mark gets a grey dot.

0:35 Reel 2, Components and props, with the reason "Related to Core components". This is the "feed adapts" beat.

1:05 Card 1, first check on Core components. Correct. The chip opens for 2.2 s: the mark fills to half, "Seen to Checked, back in about 1 min".

1:15 Reels 3 and 4, two other root concepts (swipe one away early to keep time). Two more grey dots.

2:05 Card 2. If Core components is not due yet, this is a first check on Components and props (half fill). In the next slot the overdue guard serves the review: "Review: you learned Core components 1 min ago", with the amber Review chip.

2:20 Correct. The chip opens for 2.8 s: the mark fills completely, "Checked to Learned", then six outlines run along the React Native lane, "+6 unlocked in React Native". This is the moment the audience sees the map fill in for the first time.

2:30 Tap the chip. The knowledge map opens on the old picture and replays: Core components rises to full, the headline ticks to 1/40, the React Native lane lights up 6 cells from left to right, Locked drops from 34 to 28. Result on screen: 1 learned, 1 checked, 2 seen, 8 ready, 28 locked, and three numbered suggestions in the dock.

2:40 Tap the dim cell at the end of the React Native lane. The dock says "Performance and re-renders. Locked. 4 concepts stand before it." A line runs under the lane from Core components through Lists and virtualization, and an elbow comes up from Memoization in the React and TypeScript lane. One tap shows that a graph sits under the grid.

2:50 Tap pin 1 (Lists and virtualization): "Ready. Unlocked by Core components" and the button "Start session, 3 items, about 1 min". Stop here; the session itself is outside the 3 minutes.

Why React Native: learning Core components opens 6 cells at once. Any other root opens 2 or 3, which reads as a much weaker fill.

Backup: a profile switch in the debug menu (Fresh / Day 3 / Week 2, labelled "Sample profile") shows the full range including Retained ticks and Due badges, which the demo clock cannot reach in 3 minutes.

### Accessibility

NOT COLOUR ALONE

- Level is carried by shape (empty, dot, half, full, full with tick), availability by outline, due by a corner badge, related by a dashed outline. Only sky, amber and neutrals carry meaning; that pair survives red-green colour blindness. Pink is not used for state.
- Contrast on #0B1220: ready outline 7.7:1, seen dot 7.7:1, checked 6.8:1, learned 11.2:1, retained 16.3:1, due 11.2:1 against its dark halo, step chevrons 3.9:1.
- Known exception: locked slots are 1.18:1, deliberately below 3:1. The same information is available as the "28 Locked" count in the legend, in every cell's spoken label, and in the Outline view. A "stronger outlines" setting (locked gets a 1 pt #64748B outline, 3.9:1) is a small optional addition.

TOUCH TARGETS

- Cells are 37x44 pt on a 390 pt phone and 33x44 on 360 dp, with a touch area of pitch width x 60 pt. That meets WCAG 2.5.8 (24 px) and Apple's 28 pt minimum, but not Apple's 44 pt default or Android's 48 dp in width. Compensations: selection commits nothing, sliding along the lane corrects a miss, the committing button is 50 pt, and Outline rows are 52 pt. From 412 pt wide the cells are 40 pt or more.

SCREEN READERS

- Every cell is a real button. Label "Flexbox layout, React Native"; value "ready, just unlocked" or "checked, due for review" or "locked, needs Lists and virtualization and Memoization"; selected state set; hint "Shows what it needs and how to start".
- Each lane label is a header: "React Native, 1 of 8 learned, 6 ready, interest high". Reading order is header, then the 8 cells in prerequisite order.
- The line overlay is hidden from accessibility and takes no touches.
- The dock is ordinary content after the grid, so there is no focus trap. When a cell is activated, focus moves to the dock title and its status is read.
- The replay has a spoken equivalent: one announcement summarising what changed.
- The feed chip is a button: "Knowledge map, 1 of 40 learned, 1 due".

TEXT SIZE

- Dock and Outline text scale with the system setting (cap 1.6). Lane labels and legend cap at 1.3 because the grid is fixed. At a font scale of 1.5 or more the screen opens in Outline.

MOTION AND HAPTICS

- Reduce Motion path as described under the progress moment; nothing loops and no sequence exceeds 3 s (WCAG 2.2.2 allows 5 s). Haptics only accompany a visible change and never carry meaning alone.

### Rn implementation

Everything runs in Expo Go on SDK 57. Install from apps/mobile with npx expo install so the versions match Expo Go: react-native-reanimated 4.5.1, react-native-worklets 0.10.1, react-native-gesture-handler ~2.32, react-native-svg 15.15.4, expo-haptics, react-native-safe-area-context. No Skia, no bottom-sheet library, and no Expo Router formSheet (react-native-screens issue #4605: a partial-height sheet renders as Liquid Glass with a touch flare on iOS 26 and Expo Go cannot be patched).

STRUCTURE (routes live in src/app per AGENTS.md)

- src/app/map.tsx plus src/features/map/: layout.ts, selectors.ts, replay.ts, MapGrid, Lane, Cell, PathOverlay, Dock, NextUp, ConceptDetail, Outline, MiniMap.
- layout.ts (pure): builds the five stepped lanes from graph.json and returns x, y, w, h for every concept from the window width alone. Cells and the SVG overlay use the same numbers, so nothing is measured with onLayout. Vitest invariants: every in-lane prerequisite sits left of its dependent (35 edges), the 3 cross-lane prerequisite edges join adjacent lanes, 8 cells per lane. If new content breaks these, the test says so before the drawing does.
- selectors.ts (pure): cellView(mastery, graph, now) gives level, locked, due, justUnlocked; nextUp gives 3 ids; the button label comes from the gap-session planner in packages/agent.

CELLS

- Pressable (accessible button) around an Animated.View with overflow hidden. The fill is a full-size child with transformOrigin "bottom" and scaleY 0, 0.5 or 1, so no layout property is animated.
- Reanimated 4 CSS transitions do the work: transitionProperty [transform, backgroundColor, borderColor, opacity], transitionDuration 500, cubic-bezier(0.2, 0, 0, 1), and transitionDelay = position in the replay x 120 ms (transitionDelay is documented for iOS and Android). The replay is therefore just "swap the displayed snapshot for the live state, with a delay per cell". The pulse is a separate ring view with a one-shot keyframe animation.
- 40 animated views is well under Reanimated's guideline of 100 on low-end Android. Use sv.get() / sv.set() if shared values appear, for the React Compiler.

REPLAY STATE

- A "last seen map" snapshot is stored in the profile next to mastery and kept separate from it. The screen shows the snapshot until the replay ends, then overwrites it. A 1-second ticker runs while the screen is focused so due badges appear on time.

SELECTION, PATH, DOCK

- selectedId is plain React state; roles (prerequisite chain, direct unlocks, related) come from a selector, with RELATED_TO de-duplicated to 11 pairs.
- PathOverlay: one absolutely positioned Svg, pointerEvents none, hidden from accessibility, rendered only while something is selected: at most 2 lane lines, 3 elbows and a few arrowheads. It fades in through its wrapper view; animated SVG props are experimental and not used.
- Slide: one Gesture.Pan().runOnJS(true).activeOffsetX([-6, 6]).failOffsetY([-10, 10]) per lane mapping x to a cell; taps stay on the Pressables.
- Dock: a bottom-anchored view that cross-fades between NextUp and ConceptDetail. Screen-reader focus moves with AccessibilityInfo.sendAccessibilityEvent(ref, "focus") (setAccessibilityFocus is deprecated in the 0.86 docs).
- Android does not deliver touches outside a parent's bounds, so the lane row itself carries the extra 8 pt above and below the cells instead of relying on hitSlop.
- Starting a session: router.push to the session route with target and source "map" (typed routes).

REDUCE MOTION

- The Reanimated docs do not say whether CSS transitions follow the system setting, and useReducedMotion is read once at app start. Use AccessibilityInfo.isReduceMotionEnabled plus the reduceMotionChanged listener and switch the transition config explicitly.

OUTLINE AND FEED CHIP

- Outline is a SectionList reusing ConceptDetail inline. MiniMap reuses layout.ts at 0.16 and 0.35 scale with plain views.

PLAN AND SCHEMA CHANGES NEEDED

- M6 gains the locked / ready / just-unlocked states and the replay snapshot; the event schema gains map_opened and map_cell_selected and three fields on gap_session_started.

EFFORT, about 6 working days

- layout, selectors, tests 0.5; cells, lanes, legend 1; dock, Next up, computed labels 1; selection roles and path overlay 0.75; replay plus feed chip and panel 1.25; Outline 0.5; accessibility, Reduce Motion and tuning on an iPhone and a 360 dp Android 0.75; events, schema, sample profiles 0.25.
- If time is short, cut in this order: lane slide, path lines (keep the role marks), Outline, interest glyph. That leaves about 4.5 days.

### Risks

- Cell width is 33-38 pt on most phones, below Apple's 44 pt default and Android's 48 dp. It is a documented exception covered by free selection, the lane slide and the Outline view; it still needs a thumb test on a 360 dp Android phone, since the APK goes to testers first.
- The evidence does not favour a grid: the one comparative study rated a prerequisite map above a colour grid for choosing what to work on next (4.4 vs 3.8, stated preference from screenshots). This design is justified by phone geometry and the 3-minute demo, not by that study. A five-person 'pick what to work on next' test of Map against Outline would settle it.
- The fill-in moment depends on which root is learned first. Core components opens 6 cells; every other root opens 2 or 3. The demo script has to steer to React Native, or the wave looks thin.
- Timing is tight. The loop closes only in Focus mode and the review can land anywhere from about 2:10 to 2:50, leaving 10-40 seconds for the map. If the review slips past 2:40 the map step gets cut short; rehearse with the scripted flow and keep reels 3 and 4 short.
- A fresh map is 34 dim slots and 6 outlines. That is honest but can look empty in the first minute; the design relies on the unlock wave and the 'Next up' pins to carry it. A sample profile is the backup for showing a fuller map.
- The path line is the least proven part. It is geometrically clean for this graph (prerequisites always left, cross-lane edges only between adjacent lanes), but that holds only while the content keeps those two properties, and it may still look busy on a real phone. The fallback is role marks without lines.
- Gap-session rules clash with the promise of 'tap a gap': the 6-item cap cannot reach 15 of the 40 concepts on a fresh profile, and one correct check leaves a concept Checked and still locked. The dock says so in words, but the plan should confirm this is the intended behaviour.
- Locked slots at 1.18:1 contrast are invisible to some low-vision users. This is a deliberate trade against a wall of 34 outlines; the legend count, spoken labels and Outline carry the information instead.
- Whether Reanimated CSS transitions respect Reduce Motion is not documented, and combining a lane pan gesture with Pressable cells needs testing on both platforms. Both are small but must be checked on device before the demo.
- Plan drift: M6 lists no locked or ready state, the event schema has no map events, and the replay needs a stored 'last seen' snapshot. These need a plan and schema update before M6 starts.
- Showing interest as a three-bar glyph per topic may still be read as progress. If testers confuse it with mastery, remove it; the feed's reason chips already tell the curiosity story.
- Expo Go on the App Store will move to SDK 58 shortly after its stable release (expected mid-October 2026) and drop SDK 57. Turn off auto-update on the demo phone or plan the fallback before the demo date.

## Concept (graph): Branch Map (graph-first: one topic tree at full size, all five trees always in view)

The prerequisite DAG is drawn as five small top-down trees: the selected topic fills the screen as 8 large labelled nodes with every edge visible, a strip of five mini-graphs keeps all 40 concepts in view, and a fixed dock turns any tapped node into a numbered path and a start button. No pan, no pinch, and the unlock visibly travels down the edges.

```
 Knowledge map              Key  List
+------+------+------+------+------+
|  @   |  o   | o o  |  o   |  o   |
| ooo  | . .  | ...  | ...  | ...  |
| ooo  | ...  | ...  | ...  | .    |
|  .   | ..   |      | .    | . .  |
|[RN]  | R+TS | Prob | AI   | Sys  |
| 1/8  | 0/8  | 0/8  | 0/8  | 0/8  |
+------+------+------+------+------+
                (@)
          Core components
     +----+------+-----------+
    (o)   |     (o)         (o)
  Flexbox | Navigation      Expo
   layout |               workflow
     +----+------+-----------+
    (o)         (o)         (o)
 Platform-   Lists and      New
 specific   virtualiz.  Architecture
                 :
                (.)<--[Memoization]
            Performance  (in React+TS)
          and re-renders
+----------------------------------+
| REACT NATIVE   1 of 8 learned    |
| Next: Flexbox layout       Open  |
| Unlocked by Core components.     |
| [ Start: 3 items, about 1 min ]  |
+----------------------------------+
 @ learned  o open  . locked  : unmet
```

### Layout

Designed against content/software-engineering/graph.json. The graph splits cleanly (35 of 38 prerequisite edges are in-topic, no topic has more than 6 nodes in a layer), so the whole DAG is never drawn on one canvas. One screen, portrait, no scrolling.

Regions on 390x844 pt (y from top):

- 0-47 status bar.
- 47-91 header (44): "Knowledge map" 20 pt bold at x=16; right side two 44x44 buttons, "Key" (legend) and "List" (list alternative).
- 95-183 topic strip (88): five cards 66x88 with 7 pt gaps (x 16-374). Each card holds a 54x54 mini-graph of that topic in its real layout (8 pt dots, 1 pt edges), a short name (RN, React+TS, Problems, AI, Systems; 11 pt) and "n/8" learned. This is the whole-map overview: all 40 concepts, always visible.
- 187-647 graph canvas (358x460, x 16-374, flat #0B1220 so label plates match). Five rows at 92 pt pitch, disc centres at y = 30, 122, 214, 306, 398. A node is a 44 pt disc with a 12 pt semibold label below it (2 lines, default width 104, up to 136 where the row has room). Its hit area is the whole cell, at least 104x88 pt. 16 pt gutter between a label and the next row carries the horizontal bus lines.
- 651-810 dock (159, full width, #13213D, top radius 20): topic overline 11 pt, concept title 17 pt, one or two lines of state text 13 pt, one 48 pt button.
- 810-844 home indicator.
  Sum 47+44+4+88+4+460+4+159+34 = 844. On a 360x800 dp Android phone the canvas scales to 328x~450 (row pitch 90, column distance about 109 dp); every target stays above 48 dp.

Rules that keep it uncluttered: at most 3 nodes per row; a 6-node layer wraps into two rows of 3 fed by one bus per row and a single riser in the 15 pt column gutter; in-topic edges are orthogonal and always arrive from above; a prerequisite from another topic is a dashed pill beside the node with a short horizontal arrow (vertical = this topic, horizontal = another topic). The one transitively implied edge (Tokens -> RAG) is not drawn. 37 edges drawn in total, never more than 8 on screen.

Node coordinates (x, y) in the 358x460 space:

- React Native: Core components (179,30) | Flexbox layout (60,122), Navigation (179,122), Expo workflow (298,122) | Platform-specific code (60,214), Lists and virtualization (179,214), New Architecture (298,214) | Performance and re-renders (179,306) with port pill "Memoization, React+TS" at x 212-352.
- React and TypeScript: Components and props (175,30) | Typing props (90,122), State (260,122) | Unions and narrowing (90,214), Effects (209,214), Memoization (310,214) | Generics (45,306), unknown vs any (135,306).
- Problem solving: Reproduce before fixing (104,30), Breaking down problems (254,30) | Reading error messages (60,122), Binary-search debugging (179,122; two drops, one from each root's bus, 8 pt apart), Time complexity (298,122) | Rubber duck debugging (60,214), Trade-offs (179,214), When to ask for help (298,214).
- AI engineering: Tokens and context windows (179,30) | Prompting (104,122), Hallucinations (238,122), Cost and latency (318,122) | Structured output (60,214), Evals (150,214), Retrieval-augmented generation (238,214, label width 130) | Tool use and agents (60,306).
- Systems design: Caching (179,30) | Queues and async work (72,122), Rate limiting (190,122), Observability (298,122) | Idempotency (72,214) | LLM calls as unreliable dependencies (72,306, label 136) with port "Structured output, AI" at x 104-236 | Fallbacks and graceful degradation (72,398), Prompt injection and guardrails (298,398) with port "Tool use and agents, AI" at x 150-270.
  Topics with fewer than 5 rows are top-aligned; positions never move.

### Encodings

Order is carried by shape and fill level; colour only reinforces it (sky and amber have 1.0:1 luminance contrast, and adjacent sky steps are only 1.5-1.7:1 apart).

Node levels (44 pt disc):

- Locked: 1.5 pt dashed ring #64748B (3.4-3.9:1), empty, label in muted #9AA7BD. No lock glyph, because 34 of 40 nodes start locked; the word "Locked" and the reason live in the dock. This is the quiet default.
- Unseen but open: 2.5 pt solid ring #F5F7FB with a 12 pt play triangle, label in #F5F7FB. This is the marked "available now" state.
- Seen: solid ring #7DD3FC with a 10 pt centre dot. Deliberately no fill: watching is not mastery.
- Checked (box 1): ring #7DD3FC, lower half filled #0EA5E9.
- Learned (box 2): full fill #7DD3FC with a dark tick (#0B1220, 11:1).
- Retained (box 3-4): full fill #E0F2FE, double tick, plus a second outer ring 3 pt out. Box 3 vs 4 is stated in the dock only.
- Due (flag, combines with checked/learned/retained): 18 pt amber #FBBF24 badge with a dark clock-arrow glyph at the disc's top-right, separated from the fill by a 2 pt #0B1220 ring, so it never relies on amber-against-sky.
- Selected: 3 pt #F5F7FB outer ring; everything off its path dims to 45%.
- Suggested: a small "NEXT" tag above one node, ring pulses twice then stops.

Edges: met prerequisite (parent learned) = solid 2 pt #7DD3FC; unmet = dashed 1.5 pt #64748B; small chevron at the child end. Related = dotted white arc, on selection only.

Mini-graphs in the strip: locked = 4 pt grey dot, open = 8 pt hollow white ring, seen = hollow sky ring, checked = half-filled, learned/retained = filled; backed by text "n/8" and an amber clock count when anything is due. A 6 pt white dot marks a topic that changed since the last visit.

Interest is not drawn on the map. The map shows mastery only, so nothing a learner merely liked can look like progress. Interest appears as words: in the dock's "Next" suggestion and as one line in the expanded dock ("Interest: high, rewatched twice").

### Prerequisite display

In-topic PREREQUISITE_OF edges are always drawn for the focused topic (at most 8 orthogonal edges, top to bottom), and in miniature for all five topics in the strip.

The 3 cross-topic prerequisites appear as dashed port pills beside their target (Memoization -> Performance and re-renders; Structured output -> LLM calls as unreliable dependencies; Tool use and agents -> Prompt injection and guardrails). A port carries the foreign concept's title, topic tag and a 12 pt state glyph; tapping it selects that concept and offers "Open in React and TypeScript". The outgoing side is shown as an "Also opens" chip in the dock rather than on the canvas.

On selection the graph does the path-finding for the learner: every unmet ancestor gets a numbered badge in the order the gap session will serve them (1, 2, 3), the path edges thicken to 3 pt white, descendants get a thin outline, the rest dims. Ancestors in another topic are summarised on the port ("+3 in React+TS"). Example on a fresh profile: tapping Performance and re-renders numbers Core components 1 and Lists and virtualization 2, and the Memoization port shows +3.

RELATED_TO (11 distinct pairs, stored twice in the file, 9 cross-topic) is never drawn at rest. On selection: the 2 in-topic pairs draw a dotted arc; cross-topic ones appear as chips in the dock and as a dotted ring on the matching dot in the other topic's mini-graph.

### Interactions

Tap is the only required gesture.

- Tap a node: selects it. Dock shows title, state in words, what it needs or opens, and one button. Tap empty canvas to clear.
- Tap a topic card in the strip: switches the canvas (200 ms cross-fade). A horizontal swipe on the canvas does the same as a shortcut (native paging ScrollView).
- Zoom: none by pinch. Zoom is two fixed levels that are both on screen: the strip (all 40) and the canvas (8 at full size).
- Long-press (optional shortcut, 400 ms, light haptic): expands the dock for that node. Same result as tapping the dock title.
- Dock: an in-screen panel, not a native sheet. Collapsed 159 pt; drag or tap its title to expand to about 520 pt with the numbered path as a list (48 pt rows, full titles), opens/related chips, box and next due time, which of the 3 reels were watched, and the legend.
- Nothing selected: the dock shows the suggested gap ("Next: Core components. Opens 6 React Native concepts") chosen as due first, then just unlocked, then open concepts with the most dependents.
- Starting a gap session: the button label is computed from the plan's rules (3 items per target, 6-item cap), never hard-coded.
  Open node: "Start: 3 items, about 1 min", with the note "Checked now, Learned after a second, delayed check".
  Locked node: "Start with Core components (step 1 of 6)".
  Due: "Review now: 1 card".
  Checked, not due: disabled "Delayed check in 0:42".
  The button routes to the feed in gap mode and logs gap_session_started with source "map".

### Progress moment

Two beats, same drawing code.

1. In the feed, the moment a card is answered (does not depend on opening the map):

- 0-150 ms: chosen option turns correct, success haptic.
- 150-450 ms: a 160x120 mini-graph of that concept's topic fades in above the explanation.
- First check (box 0 to 1): 450-850 ms the node's lower half fills; text "Core components: Checked. Delayed check in 1:00".
- Delayed check (box 1 to 2): 450-950 ms the node fills completely and the tick draws; 950-1550 ms the outgoing edges turn from dashed grey to solid sky from the root downward, and each child flips from dashed to a solid white ring, 70 ms apart; text "Core components: Learned. 6 concepts opened", plus a "See map" chip. The card stays until the learner swipes on.

2. On the map (replay on open, driven by a saved last-seen snapshot; the screen opens on the topic that changed):

- 0-200 ms: unchanged nodes dim to 45%.
- 200-800 ms: the changed node fills (600 ms, cubic-bezier(0.2,0,0,1)) with one scale pulse to 1.12.
- 800-1500 ms: the lit line runs down the trunk, along the bus and down each drop (500 ms), and the six children open in a 70 ms stagger (250 ms each).
- 1500-1800 ms: un-dim; strip counter ticks 0/8 to 1/8; dock reads "Core components is learned. 6 concepts are open."
  Total under 2 s, plays once. Learning Core components unlocks 6 nodes; the other roots unlock 2-3, so the demo script steers to React Native.

### Demo story

Empty profile, Focus mode, demo clock, onboarding pick React Native.

- 0:00 Optional 5-second look at the map: one bright open ring at the top of the React Native tree, seven quiet dashed nodes below it, one open root in each mini-graph. Dock: "Next: Core components. Opens 6 React Native concepts."
- 0:05 Reel 1, Core components. Its node gains the centre dot (seen).
- 0:35 Reel 2. A rewatch or "More like this" changes the next pick; the reason chip can read "Related to Core components" (Components and props).
- ~1:05 Card 1, first check on Core components, answered correctly. In-feed mini-graph: node half-fills, "Delayed check in 1:00".
- 1:10-2:10 Two more reels.
- ~2:10-2:45 Core components returns ("Review: you learned Core components 1 min ago"). Correct answer: in the mini-graph the node fills, the trunk lights, six nodes open. Next reel's reason: "Unlocked by Core components".
- ~2:50 Open the map. The replay shows the same unlock at full size; strip reads RN 1/8. Tap Performance and re-renders: Lists and virtualization is numbered 1, the Memoization port shows +3, dock says "Locked. 4 concepts come first (1 here, 3 in React and TypeScript). Start with Lists and virtualization." Stop there; the button is the entry point, the session itself is outside the 3 minutes.
  Not reachable in 3 minutes: retained (box 3 needs 4+ minutes), and a due badge sitting on the map (the overdue guard serves the review within one slot). A seeded "returning learner" profile shows the full ramp if wanted.

### Accessibility

- Every node and port is a real Pressable: role button, label "Lists and virtualization, React Native", value text such as "locked, needs Core components" or "learned, review due", selected state. Because a screen reader cannot see edges, each node's value also states what it needs and what it opens. Focus order follows topological order, row by row.
- Topic cards: role tab, "React Native, 1 of 8 learned, 6 open, none due".
- The SVG edge layer is hidden from accessibility and takes no touches.
- List view (header button): the same data as a sectioned list, due first, then open, then locked; same dock. It is also the route for large text: node labels cap at 1.3x Dynamic Type, beyond that the List is offered.
- No state depends on colour: dashed ring, solid ring, dot, half fill, full fill with tick, double ring with double tick, badge with glyph. Rings and fills are at least 3.4:1 on the background; labels 6.6-17:1.
- Targets: nodes at least 104x88 pt, topic cards 66x88, buttons 48 high, header buttons 44.
- Reduce Motion: no scale, stagger or travelling line; changed nodes cross-fade in 250 ms and keep a white ring for 1 s, counters still update, and VoiceOver/TalkBack hears "Core components is now learned. 6 concepts opened in React Native." Nothing loops; the NEXT pulse runs twice. Haptics only reinforce.

### Rn implementation

All of it runs in Expo Go on SDK 57; install with `npx expo install` from apps/mobile.

- Libraries: react-native-svg 15.15.4 (edge layer only), react-native-reanimated 4.5.1 with react-native-worklets 0.10.1, expo-haptics. No Skia, no gesture handler, no pan/zoom library, no native sheet.
- Structure: nodes, ports, strip cards and dock are plain Pressables/Animated.Views positioned absolutely over one non-interactive SVG. 8 nodes plus at most 8 paths per topic, five topics mounted.
- Layout data: a static file next to the graph (for example content/software-engineering/map-layout.json): per topic, node x/y/label width in the 358x460 space, each edge as an orthogonal polyline with its length, and ports. Hand-tuned once for the 5 topics (coordinates above). A Vitest check asserts every concept has a position, every PREREQUISITE_OF edge is drawn or transitively implied, labels stay inside the canvas, and RELATED_TO is de-duplicated to 11 pairs. Runtime scales by (width-32)/358.
- State: one pure selector turns profile + graph into per-node display state (level, due, locked, unmet ancestors in order, suggested next, button label), unit-tested. A separate persisted last-seen snapshot drives the replay, so mastery state itself still updates immediately (M6 acceptance holds).
- Motion: node changes via Reanimated 4 CSS transitions on backgroundColor, borderColor, opacity, transform; the half fill is a scaleY with transformOrigin bottom. The travelling line is strokeDashoffset on an animated Path via useAnimatedProps (documented for Reanimated 4, Android and iOS). Fallback if that misbehaves on a device: reveal a lit copy of the edges with a top-to-bottom clip view. Dock height is a Reanimated transition.
- The in-feed mini-graph and the strip thumbnails reuse the same graph component at a smaller scale.
- Dock is in-screen rather than an Expo Router formSheet because of the open iOS 26 partial-sheet glare issue (react-native-screens #4605).
- Plan changes needed in docs/PLAN.md: M6 wording (heatmap with topic rows becomes this map; add open/locked display states), and events map_opened and map_node_tapped.

Effort: about 7 working days. Layout file and validator 1; graph component with states, ports, edges 1.5; strip, dock, selection, numbered path, computed button labels 1.5; replay, in-feed mini-graph, Reduce Motion path 1.5; List view, accessibility labels, Android pass 1; device polish 0.5. A demo-only cut without List view, related arcs and swipe paging is about 5 days. A 5x8 grid would be roughly 2-3 days cheaper.

### Risks

- Only 8 of 40 concepts are at full size at once. The whole-map view is the strip, where the five levels are harder to tell apart at 8 pt, so 'the map fills in' is strong inside one topic and weaker across all five than a 40-cell grid would be.
- The verified research leans the other way: it recommends a grid overview with graph structure on demand. The support for graph-first is one perception study (prerequisite map 4.4 vs grid 3.8, 33 students, screenshots) plus Math Academy shipping a learner-facing graph. Nothing tests either on phones with working developers.
- Wrapped layers (React Native and Problem solving have 6 nodes in one layer, shown as two rows of 3) may be read as two levels. The bus-and-riser routing is meant to prevent that but needs a check with 3-5 testers.
- Cross-topic chains are compressed into a port pill ('+3 in React+TS'). A learner looking at Performance and re-renders does not see those three concepts until they tap the port or expand the dock.
- The five layouts are hand-tuned to today's graph. Adding a concept or edge means re-laying out that topic; the validator catches drift but does not fix it. d3-dag 1.2.2 could generate layouts later.
- Labels are 12 pt, two lines, under the nodes. Four titles of 30-36 characters only fit because their rows are sparse; an optional short title in graph.json would make this safer. Large Dynamic Type falls back to the List view.
- Demo timing: Learned is only reachable inside 3 minutes in Focus mode, and the 6-node unlock only happens if Core components is the concept that gets the delayed check. Retained and a due badge on the map will not appear without a seeded profile.
- The gap-session rules in PLAN.md conflict with what a tap implies: 6 items cover two targets, 15 concepts have two or more unmet ancestors, and one correct check only reaches Checked, so the tapped node stays locked. The dock states this honestly, but the plan should say whether a gap session may serve concepts that are still locked.
- The travelling-line animation depends on animated SVG props in Expo Go; it is documented but I have not run it on a device. Reduce Motion, or Android's 'Animation off' developer option, turns the hero beat into a cross-fade, so check the demo phone's settings.
- About 7 days of work against roughly 4-5 for a grid, on a screen the demo shows for 10-40 seconds.
- Project-wide: the App Store Expo Go is expected to move to SDK 58 around mid-October 2026 and drop SDK 57; turn off auto-update on the demo iPhone.

## Concept (hybrid): Matrix + Rail

A fixed 5 x 8 mastery matrix shows all 40 concepts at a glance and doubles as the selector for one topic, which is drawn below it as a labelled prerequisite rail (a git-log style tree with full titles), with a one-button dock for the gap session, so overview, structure and action share one screen with no sheet, pan or zoom.

```
 <  Knowledge map      1 of 40 learned
 0 checked  2 seen  9 open  0 due
 --------------------------------------
 |React Native ===  #  oooooo  .   1/8
  React + TS   =--  *  ..  ...  .. 0/8
  Problem solv.=--  oo  ......     0/8
  AI engineer. =--  *  ...  ...  . 0/8
  Systems des. =--  o  ...  .  .  .. 0/8
 .lock o open *seen h chkd # lrnd V kept
 --------------------------------------
  REACT NATIVE  1 of 8  interest high
  # Core components            Learned
  |-o Flexbox layout               NEW
  |-o Lists and virtualization     NEW
  | '-. Performance and re-renders
  |     + Memoization (React + TS) >
  |-o Navigation                   NEW
  |-o Platform-specific code       NEW
  |-o New Architecture             NEW
  '-o Expo workflow                NEW
 --------------------------------------
  SUGGESTED NEXT             ________
  o Flexbox layout          | > Start|
  Just unlocked, 3 items     --------
 ======================================
 KEY  === interest (topic only)
 . locked  o open  * seen  h checked
 # learned  V retained  ! due (amber)
 |-  prerequisite edge (rail only)
```

### Layout

Why this combination: the matrix does what a heatmap is good at (40 states, stable positions, one glance) and the rail does what a graph is good at (titles, who-needs-what, path to a gap) for 8 nodes at a time. The graph's own shape allows it: 35 of 38 prerequisite edges stay inside a topic, and a tree list is the only form that fits full titles (up to 36 characters) for every topic at 390 pt.

Assumes a Stack screen with no tab bar; 390 x 844 pt, safe area 47 top / 34 bottom, 16 pt side margins (content 358 pt). Nothing scrolls at this size.

1. y 47-91, header (44 pt): back chevron (44 x 44), title "Knowledge map" 17 pt semibold, right-aligned headline "1 of 40 learned" (only box >= 2 counts).
2. y 91-113, summary line (22 pt): "0 checked · 2 seen · 9 open · 0 due", 12 pt.
3. y 119-299, overview matrix (180 pt): 5 topic rows x 36 pt. Row = 3 pt selection bar; 100 pt label column ("React Native", "React + TS", "Problem solving", "AI engineering", "Systems design", 13 pt) with a 34 x 3 pt interest meter under the label; 218 pt tile zone with 8 tiles of 22 x 22 pt (radius 5), ordered by global prerequisite depth, 2 pt gap inside a depth tier and 8 pt between tiers; 24 pt count column ("1/8"). Tier patterns from graph.json: React Native 1|6|1, React + TS 1|2|3|2, Problem solving 2|6, AI 1|3|3|1, Systems 1|3|1|1|2 (widest row 214 pt). Left means foundations, right means advanced.
4. y 299-329, legend (30 pt): 7 columns of 51 pt, a 12 pt glyph over a 10 pt word: Locked, Open, Seen, Checked, Learned, Retained, Due.
5. y 335-723, stage card (388 pt, surface #16233F, radius 16): 36 pt header (topic title, "1 of 8 learned", "Interest: high"), then the selected topic's 8 concepts as rows of 44 pt minimum in depth-first order. Row = 20 pt indent per level (max level 4), 22 pt state tile on the rail, 10 pt gap, title 14/17 pt on up to 2 lines, 44 pt trailing slot ("New", or clock + "Due"). The four rows with a second or cross-topic prerequisite get an 11 pt "+ needs ..." line and may grow to 52 pt (9 pt of slack is reserved).
6. y 729-801, dock (72 pt, surface #1C2B4A, radius 20): 28 pt state tile, three text lines (11 pt eyebrow, 15 pt title, 12 pt reason), a 92 x 48 pt "Start" button, and a 36 x 4 pt grabber.

Other sizes: at 360 dp wide the tiles become 18 dp; at 402 pt and wider, 24 pt. Rail row height = clamp(40, (stage height - 36) / 8, 48); below that only the stage scrolls. If the shell insists on a tab bar here, move the legend behind a "Key" button and let the stage scroll about 20 pt.

### Encodings

One tile component is used in the matrix (22 pt), the rail (22 pt), the dock (28 pt) and the in-feed chip (7 pt). Level is carried by shape first and lightness second, in one hue. Contrast figures are computed against the stage surface #16233F and the darkest background #0B1220.

- Locked (a prerequisite is not learned): a 6 pt dot, slate #64748B (3.3-3.9:1), no box. This is the quiet default, because 34 of 40 concepts start locked; no lock glyph on the map. In the rail the title is muted #9AA7BD, regular weight.
- Unseen and available, labelled "Open": empty rounded square with a 1.5 pt sky #7DD3FC outline (9.4-11.2:1). This is the marked state: a fresh map is 6 bright outlines in the left tier. Rail title #F5F7FB, medium weight.
- Seen: the same outline plus an 8 pt centre square. No fill, so watching never looks like mastery.
- Checked (box 1): outline plus the bottom half filled with #0EA5E9 (5.6-6.8:1).
- Learned (box 2): solid #7DD3FC.
- Retained (box 3-4): solid #E0F2FE with a dark tick #0B1220 (16.3:1). Box 3 versus 4 is words only, in the dock.
- Due (a flag on checked, learned or retained): a 7 pt amber #FBBF24 dot on the top-right corner, half outside the tile, on a 2 pt ring of background colour. Amber and sky have the same luminance (1.0:1), so the dark ring, the round-on-square shape and the corner position carry it. In the rail: a clock glyph plus the word "Due". The feed's Review chip uses the same amber and clock.
- Started but still locked (possible through a gap session): shows its level shape; the dock says the prerequisite is still pending.
- Selected: 2 pt #F5F7FB ring 2 pt outside the tile, plus a tinted rail row with a 3 pt left bar. On open, the selection is the agent's suggested gap and the dock eyebrow reads "SUGGESTED NEXT".
- Just unlocked: the word "New" in the rail row until the next visit.

Interest is shown at topic level only and never on a tile: a 3-segment neutral grey meter under each topic label (1, 2 or 3 segments filled for interest below 0.4, 0.4-0.65, above 0.65) and "Interest: high" in the stage header. It uses neither sky nor amber. Per-concept interest is not shown. This keeps "interest moves from behaviour, mastery moves from checks" visible as two separate channels.

### Prerequisite display

Edges are drawn only in the stage rail, never in the matrix (28 of 35 in-topic edges would run along a matrix row through other tiles).

At rest, for the one topic on stage: 1.5 pt elbow connectors from each concept to its children, like a file tree or git log. That is 6-7 edges on screen, and 34 of the 35 in-topic edges across the five rails. Stroke is slate #64748B while the child is locked and sky #7DD3FC once the parent is learned, so a branch lights up as it opens. Real rails from graph.json:

- React Native: Core components, with six children (Flexbox layout, Lists and virtualization, Navigation, Platform-specific code, New Architecture, Expo workflow); Performance and re-renders hangs under Lists.
- React + TS: Components and props > State > (Effects, Memoization); > Typing props > Unions and narrowing > (Generics, unknown vs any).
- Problem solving: two roots. Binary-search debugging is placed last under Reproduce before fixing, directly above Breaking down problems, so its second parent is a one-row merge elbow.
- AI: Tokens > Prompting > (Structured output > Tool use and agents, Evals); > Hallucinations > Retrieval-augmented generation; > Cost and latency. The direct Tokens-to-RAG edge is implied through Hallucinations and is not drawn; the dock lists it.
- Systems: Caching > Queues > Idempotency > LLM calls as unreliable dependencies > Fallbacks; > Rate limiting; > Observability; Prompt injection and guardrails stands alone.

The 3 cross-topic prerequisites are an inline "+ needs" line on the row with the other topic's name: Performance and re-renders needs Memoization (React + TS); LLM calls as unreliable dependencies needs Structured output (AI); Prompt injection and guardrails needs Tool use and agents (AI). Tapping the line jumps to that concept.

On selecting a concept:

- Rail: the path from the root to the selection thickens to 2.5 pt #F5F7FB; rows outside the chain drop to 50% opacity.
- Matrix: every prerequisite (up to 7, across topic rows) and every dependent stays at full strength, RELATED_TO neighbours get a dashed 1.5 pt ring, everything else dims to 35%. The matrix is where cross-topic links become visible without diagonal lines.
- Dock: "Needs ..." in words. The expanded panel lists Needs, Unlocks and Related as tappable chips. Related is de-duplicated to the 11 real pairs and appears only on selection.

### Interactions

Tap is the only required gesture. There is no pinch, pan or zoom; "zoom" is three fixed levels on one screen: 40 concepts (matrix), 8 labelled (rail), 1 (dock).

- Tap a matrix row: puts that topic on stage (180 ms cross-fade). If the tap lands on a tile, that concept is also selected. The whole row (358 x 36 pt) is the target; a tile's own hit area is its pitch x 36 pt.
- Press and slide across the matrix (shortcut): selection follows the finger, the stage and dock update live, one selection haptic per tile. This is the title readout for 22 pt tiles.
- Tap a rail row (358 x 44 pt): selects the concept. The dock shows its state in words, what it needs, and the action.
- Tap the dock text or grabber, or tap the selected rail row again: the dock grows from 72 to about 340 pt over 250 ms as an in-screen panel (not a native sheet). It covers the lower rail; the matrix stays visible with the chain highlighted. Contents: 36 pt tile, full title, topic, the one-line summary from graph.json, state with box and next due time, Needs / Unlocks / Related chips (tap to jump), and a full-width 52 pt button. Close with the grabber, a downward drag, Android back, or a tap on the matrix.
- Long-press: unused on purpose, so nothing is hidden behind it.

Starting a gap session: the dock button, with a label computed from the plan's rule (3 items per target, 6-item cap):

- No unlearned prerequisites: "Start", reason line "3 items: intro, one more, a check".
- One unlearned prerequisite: "Start", reason "Starts with Core components, then Flexbox layout · 6 items".
- Two or more: the session cannot reach the tapped concept, so the reason reads "Step 1 of 3: starts with Components and props".
- Due: "Review", reason "Due now · 3 items".
- Learned and not due: no primary button, only "Next check in 2 d".
  The panel always adds: "A correct check makes it Checked. It becomes Learned after one more correct answer later."

Start pushes the session route with the target id and logs gap_session_started with source "map". Opening the map and each selection log the new events map_opened and map_cell_tapped (concept, level, due, source).

### Progress moment

The answer happens in the feed, so the change is shown twice: a chip in the feed at the moment of the answer, and a replay when the map opens.

In the feed, correct answer at t = 0:

- 0 ms: the option locks as correct; success haptic.
- 250-450 ms: a map chip slides in under the status bar (358 x 64 pt). Left: the whole matrix at 7 pt per tile (78 x 47 pt). Right: concept title and a change line.
- 450-900 ms: that concept's mini tile changes level with one scale pulse. The text reads "Seen to Checked · back in about 1 min" on a first check, or "Checked to Learned" on a delayed check.
- 900-1500 ms, only when it became learned: the newly unlocked mini tiles flip from dot to outline, 80 ms apart, and the text adds "6 unlocked in React Native".
- A first-check chip fades at 2.6 s. A learned chip stays while the card is on screen; tapping it opens the map.
- Wrong answer: no pulse; the chip appears only if the level dropped ("Checked to Seen · another angle next").

On the map (replay, about 2.1 s, never loops). The real mastery state updates immediately; the replay is driven by a separately stored "last seen on the map" snapshot.

- 0 ms: the map draws the old snapshot, with the changed topic on stage and the changed concept selected.
- 200-380 ms: the other four matrix rows and unaffected rail rows dim to 45%.
- 400-850 ms: the tile fills from the bottom (half to full) in the matrix and in the rail at the same time, one pulse to 1.25 scale, light haptic; the rail row's label changes from "Checked" to "Learned".
- 900-1740 ms, the unlock wave: each child, 90 ms apart, has its connector turn from slate to sky, its row go from 45% to full, its dot become an outline (300 ms), and "New" appear. The matching matrix tile flips at the same instant. For Core components that is six titled rows lighting up down the rail.
- 1800-2100 ms: dimming lifts; the header rolls "0 of 40 learned" to "1 of 40" and the summary rolls "3 open" to "9 open"; the dock retargets to "SUGGESTED NEXT · Flexbox layout · Just unlocked".
- A first check alone is the 400-850 ms step with an empty-to-half fill, done by about 1.2 s.

With Reduce Motion: no scale or stagger; tiles cross-fade in 200 ms, changed rows keep a highlight outline for 1 s, counters still update, and the screen reader hears "Core components is now learned. 6 concepts unlocked in React Native."

### Demo story

Setup: empty profile, demo clock on, Focus mode, React Native picked in onboarding. Reduce Motion (and Android "Animation off") must be off on the phone.

- 0:00, a five-second look at the map before the first reel: "0 of 40 learned · 6 open". Six bright outlines sit in the left tier and 34 quiet dots follow. The stage shows React Native: Core components is open and the seven titles below it are dim but readable, so the audience sees the road ahead instead of a wall of locks. The dock says "SUGGESTED NEXT · Core components · 3 items". Back to the feed.
- 0:05, reel 1: Core components. The presenter taps "More like this".
- 0:35, reel 2: the feed adapts and serves Components and props with the reason "Related to Core components".
- About 1:05, card 1: first check on Core components, answered correctly. The map chip shows the tile go from Seen to Checked (half fill): "back in about 1 min".
- 1:12 to 2:12: two more reels, for example Tokens and context windows as a new topic, then a second angle on Core components.
- About 2:12 to 2:25, card 2: Core components returns as an amber Review card, answered correctly. The chip shows half to full and six mini tiles flipping open: "Learned · 6 unlocked in React Native". The presenter taps the chip.
- About 2:25, the map replays for 2 seconds: the first React Native tile fills, then six titled branches light up down the rail (Flexbox layout, Lists and virtualization, Navigation, Platform-specific code, New Architecture, Expo workflow). The header ticks to "1 of 40 learned" and "9 open". Final state: 1 learned, 2 seen, 9 open, 28 locked.
- About 2:35: the presenter taps "Performance and re-renders". The dock says "Locked · needs Lists and virtualization and Memoization (React + TS)". In the matrix its five prerequisites stay lit across two topic rows and Effects and Time complexity get dashed rings. That is the graph, shown in one tap.
- About 2:50: tap Flexbox layout, then Start. The gap session opens and the demo ends.

"Retained" and "learned and due" cannot occur inside 3 minutes on the demo clock. To show the full ramp, add a "Load sample progress" debug switch. Core components is the only root that unlocks six; the other roots unlock 2 or 3, so the script must steer to it.

### Accessibility

Screen readers: the matrix is exposed as 5 elements, not 40. Each topic row is a tab (role "tab", selected state) labelled for example "React Native, 1 of 8 learned, 6 open, none due, interest high"; its tiles are hidden from accessibility. The stage exposes the 8 concepts of the selected topic as buttons: label is the title, value is the state in words ("checked, due for review" or "locked, needs Core components"), hint gives the level and prerequisites, plus selected state. Then the dock: a live region (polite) that reads the selection, and the Start button with its full computed label. That is about 16 stops per topic in overview, detail, action order. The rail's SVG layer is hidden from accessibility and takes no touches.

Colour: every level differs by shape (dot, outline, centre square, half fill, full fill, tick), so the map works in greyscale and for red-green colour blindness. Due has its own shape, position and a clock plus the word in the rail. Computed contrast on the stage surface #16233F: text 14.5:1, muted 6.4:1, sky outline 9.4:1, checked fill 5.6:1, locked dot 3.3:1, tick on retained 16.3:1, Start label (dark on sky) 11.2:1.

Targets: rail rows are 358 x 44 pt (48 dp on Android, where the stage may scroll about 30 dp on a 360 x 800 phone); matrix rows 358 x 36 pt; a matrix tile's hit area is at least 20 x 36 pt, below the 44 pt default and at 360 dp below the 24 px minimum. That is acceptable only because every concept has a full-size equivalent in the rail on the same screen. Press-and-slide is a shortcut, never the only route. No long-press, no multi-finger gestures.

Text size: rail titles and dock text scale to 1.3x (rows grow and the stage scrolls); matrix labels cap at 1.2x.

Motion: the replay is under 2.5 s, runs once, and nothing pulses indefinitely. Reduce Motion gets cross-fades, a 1 s outline and a spoken announcement of the change. Haptics only reinforce; they never carry meaning alone.

### Rn implementation

Everything runs in Expo Go on SDK 57. Install from apps/mobile with npx expo install: react-native-reanimated 4.5.1 with react-native-worklets 0.10.1, react-native-svg 15.15.4, react-native-gesture-handler ~2.32, react-native-safe-area-context, expo-haptics, expo-symbols. Not used: Skia, d3-dag, native formSheet (react-native-screens issue #4605 gives partial-height sheets a Liquid Glass flare on iOS 26), shared element transitions (unavailable in Expo Go). The route is src/app/map.tsx; the app is still the blank template, so the Expo Router migration comes first and is not in the estimate below.

Pure TypeScript in packages/agent, tested with Vitest:

- buildMapLayout(graph): per topic, the matrix order and tier breaks (global depth), the depth-first rail rows (level, primary parent, extra prerequisites), ancestor and descendant sets, de-duplicated related pairs.
- displayState(concept, profile, now): locked / open / seen / checked / learned / retained, plus due and just-unlocked.
- gapPlan(target): the session steps and the dock label.

Views:

- StateTile: plain Views. Outline is a border; the fill is an inner View animated with scaleY and transformOrigin "bottom" (not a layout prop); tick and clock from expo-symbols.
- OverviewMatrix: 5 Pressable rows and 40 tiles, with Gesture.Pan().minDistance(0).runOnJS(true) for press-and-slide.
- TopicRail: 8 Pressable rows over one absolutely positioned Svg with at most 8 Path elbows, pointerEvents none, positions from onLayout.
- Dock: an Animated.View whose height is a shared value (72 to 340), with tap and pan on the grabber and BackHandler on Android.
- MapChip for the feed: 40 tiny Views.

Animation: ordinary state changes use Reanimated CSS transitions on backgroundColor, borderColor, opacity and transform. The replay uses withDelay and withTiming (450 ms, bezier 0.2, 0, 0, 1) with an explicit reduceMotion setting, because the Reanimated docs checked today do not say whether CSS transitions honour Reduce Motion. Use sv.get() and sv.set() for the React Compiler. The replay reads a mapSeen snapshot stored in the profile next to, not inside, mastery, so the M6 "updates immediately" test still holds. Animating connector colour through SVG CSS transitions is optional polish.

Plan changes needed: add open and locked to the M6 state list, add map_opened and map_cell_tapped events and a source on gap_session_started.

Effort: about 5 days. Layout, selectors and tests 0.5; tile, legend and matrix 0.75; rail with elbows and highlight roles 1; dock, panel and gap labels 1; snapshot, replay, Reduce Motion and haptics 1; feed chip 0.5; accessibility and a 360 dp Android pass 0.5. The must-have core without press-and-slide, the expanded panel and the interest meter is about 3.5 days.

### Risks

- Density: three stacked regions plus a legend fill 844 pt exactly, with about 9 pt to spare. It could read as a dashboard, not a map. First cuts if testers find it busy: the legend moves behind a Key button, then the interest meter goes.
- Vertical fit depends on there being no tab bar on this screen. With a tab bar, or on phones shorter than about 750 pt of usable height, the stage scrolls and the eight-row unlock wave is no longer fully visible.
- Matrix tiles are 22 pt (18 dp on a 360 dp Android phone), below the 44 pt and 48 dp guidelines. The design leans on the row as the target, the rail as the full-size equivalent and press-and-slide; a tester who tries to tap single tiles may mis-select.
- The matrix is ordered by depth tier and the rail depth-first, so the third tile is not always the third row. The selection ring is the only link. If testers lose the mapping, switch the matrix to the rail order and give up the clean left-to-right tiers.
- The rail is a tree, the graph is not: one in-topic edge is implied instead of drawn (Tokens to Retrieval-augmented generation) and the 3 cross-topic prerequisites are text lines. A learner can miss why a concept is locked until they select it.
- The headline moment needs Core components to be the concept that gets the delayed check (it unlocks 6; other roots unlock 2 or 3) and needs Focus mode. In Light mode the review lands after 3:00. The demo script has to steer this.
- Plan drift: PLAN.md M6 has no open or locked state, no map events, and a 6-item gap-session cap that cannot reach 15 of the 40 concepts from a fresh profile. A gap session can also leave a concept checked while still locked. The plan needs to accept these or define exceptions.
- Reduce Motion on the demo phone, or Android's "Animation off" developer option, turns the replay into a cross-fade. useReducedMotion is read once at app start, so check the setting before presenting.
- The seen state (outline plus centre square) and the half-filled checked state have not been tested with users or on a phone in daylight; the locked dot is deliberately near the 3:1 floor. Verify on device and with a colour-blindness simulator.
- The topic interest meter is small and may be read as progress. It has no research behind it; it is a design judgment and the first thing to cut.
- Expo Go on the App Store is expected to move to SDK 58 around mid-October 2026 and drop SDK 57. Turn off auto-update on the demo phone and decide the fallback before UI work starts.
