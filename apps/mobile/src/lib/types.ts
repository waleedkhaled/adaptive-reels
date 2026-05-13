import type { CardItem, ClockSetting, FeedItem, Mode, ReelItem, SummaryItem } from '@reels/schemas';
import type { ReelSet } from './library';

/**
 * One page of the feed pager: the agent's feed item (reel, card or summary).
 * Played slots never change; only the unplayed tail is replaced by a re-plan.
 */
export type FeedSlot = FeedItem;
export type ReelSlot = ReelItem;
export type CardSlot = CardItem;
export type SummarySlot = SummaryItem;

export interface Settings {
  /** Owner decision 2026-10-04: sound is on by default. */
  soundOn: boolean;
  haptics: boolean;
  mode: Mode;
  clock: ClockSetting;
  reelSet: ReelSet;
}

export const defaultSettings = (reelSet: ReelSet): Settings => ({
  soundOn: true,
  haptics: true,
  mode: 'light',
  clock: 'real',
  reelSet,
});
