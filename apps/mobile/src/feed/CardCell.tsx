// A retrieval card page (UX.md 3.3): one question, 3 or 4 option rows. Select,
// then "Check answer" in the action row. Rows never move after the answer.
import { copy } from '@reels/agent';
import type { FeedLayout } from '@reels/tokens';
import { memo, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { color, fontScaleCap, radius, stroke } from '../lib/theme';
import { useApp } from '../lib/store';
import type { CardSlot } from '../lib/types';
import { selectOption } from './cards';
import { ProgressPanel } from './ProgressPanel';

interface Props {
  slot: CardSlot;
  index: number;
  height: number;
  layout: FeedLayout;
  topInset: number;
  bottomChrome: number;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export const CardCell = memo(function CardCell({
  slot,
  index,
  height,
  layout,
  topInset,
  bottomChrome,
}: Props) {
  const item = useApp(
    (s) => s.reels[slot.reelId]?.retrieval_items.find((i) => i.id === slot.itemId) ?? null,
  );
  const card = useApp((s) => (s.card?.key === slot.key ? s.card : null));
  const isActive = useApp((s) => s.activeIndex === index);
  const reduceMotion = useApp((s) => s.reduceMotion);
  const scroller = useRef<ScrollView>(null);
  // The verdict and panel mount after the answer; scroll once they have a size.
  const revealPending = useRef(false);
  const answered = !!card?.result;
  useEffect(() => {
    revealPending.current = answered;
  }, [answered]);
  if (!item) return <View style={{ height, backgroundColor: color.bg.base }} />;
  const result = card?.result ?? null;
  const axis = layout.axis;

  return (
    <View style={{ height, backgroundColor: color.bg.base }}>
      <ScrollView
        ref={scroller}
        style={{ marginTop: topInset, marginBottom: bottomChrome }}
        contentContainerStyle={{
          paddingHorizontal: axis,
          paddingTop: 24,
          paddingBottom: 16,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (!revealPending.current) return;
          revealPending.current = false;
          scroller.current?.scrollToEnd({ animated: !reduceMotion });
        }}
      >
        <Txt variant="title" accessibilityRole="header">
          {item.prompt}
        </Txt>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {slot.options.map((choiceIndex, n) => {
            const selected = card?.selected === n;
            const isAnswer = choiceIndex === item.answer_index;
            const chosen = result?.chosen === n;
            const state: RowState = !result
              ? selected
                ? 'selected'
                : 'idle'
              : chosen
                ? result.correct
                  ? 'correct'
                  : 'wrong'
                : isAnswer
                  ? 'answer'
                  : 'other';
            return (
              <Pressable
                key={choiceIndex}
                disabled={!!result || !isActive}
                onPress={() => selectOption(slot, n)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected || chosen, disabled: !!result }}
                accessibilityLabel={`${LETTERS[n]}. ${item.choices[choiceIndex]}${rowSuffix(state)}`}
                style={[styles.row, rowStyle(state)]}
              >
                <View style={[styles.key, state === 'selected' && styles.keySelected]}>
                  <Txt
                    variant="dataM"
                    tone={state === 'selected' ? 'inverse' : 'secondary'}
                    maxScale={1.3}
                  >
                    {LETTERS[n]}
                  </Txt>
                </View>
                <Txt
                  variant="option"
                  tone={state === 'other' ? 'secondary' : 'primary'}
                  style={{ flex: 1 }}
                >
                  {item.choices[choiceIndex]}
                </Txt>
                {(state === 'correct' || state === 'wrong' || state === 'answer') && (
                  <ResultTag state={state} />
                )}
              </Pressable>
            );
          })}
        </View>
        {result && (
          <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
            <View style={styles.verdict}>
              <Icon
                name={result.correct ? 'check' : 'xmark'}
                size={22}
                tint={result.correct ? color.proven.base : color.error.base}
              />
              <Txt
                variant="display"
                tone={result.correct ? 'proven' : 'error'}
                accessibilityRole="header"
              >
                {result.correct ? copy.QUIZ.verdictCorrect : copy.QUIZ.verdictWrong}
              </Txt>
            </View>
            <Txt variant="bodyS">
              {[item.explanation, copy.explanationSuffix(result.answer)].filter(Boolean).join(' ')}
            </Txt>
            <ProgressPanel slot={slot} result={result.answer} />
          </View>
        )}
      </ScrollView>
    </View>
  );
});

type RowState = 'idle' | 'selected' | 'correct' | 'wrong' | 'answer' | 'other';

function rowSuffix(state: RowState): string {
  if (state === 'correct') return ', your answer, correct';
  if (state === 'wrong') return ', your answer, wrong';
  if (state === 'answer') return ', correct answer';
  return '';
}

const TAG = {
  correct: {
    label: copy.QUIZ.rowChosenCorrect,
    icon: 'check',
    tone: 'proven',
    tint: color.proven.base,
  },
  wrong: { label: copy.QUIZ.rowYourAnswer, icon: 'xmark', tone: 'error', tint: color.error.base },
  answer: {
    label: copy.QUIZ.rowCorrectAnswer,
    icon: 'check',
    tone: 'primary',
    tint: color.text.primary,
  },
} as const;

/** The result label, set into the row's top border like a legend so no row grows or moves. */
function ResultTag({ state }: { state: keyof typeof TAG }) {
  const t = TAG[state];
  return (
    <View
      style={styles.tag}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Icon name={t.icon} size={11} tint={t.tint} />
      <Txt variant="tag" tone={t.tone} maxScale={fontScaleCap.tag}>
        {t.label}
      </Txt>
    </View>
  );
}

// Content sits 17 x 13 from the outer edge in every state: a 2 pt outline
// takes its extra point from the padding, so selecting never shifts text.
function rowStyle(state: RowState) {
  const ring = (borderColor: string, backgroundColor: string) => ({
    borderWidth: stroke.result,
    borderColor,
    backgroundColor,
    paddingHorizontal: 17 - stroke.result,
    paddingVertical: 13 - stroke.result,
  });
  switch (state) {
    case 'selected':
      return ring(color.text.primary, color.bg.raised);
    case 'correct':
      return ring(color.proven.base, color.proven.surface);
    case 'wrong':
      return ring(color.error.base, color.error.surface);
    case 'answer':
      return ring(color.text.primary, color.bg.raised);
    case 'other':
      return {
        borderWidth: stroke.outline,
        borderColor: color.line.hairline,
        backgroundColor: color.bg.raised,
      };
    default:
      return {
        borderWidth: stroke.outline,
        borderColor: color.line.control,
        backgroundColor: color.bg.raised,
      };
  }
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    borderRadius: radius.control,
    paddingHorizontal: 17 - stroke.outline,
    paddingVertical: 13 - stroke.outline,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  key: {
    width: 24,
    height: 22,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keySelected: { backgroundColor: color.text.primary },
  tag: {
    position: 'absolute',
    top: -9 - stroke.result / 2,
    right: 12,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    backgroundColor: color.bg.base,
  },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
});
