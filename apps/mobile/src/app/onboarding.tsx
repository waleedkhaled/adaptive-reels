// One screen, under 15 seconds, no account (UX.md 3.1).
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { startProfile } from '../feed/session';
import { topicConcepts, topics } from '../lib/graph';
import { color, radius, size, stroke } from '../lib/theme';

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const finish = (skipped: boolean) => {
    startProfile(skipped ? [] : picked, skipped);
    router.replace('/');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Txt variant="display" accessibilityRole="header">
          What do you want to get better at?
        </Txt>
        <Txt variant="bodyS" tone="secondary">
          Watching marks a concept Seen. Only a correct answer after a delay marks it Learned. Your
          swipes and three buttons steer the feed.
        </Txt>
        <View style={styles.topics}>
          {topics.map((t) => {
            const on = picked.includes(t.id);
            return (
              <Pressable
                key={t.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${t.title}, ${topicConcepts(t.id).length} concepts`}
                onPress={() => toggle(t.id)}
                style={[styles.topic, on && styles.topicOn]}
              >
                <View style={{ flex: 1 }}>
                  <Txt variant="heading">{t.title}</Txt>
                  <Txt variant="caption" tone="secondary">
                    {topicConcepts(t.id).length} concepts
                  </Txt>
                </View>
                {on && <Icon name="check" size={20} />}
              </Pressable>
            );
          })}
        </View>
        <Txt variant="caption" tone="secondary">
          Pick any number. What you watch and skip takes over quickly.
        </Txt>
      </ScrollView>
      <View style={[styles.buttons, { paddingBottom: insets.bottom + 12 }]}>
        <Button kind="secondary" label="Skip" style={{ flex: 1 }} onPress={() => finish(true)} />
        <Button
          label="Start"
          style={{ flex: 1 }}
          disabled={picked.length === 0}
          onPress={() => finish(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg.base },
  content: { paddingHorizontal: size.gutter, paddingTop: 32, paddingBottom: 24, gap: 16 },
  topics: { gap: 8, marginTop: 8 },
  topic: {
    minHeight: 56,
    borderRadius: radius.control,
    borderWidth: stroke.outline,
    borderColor: color.line.control,
    backgroundColor: color.bg.raised,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The 2 pt outline takes its extra point from the padding: no shift on select.
  topicOn: {
    backgroundColor: color.bg.overlay,
    borderWidth: stroke.result,
    borderColor: color.text.primary,
    paddingHorizontal: 16 + stroke.outline - stroke.result,
    paddingVertical: 8 + stroke.outline - stroke.result,
  },
  buttons: { flexDirection: 'row', gap: 8, paddingHorizontal: size.gutter, paddingTop: 12 },
});
