// The strip's reason as segments (UX.md 5.1) from the agent's copy deck: the
// pool lead word with its glyph, then the sentence with its cause in bold.
// Items that exist because of a tap or skip mark the lead word or the span
// naming the action (the "changed" marker, UX.md 3.2).
import { copy } from '@reels/agent';
import type { IconName } from '@reels/tokens';
import type { FeedSlot } from '../lib/types';
import { cat } from './engine';

export interface Segment {
  text: string;
  strong?: boolean;
  /** The pool lead word ("Review", "Deepen", ...). */
  lead?: boolean;
  icon?: IconName;
  due?: boolean;
  /** Drawn in reverse video: this item is here because of the learner's tap or skip. */
  changed?: boolean;
}

const ICON: Record<copy.LeadWord, IconName> = {
  Review: 'poolReview',
  Deepen: 'poolDeepen',
  Explore: 'poolExplore',
  Lateral: 'poolLateral',
};

export function reasonSegments(slot: FeedSlot): Segment[] {
  if (!slot.reason) return [];
  const lead = copy.leadWord(slot);
  const marker = copy.changedMarker(slot);
  const out: Segment[] = [];
  if (lead) {
    out.push({
      text: `${lead}. `,
      lead: true,
      icon: ICON[lead],
      due: slot.reason.code === 'REVIEW_DUE',
      changed: marker?.target === 'lead',
    });
  }
  for (const s of copy.reasonSentence(slot.reason, cat(), slot.kind === 'card' ? 'card' : 'reel')) {
    out.push({ ...s, changed: marker?.target === 'span' && s.text === marker.text });
  }
  return out;
}

/** The reason panel's lines: the strip sentence, the detail, a trigger line, the demo clock line. */
export function reasonPanelLines(
  slot: FeedSlot,
  ctx: { now: number; nextDueAt: number | null; demo: boolean },
): string[] {
  if (!slot.reason) return [];
  const lines = [copy.stripText(slot, cat()), ...copy.reasonDetail(slot.reason, cat(), ctx)];
  const trigger = copy.triggerLine(slot.reason);
  if (trigger) lines.push(trigger);
  if (ctx.demo) lines.push(copy.DEMO_CLOCK_LINE);
  return lines;
}
