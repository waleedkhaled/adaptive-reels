// Design tokens: the single source for colour, type, spacing, motion and the
// reel canvas (DESIGN.md "Status Board"). Imported by the app and by the
// Remotion renderer, so it has no React Native imports. Components never
// contain raw hex values or raw type numbers.

export type Hex = `#${string}`;

/** One family name per font file, identical in the app and in Remotion. */
export type FontFamily =
  'BarlowSC-SemiBold' | 'BarlowSC-Bold' | 'MonoNL-Medium' | 'MonoNL-SemiBold' | 'MonoNL-ExtraBold';

/** File name inside packages/fonts/files for each family. */
export const FONT_FILES: Record<FontFamily, string> = {
  'BarlowSC-SemiBold': 'BarlowSemiCondensed-SemiBold.ttf',
  'BarlowSC-Bold': 'BarlowSemiCondensed-Bold.ttf',
  'MonoNL-Medium': 'JetBrainsMonoNL-Medium.ttf',
  'MonoNL-SemiBold': 'JetBrainsMonoNL-SemiBold.ttf',
  'MonoNL-ExtraBold': 'JetBrainsMonoNL-ExtraBold.ttf',
};

export const color = {
  bg: { base: '#181612', raised: '#22211C', overlay: '#2F2C28' },
  line: { hairline: '#413F39', control: '#88857E' },
  text: { primary: '#F2F0EA', settled: '#D0CCC6', secondary: '#B3B0A9', inverse: '#181612' },
  proven: { dim: '#2BA7BF', base: '#65D5EC', bright: '#B4EAF6', surface: '#0C3037' },
  due: '#EAB44A',
  error: { base: '#EF8377', surface: '#45201C' },
  syntax: { literal: '#B0D9B7', name: '#C1B3DB' },
  /** bg.base at 72%: only under marks that sit on the picture. Primary text only. */
  scrim: '#181612B8',
  groundVideo: { ios: '#181612', android: '#181612' },
  /** Applied when the system "Increase Contrast" setting is on. */
  highContrast: { lineHairline: '#88857E', lineControl: '#B3B0A9', textSecondary: '#D0CCC6' },
} as const satisfies Record<string, unknown>;

export type TypeName =
  | 'display'
  | 'title'
  | 'heading'
  | 'label'
  | 'body'
  | 'option'
  | 'button'
  | 'bodyS'
  | 'sentence'
  | 'rowTitle'
  | 'sentenceStrong'
  | 'caption'
  | 'captionStrong'
  | 'micro'
  | 'dataL'
  | 'dataM'
  | 'dataS'
  | 'pinNumeral'
  | 'tag'
  | 'code'
  | 'codeKeyword';

export interface TypeStyle {
  family: FontFamily | 'System';
  size: number;
  lineHeight: number;
  /** Only with the system font: custom families carry their weight in the file. */
  weight?: '400' | '500' | '600';
  letterSpacing?: number;
  uppercase?: true;
  /** Cap for Dynamic Type on this style; undefined means no cap. */
  maxScale?: number;
}

export const type: Record<TypeName, TypeStyle> = {
  display: { family: 'BarlowSC-Bold', size: 28, lineHeight: 32 },
  title: { family: 'BarlowSC-SemiBold', size: 22, lineHeight: 28 },
  heading: { family: 'BarlowSC-SemiBold', size: 17, lineHeight: 22 },
  label: { family: 'BarlowSC-SemiBold', size: 13, lineHeight: 16, letterSpacing: 0.13 },
  body: { family: 'System', size: 17, lineHeight: 24, weight: '400' },
  option: { family: 'System', size: 17, lineHeight: 22, weight: '500' },
  button: { family: 'System', size: 17, lineHeight: 22, weight: '600' },
  bodyS: { family: 'System', size: 15, lineHeight: 21, weight: '400' },
  sentence: { family: 'System', size: 15, lineHeight: 20, weight: '400' },
  rowTitle: { family: 'System', size: 15, lineHeight: 20, weight: '500' },
  sentenceStrong: { family: 'System', size: 15, lineHeight: 20, weight: '600' },
  caption: { family: 'System', size: 13, lineHeight: 18, weight: '500' },
  captionStrong: { family: 'System', size: 13, lineHeight: 16, weight: '600' },
  micro: { family: 'System', size: 12, lineHeight: 14, weight: '600' },
  dataL: { family: 'MonoNL-SemiBold', size: 20, lineHeight: 24 },
  dataM: { family: 'MonoNL-Medium', size: 15, lineHeight: 20 },
  dataS: { family: 'MonoNL-Medium', size: 13, lineHeight: 16 },
  pinNumeral: { family: 'MonoNL-SemiBold', size: 11, lineHeight: 11 },
  tag: {
    family: 'MonoNL-SemiBold',
    size: 11,
    lineHeight: 14,
    letterSpacing: 0.66,
    uppercase: true,
  },
  code: { family: 'MonoNL-Medium', size: 15, lineHeight: 22 },
  codeKeyword: { family: 'MonoNL-SemiBold', size: 15, lineHeight: 22 },
};

/** Dynamic Type caps per surface (DESIGN.md Typography). */
export const fontScaleCap = {
  runningHead: 1.3,
  strip: 1.3,
  chromeLabel: 1.2,
  matrix: 1.2,
  tag: 1.3,
} as const;

export const space = { 2: 2, 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32, 48: 48 } as const;
export const radius = { none: 0, tile: 4, control: 8 } as const;
export const stroke = { rule: 1, track: 2, current: 2, outline: 1, state: 1.5, result: 2 } as const;

export const size = {
  target: 48,
  topRow: { ios: 44, android: 48 },
  sound: 72,
  actions: 48,
  cardActions: 64,
  tabBar: 48,
  answerRow: 56,
  railRow: 48,
  railRowNeeds: 64,
  matrixRow: { full: 44, compact: 42 },
  /** Gutter on the map and the You screen. */
  gutter: 16,
} as const;

export interface Spring {
  mass: 1;
  stiffness: number;
  damping: number;
}

/** Reanimated 4.5.1 defaults to mass 4, so mass is always written out. */
export const motion = {
  spring: {
    fast: { mass: 1, stiffness: 1400, damping: 67 },
    default: { mass: 1, stiffness: 700, damping: 48 },
  } satisfies Record<'fast' | 'default', Spring>,
  /** CSS transition durations in ms. */
  color: { fast: 120, default: 200, slow: 320 },
  easing: [0.2, 0, 0, 1] as const,
  timing: {
    fill: 450,
    count: 300,
    stagger: 90,
    staggerMax: 6,
    hold: 1200,
    fadeRm: 150,
    toast: 4000,
    toastScreenReader: 10000,
  },
} as const;

export type HapticName = 'select' | 'correct' | 'wrong' | 'quickAction' | 'learned';
export const haptic: Record<HapticName, { ios: string; android: string | null }> = {
  select: { ios: 'selection', android: 'Segment_Tick' },
  correct: { ios: 'notification.success', android: 'Confirm' },
  wrong: { ios: 'notification.error', android: 'Reject' },
  quickAction: { ios: 'impact.light', android: 'Context_Click' },
  learned: { ios: 'impact.medium', android: null },
};

export type IconName =
  | 'tabFeed'
  | 'tabMap'
  | 'tabYou'
  | 'moreLikeThis'
  | 'tooEasy'
  | 'notForMe'
  | 'poolReview'
  | 'poolDeepen'
  | 'poolExplore'
  | 'poolLateral'
  | 'check'
  | 'xmark'
  | 'arrowRight'
  | 'undo'
  | 'warning'
  | 'play'
  | 'soundOn'
  | 'soundOff'
  | 'chevronLeft'
  | 'chevronRight'
  | 'clock';

/** SF Symbols on iOS, Material Symbols on Android (DESIGN.md Iconography). */
export const icon: Record<IconName, { ios: string; android: string }> = {
  tabFeed: { ios: 'play.rectangle', android: 'smart_display' },
  tabMap: { ios: 'square.grid.3x3', android: 'grid_view' },
  tabYou: { ios: 'person', android: 'person' },
  moreLikeThis: { ios: 'plus', android: 'add' },
  tooEasy: { ios: 'forward.end', android: 'skip_next' },
  notForMe: { ios: 'eye.slash', android: 'visibility_off' },
  poolReview: { ios: 'clock', android: 'schedule' },
  poolDeepen: { ios: 'arrow.down.to.line', android: 'vertical_align_bottom' },
  poolExplore: { ios: 'arrow.up.right', android: 'north_east' },
  poolLateral: { ios: 'arrow.left.and.right', android: 'swap_horiz' },
  check: { ios: 'checkmark', android: 'check' },
  xmark: { ios: 'xmark', android: 'close' },
  arrowRight: { ios: 'arrow.right', android: 'arrow_forward' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  soundOn: { ios: 'speaker.wave.2', android: 'volume_up' },
  soundOff: { ios: 'speaker.slash', android: 'volume_off' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  clock: { ios: 'clock', android: 'schedule' },
};

export type Level = 'none' | 'seen' | 'checked' | 'learned' | 'retained';
export type TileSize = 18 | 22 | 28;

export interface TileGeometry {
  radius: number;
  outline: number;
  outlineNew: number;
  dash: readonly [width: number, height: number];
  dot: number;
  halfFill: number;
  tick: readonly [box: number, stroke: number];
  tickDue: readonly [box: number, shift: number];
  dogEar: readonly [leg: number, gap: number];
  dogEarLegPinned: number;
}

export const mastery = {
  tile: {
    18: {
      radius: 3,
      outline: 1.5,
      outlineNew: 2.5,
      dash: [8, 2],
      dot: 5,
      halfFill: 9,
      tick: [10, 2],
      tickDue: [8, 3],
      dogEar: [10, 2],
      dogEarLegPinned: 8,
    },
    22: {
      radius: 4,
      outline: 1.5,
      outlineNew: 2.5,
      dash: [10, 2],
      dot: 6,
      halfFill: 11,
      tick: [12, 2],
      tickDue: [10, 3],
      dogEar: [11, 2.5],
      dogEarLegPinned: 11,
    },
    28: {
      radius: 5,
      outline: 2,
      outlineNew: 3,
      dash: [12, 2.5],
      dot: 8,
      halfFill: 14,
      tick: [16, 2.5],
      tickDue: [13, 4],
      dogEar: [14, 3],
      dogEarLegPinned: 14,
    },
  } satisfies Record<TileSize, TileGeometry>,
  /** Interior = level; outline only while not locked and level is none, seen or checked. */
  level: {
    none: { interior: 'none', color: color.text.secondary, word: 'OPEN', outlined: true },
    seen: { interior: 'dot', color: color.text.secondary, word: 'SEEN', outlined: true },
    checked: { interior: 'half', color: color.proven.dim, word: 'CHECKED', outlined: true },
    learned: { interior: 'full', color: color.proven.base, word: 'LEARNED', outlined: false },
    retained: {
      interior: 'fullTick',
      color: color.proven.bright,
      word: 'RETAINED',
      outlined: false,
    },
  } as const satisfies Record<
    Level,
    {
      interior: 'none' | 'dot' | 'half' | 'full' | 'fullTick';
      color: Hex;
      word: string;
      outlined: boolean;
    }
  >,
  locked: { color: color.line.control, word: 'LOCKED' },
  justUnlocked: { color: color.text.primary, word: 'NEW' },
  due: { color: color.due, word: 'DUE' },
  pin: { disc: 12, ring: 1, inset: 2 },
} as const;

/** The reel canvas and its safe-zone contract (DESIGN.md "Reel safe-zone contract"), in px on 720 x 1280. */
export const reel = {
  canvas: { width: 720, height: 1280, fps: 30 },
  /** Remotion output scale: 1.5 renders 1080 x 1920 (owner decision 2026-10-04). */
  outputScale: 1.5,
  band: { top: 120, bottom: 160 },
  inset: 40,
  /** Empty ground at the start of every reel, for the first-frame placeholder handoff. */
  leadInFrames: 9,
  regions: {
    visualBox: { top: 136, bottom: 716 },
    onScreen: { top: 748, bottom: 848 },
    rule: { y: 916, height: 2 },
    captionRail: { top: 992, bottom: 1096 },
    hook: { top: 120, bottom: 1120 },
  },
  minText: 26,
  minCode: 26,
  codeGuard: 4,
  codeSteps: [
    { size: 28, inset: 40, maxColumns: 37 },
    { size: 26, inset: 24, maxColumns: 42 },
    { size: 25, inset: 24, maxColumns: 44 },
    { size: 24, inset: 24, maxColumns: 46 },
  ],
  codeLineHeight: 1.5,
  caption: { size: 42, lineHeight: 52, maxLines: 2, maxWords: 7, maxChars: 48, playhead: 4 },
  onScreenSteps: [
    { size: 44, lineHeight: 50 },
    { size: 40, lineHeight: 46 },
    { size: 36, lineHeight: 42 },
  ],
  hookSteps: [
    { size: 72, lineHeight: 80 },
    { size: 64, lineHeight: 70 },
    { size: 56, lineHeight: 62 },
    { size: 48, lineHeight: 54 },
  ],
  flow: {
    label: [
      { size: 30, lineHeight: 34 },
      { size: 26, lineHeight: 30 },
    ],
    edgeLabel: { size: 26, lineHeight: 30 },
    boxMinHeight: 84,
    boxMaxWidth: 280,
    radius: 16,
    arrow: 3,
  },
  mistakeLabel: { size: 26, lineHeight: 30 },
  equation: { size: 56, floor: 32 },
  /** Entrances are opacity only, over this many frames. */
  fadeFrames: 6,
  codeLineFrames: 4,
  fontStack: {
    display600: ['BarlowSC-SemiBold', 'MonoNL-SemiBold'],
    display700: ['BarlowSC-Bold', 'MonoNL-ExtraBold'],
  },
} as const;

export * from './layout';
export * from './contrast';
