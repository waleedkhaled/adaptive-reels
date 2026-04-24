// Pure layout arithmetic for the feed (DESIGN.md Layout, "Strip height" and
// "Feed fit"). The picture never changes size between items: it depends only
// on the window, the safe-area insets and the font scale.

export interface Size {
  width: number;
  height: number;
}
export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
export type Platform = 'ios' | 'android';

const CANVAS_W = 720;
const CANVAS_H = 1280;
/** The reel's content band (y 120 to 1120 on the canvas) is what must stay visible. */
const BAND_TOP = 120;
const BAND_H = 1000;
const AXIS_PX = 40;
const ACTIONS = 48;
const FOLD_BELOW = 0.93;

/** Height of the reason strip, including its 2 pt progress line. */
export function stripHeight(fontScale: number, folded = false): number {
  const k = Math.min(Math.max(fontScale, 1), 1.3);
  const lines = fontScale > 1 ? 3 : 2;
  return folded ? Math.ceil(14 + (22 + 20 * lines) * k) : Math.ceil(20 + 20 * lines * k);
}

/** The left text axis shared by native chrome, cards and the baked reel text. */
export function feedAxis(pictureWidth: number, pillar: number): number {
  return pillar + (pictureWidth * AXIS_PX) / CANVAS_W;
}

export interface FeedLayout {
  /** Points per canvas pixel. */
  scale: number;
  folded: boolean;
  topRow: number;
  strip: number;
  actions: number;
  tabBar: number;
  /** The picture, in window coordinates. Its flat top and bottom bands may sit under chrome. */
  picture: { x: number; y: number; width: number; height: number };
  /** Window y where the free region (between top row and strip) starts and ends. */
  free: { top: number; bottom: number };
  axis: number;
}

export function feedFit(
  window: Size,
  insets: Insets,
  fontScale: number,
  platform: Platform,
  tabBar: 0 | 48,
): FeedLayout {
  const W = window.width;
  const H = window.height;
  const topRowFull = platform === 'android' ? 48 : 44;

  const layoutFor = (folded: boolean): FeedLayout => {
    const topRow = folded ? 0 : topRowFull;
    const strip = stripHeight(fontScale, folded);
    const freeTop = insets.top + topRow;
    const freeBottom = H - insets.bottom - tabBar - ACTIONS - strip;
    const freeHeight = Math.max(0, freeBottom - freeTop);
    const scale = Math.min(W / CANVAS_W, freeHeight / BAND_H);
    const width = CANVAS_W * scale;
    const height = CANVAS_H * scale;
    const bandTop = freeTop + (freeHeight - BAND_H * scale) / 2;
    const x = (W - width) / 2;
    return {
      scale,
      folded,
      topRow,
      strip,
      actions: ACTIONS,
      tabBar,
      picture: { x, y: bandTop - BAND_TOP * scale, width, height },
      free: { top: freeTop, bottom: freeBottom },
      axis: feedAxis(width, x),
    };
  };

  const full = layoutFor(false);
  // Fold only when the picture would fall under 93% of the window width.
  return full.picture.width < FOLD_BELOW * W ? layoutFor(true) : full;
}

/**
 * Map fit (DESIGN.md Layout, "Map fit"). Full mode: header, legend row and
 * five matrix rows of 44 above the stage. Compact mode takes height from the
 * legend (a 20 pt line) and the rows (42, never lower). Large text turns the
 * matrix into a row of five 64 pt tabs. `need` is the stage header plus the
 * rail rows of the topic the map opens on; the mode never changes while open.
 */
export type MapMode = 'full' | 'compact' | 'tabs';

export interface MapLayout {
  mode: MapMode;
  header: number;
  /** "Sample data" band under the header for a seeded profile. */
  sampleBand: number;
  legend: number;
  matrixRow: number;
  matrixHeight: number;
  /** Window y of the stage header's top edge. */
  stageTop: number;
  /** Height from the stage's top edge down to the bottom inset. */
  span: number;
  /** Matrix tile size and pitch: 22 from 390 pt wide, 18 below. */
  tile: 18 | 22;
  pitch: number;
}

const MATRIX_ROWS = 5;
const LEGEND_LINE = 20;
const TABS_ROW = 64;
const LARGE_TEXT = 1.35;

export function mapFit(
  window: Size,
  insets: Insets,
  fontScale: number,
  platform: Platform,
  need: number,
  sampleData = false,
): MapLayout {
  const header = platform === 'android' ? 48 : 44;
  const sampleBand = sampleData ? 24 : 0;
  const tile = window.width >= 390 ? 22 : 18;
  const top = insets.top + header + sampleBand;
  const available = window.height - insets.bottom - top;
  const shape = (
    mode: MapMode,
    legend: number,
    matrixRow: number,
    matrixHeight: number,
  ): MapLayout => ({
    mode,
    header,
    sampleBand,
    legend,
    matrixRow,
    matrixHeight,
    stageTop: top + legend + matrixHeight,
    span: available - legend - matrixHeight,
    tile,
    pitch: tile + 6,
  });
  if (fontScale >= LARGE_TEXT) return shape('tabs', LEGEND_LINE, TABS_ROW, TABS_ROW);
  const full = shape('full', header, 44, 44 * MATRIX_ROWS);
  return full.span >= need ? full : shape('compact', LEGEND_LINE, 42, 42 * MATRIX_ROWS);
}
