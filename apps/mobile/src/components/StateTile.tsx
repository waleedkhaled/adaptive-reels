// The mastery tile: one component at three sizes (DESIGN.md "Mastery encoding").
// Shape carries the state; colour only reinforces it. Plain Views, no SVG.
import { mastery, type Level, type TileSize } from '@reels/tokens';
import { StyleSheet, View } from 'react-native';
import { color } from '../lib/theme';
import { Txt } from './Txt';

export interface TileState {
  level: Level;
  locked: boolean;
  due: boolean;
  justUnlocked: boolean;
}

interface Props extends TileState {
  size: TileSize;
  /** The surface the tile sits on: gaps and rings are drawn in it. */
  surface: string;
  selected?: boolean;
  pin?: number;
}

export function StateTile({
  size,
  surface,
  level,
  locked,
  due,
  justUnlocked,
  selected,
  pin,
}: Props) {
  const g = mastery.tile[size];
  const spec = mastery.level[level];
  const isLockedEmpty = locked && level === 'none';
  const outlined = spec.outlined && !locked;
  const outlineColor = justUnlocked && level === 'none' ? color.text.primary : spec.color;
  const outlineWidth = justUnlocked && level === 'none' ? g.outlineNew : g.outline;
  const filled = spec.interior === 'full' || spec.interior === 'fullTick';
  const showDue = due && (level === 'checked' || level === 'learned' || level === 'retained');
  const leg = pin ? g.dogEarLegPinned : g.dogEar[0];

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: g.radius,
          overflow: 'hidden',
          borderWidth: outlined ? outlineWidth : 0,
          borderColor: outlined ? outlineColor : 'transparent',
          backgroundColor: filled ? spec.color : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isLockedEmpty && (
          <View
            style={{ width: g.dash[0], height: g.dash[1], backgroundColor: mastery.locked.color }}
          />
        )}
        {level === 'seen' && (
          <View
            style={{
              width: g.dot,
              height: g.dot,
              borderRadius: g.dot / 2,
              backgroundColor: spec.color,
            }}
          />
        )}
        {level === 'checked' && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: g.halfFill - (outlined ? outlineWidth : 0),
              backgroundColor: spec.color,
            }}
          />
        )}
        {spec.interior === 'fullTick' && (
          <Tick
            box={showDue ? g.tickDue[0] : g.tick[0]}
            stroke={g.tick[1]}
            shift={showDue ? g.tickDue[1] : 0}
          />
        )}
        {showDue && (
          <>
            {/* Dog-ear: an amber triangle in the top-right corner behind a gap in the surface colour. */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 0,
                height: 0,
                borderTopWidth: leg,
                borderLeftWidth: leg,
                borderTopColor: color.due,
                borderLeftColor: 'transparent',
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: leg / 2 - g.dogEar[1] / 2,
                right: -leg * 0.21,
                width: leg * 1.42,
                height: g.dogEar[1],
                backgroundColor: surface,
                transform: [
                  { translateX: -leg / 2 + leg * 0.21 },
                  { rotate: '45deg' },
                  { translateX: leg / 2 },
                ],
              }}
            />
          </>
        )}
      </View>
      {selected && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              margin: -4,
              borderRadius: g.radius + 4,
              borderWidth: 2,
              borderColor: color.text.primary,
            },
          ]}
        />
      )}
      {pin !== undefined && (
        <View
          style={{
            position: 'absolute',
            left: mastery.pin.inset - 7,
            top: mastery.pin.inset - 7,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: mastery.pin.disc,
              height: mastery.pin.disc,
              borderRadius: mastery.pin.disc / 2,
              backgroundColor: color.text.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt variant="pinNumeral" tone="inverse" maxScale={1}>
              {pin}
            </Txt>
          </View>
        </View>
      )}
    </View>
  );
}

/** A tick drawn from two bars (no icon font), in text.inverse. */
function Tick({ box, stroke, shift }: { box: number; stroke: number; shift: number }) {
  return (
    <View
      style={{
        width: box,
        height: box,
        transform: [{ translateX: -shift / 2 }, { translateY: shift / 2 }],
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: box * 0.12,
          top: box * 0.5,
          width: box * 0.38,
          height: stroke,
          backgroundColor: color.text.inverse,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: box * 0.3,
          top: box * 0.4,
          width: box * 0.68,
          height: stroke,
          backgroundColor: color.text.inverse,
          transform: [{ rotate: '-50deg' }],
        }}
      />
    </View>
  );
}
