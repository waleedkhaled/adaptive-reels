// Settings (UX.md 3.8). Rows of 56, grouped under headings. No account.
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import type { ManifestReel } from '@reels/schemas';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SwitchMark } from '../../components/SwitchMark';
import { Txt } from '../../components/Txt';
import { engine } from '../../feed/engine';
import { setMutedAll } from '../../feed/players';
import { loadSampleProfile, resetProfile, SAMPLES } from '../../feed/session';
import { exportEvents } from '../../lib/db';
import { pendingDownloads, saveAll, savedStatus } from '../../lib/downloads';
import { libraryBaseUrl, manifestFile } from '../../lib/library';
import { color, size, stroke } from '../../lib/theme';
import { useApp } from '../../lib/store';

export default function You() {
  const insets = useSafeAreaInsets();
  const settings = useApp((s) => s.settings);
  const manifest = useApp((s) => s.manifest);
  const source = useApp((s) => s.manifestSource);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmSample, setConfirmSample] = useState<(typeof SAMPLES)[number] | null>(null);
  const sample = useApp((s) => s.learner?.sample ?? null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const set = useApp.getState().updateSettings;

  const changeMode = (mode: 'light' | 'focus') => {
    if (mode === settings.mode) return;
    useApp.getState().log({ type: 'mode_changed', from: settings.mode, to: mode });
    set({ mode });
    engine.setMode(mode);
  };

  return (
    // The inset sits outside the ScrollView so scrolled rows clip below the status bar instead of running under the clock.
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: color.bg.base }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 16,
          paddingHorizontal: size.gutter,
          paddingBottom: 32,
          gap: 24,
        }}
      >
        <Txt variant="title" accessibilityRole="header">
          You
        </Txt>

        <Section title="Mode">
          <Radio
            on={settings.mode === 'light'}
            title="Light"
            body="Mostly new reels, a question every 4."
            onPress={() => changeMode('light')}
          />
          <Radio
            on={settings.mode === 'focus'}
            title="Focus"
            body="More questions and reviews, one every 2."
            onPress={() => changeMode('focus')}
          />
          <Toggle
            title="Demo clock"
            body="Reviews return in about 1 min instead of 10 min. Also switches to Focus."
            value={settings.clock === 'demo'}
            onChange={(on) => {
              const to = on ? 'demo' : 'real';
              // The agent switches to Focus (and back) and rescales pending reviews.
              const changed = engine.setClock(to);
              useApp.getState().log({
                type: 'clock_changed',
                from: settings.clock,
                to,
                rescaled_concept_ids: changed?.rescaled ?? [],
              });
              set({ clock: to, mode: changed?.mode ?? (on ? 'focus' : settings.mode) });
            }}
          />
        </Section>

        <Section title="Sound and haptics">
          <Toggle
            title="Start reels with sound"
            value={settings.soundOn}
            onChange={(on) => {
              setMutedAll(!on);
              useApp.getState().log({ type: 'sound_changed', muted: !on });
              set({ soundOn: on });
            }}
          />
          <Toggle
            title="Haptics"
            value={settings.haptics}
            onChange={(on) => {
              useApp.getState().log({ type: 'setting_changed', key: 'haptics', value: on });
              set({ haptics: on });
            }}
          />
        </Section>

        <Section title="Sample profiles">
          {sample && (
            <View style={styles.sampleBand}>
              <View style={styles.sampleTag}>
                <Txt variant="tag" tone="inverse">
                  Sample data
                </Txt>
              </View>
              <Txt variant="caption" tone="secondary">
                {`${SAMPLES.find((x) => x.name === sample)?.title ?? sample} is loaded. Reset progress to leave it.`}
              </Txt>
            </View>
          )}
          {SAMPLES.map((x) => (
            <Pressable
              key={x.name}
              accessibilityRole="button"
              accessibilityHint="Replaces your progress after a confirmation."
              onPress={() => setConfirmSample(x)}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: color.bg.overlay },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Txt variant="option">{x.title}</Txt>
                <Txt variant="caption" tone="secondary">
                  {x.body}
                </Txt>
              </View>
              <Icon name="chevronRight" size={13} tint={color.text.secondary} />
            </Pressable>
          ))}
          {confirmSample && (
            <View style={styles.confirm}>
              <Txt variant="bodyS">{`Load "${confirmSample.title}"? This replaces your progress. The event log stays.`}</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  kind="secondary"
                  label="Cancel"
                  style={{ flex: 1 }}
                  onPress={() => setConfirmSample(null)}
                />
                <Button
                  label="Load"
                  style={{ flex: 1 }}
                  onPress={() => {
                    loadSampleProfile(confirmSample.name);
                    setConfirmSample(null);
                    router.navigate('/');
                  }}
                />
              </View>
            </View>
          )}
        </Section>

        <Section title="Your data">
          <Button
            kind="secondary"
            label="Export log"
            onPress={async () => {
              const { jsonl, count } = await exportEvents();
              if (count === 0) {
                setExportNote('0 events');
                return;
              }
              const file = new File(Paths.cache, `adaptive-reels-log-${Date.now()}.jsonl`);
              file.create();
              file.write(jsonl);
              useApp.getState().log({ type: 'log_exported', events: count });
              useApp.getState().flush();
              setExportNote(`${count} events`);
              await Sharing.shareAsync(file.uri, {
                mimeType: 'application/x-ndjson',
                dialogTitle: 'Export event log',
              });
            }}
          />
          {exportNote && (
            <Txt variant="caption" tone="secondary">
              {exportNote}
            </Txt>
          )}
          {confirmReset ? (
            <View style={styles.confirm}>
              <Txt variant="bodyS">
                Reset progress? This clears your map and starts again from the topic picker.
                Settings and the event log stay.
              </Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  kind="secondary"
                  label="Cancel"
                  style={{ flex: 1 }}
                  onPress={() => setConfirmReset(false)}
                />
                <Button label="Reset" style={{ flex: 1 }} onPress={() => void resetProfile()} />
              </View>
            </View>
          ) : (
            <Button kind="secondary" label="Reset progress" onPress={() => setConfirmReset(true)} />
          )}
        </Section>

        <Section title="Library">
          <Info
            label="Reels"
            value={`${manifest?.reels.length ?? 0} (${settings.reelSet === 'all' ? 'all that passed checks' : 'approved only'})`}
          />
          <Info
            label="Source"
            value={`${libraryBaseUrl()}/${manifestFile(settings.reelSet)}${source === 'disk' ? ' (offline copy)' : ''}`}
          />
          {manifest && <OfflineRow reels={manifest.reels} />}
          {__DEV__ && (
            <Toggle
              title="Approved reels only"
              body="Development builds show every reel that passed the checks. Restart to apply."
              value={settings.reelSet === 'approved'}
              onChange={(on) => set({ reelSet: on ? 'approved' : 'all' })}
            />
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

const megabytes = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;

/** Save every reel on the device, so the feed plays without the library server (PERFORMANCE.md 6.4). */
function OfflineRow({ reels }: { reels: ManifestReel[] }) {
  const [status, setStatus] = useState(() => savedStatus(reels));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!saving) return;
    const timer = setInterval(() => {
      const next = savedStatus(reels);
      setStatus(next);
      // Done, or nothing left in flight (offline or failed): stop and show the button again.
      if (next.saved === next.total || pendingDownloads() === 0) setSaving(false);
    }, 1000);
    return () => clearInterval(timer);
  }, [saving, reels]);
  const done = status.saved === status.total;
  return (
    <View style={{ gap: 8 }}>
      <Info
        label="Saved for offline"
        value={`${status.saved} of ${status.total} reels (${megabytes(status.savedBytes)} of ${megabytes(status.bytes)})`}
      />
      {done ? (
        <Txt variant="caption" tone="secondary">
          Every reel plays without the library server.
        </Txt>
      ) : (
        <Button
          kind="secondary"
          label={
            saving
              ? `Saving ${status.saved} of ${status.total}`
              : `Save all for offline (${megabytes(status.bytes - status.savedBytes)})`
          }
          disabled={saving}
          onPress={() => {
            saveAll(reels);
            setSaving(true);
          }}
        />
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="heading" accessibilityRole="header">
        {title}
      </Txt>
      {children}
    </View>
  );
}

function Radio({
  on,
  title,
  body,
  onPress,
}: {
  on: boolean;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={[styles.row, on && styles.rowOn]}
    >
      <View style={{ flex: 1 }}>
        <Txt variant="option">{title}</Txt>
        <Txt variant="caption" tone="secondary">
          {body}
        </Txt>
      </View>
      {on && <Icon name="check" size={20} />}
    </Pressable>
  );
}

/** The whole row is the switch: a 56 pt target with the label read once. */
function Toggle({
  title,
  body,
  value,
  onChange,
}: {
  title: string;
  body?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={body}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.bg.overlay }]}
    >
      <View style={{ flex: 1 }}>
        <Txt variant="option">{title}</Txt>
        {body && (
          <Txt variant="caption" tone="secondary">
            {body}
          </Txt>
        )}
      </View>
      <SwitchMark on={value} />
    </Pressable>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Txt variant="caption" tone="secondary">
        {label}
      </Txt>
      <Txt variant="caption" selectable>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: stroke.outline,
    borderColor: color.line.control,
    backgroundColor: color.bg.raised,
  },
  // The 2 pt outline takes its extra point from the padding: no shift on select.
  rowOn: {
    borderWidth: stroke.result,
    borderColor: color.text.primary,
    backgroundColor: color.bg.overlay,
    paddingHorizontal: 16 + stroke.outline - stroke.result,
    paddingVertical: 8 + stroke.outline - stroke.result,
  },
  confirm: { gap: 12, padding: 12, borderRadius: 8, backgroundColor: color.bg.overlay },
  info: { gap: 2 },
  sampleBand: { gap: 4 },
  sampleTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: color.text.primary,
  },
});
