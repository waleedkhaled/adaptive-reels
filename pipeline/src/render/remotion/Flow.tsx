// Boxes and arrows from the dry layout pass (layout.ts layoutFlowDiagram).
// Boxes: bg.raised, 2 px text.secondary outline, radius 16, labels left-aligned.
// Arrows: 3 px text.primary with solid heads; labels on bg.base knockout plates.
// Boxes fade in in node order, then the arrows, 4 frames apart.
import { Fragment } from 'react';
import { reel } from '@reels/tokens';
import { AXIS_X, FLOW, STACK, TEXT_WIDTH, type FlowLayout } from '../layout';
import { color, cssStack, TEXT, useMotion } from './theme';

const OUTLINE = 2;

export function FlowDiagram({ flow }: { flow: FlowLayout }) {
  const { fade, fadeFrames, step } = useMotion();
  const boxAt = (order: number) => fade(order * step);
  const lastBox = Math.max(...flow.boxes.map((b) => b.order));
  const arrowsFrom = lastBox * step + fadeFrames;
  const arrowAt = (k: number) => fade(arrowsFrom + k * step);
  const edge = reel.flow.edgeLabel;
  return (
    <div
      style={{
        position: 'absolute',
        left: AXIS_X,
        top: flow.top,
        width: TEXT_WIDTH,
        height: flow.height,
      }}
    >
      <svg
        width={TEXT_WIDTH}
        height={flow.height}
        viewBox={`0 0 ${TEXT_WIDTH} ${flow.height}`}
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
      >
        {flow.arrows.map((a, k) => (
          <g key={`a${k}`} opacity={arrowAt(k)}>
            <path
              d={a.path}
              stroke={color.text.primary}
              strokeWidth={reel.flow.arrow}
              fill="none"
            />
            <path d={a.head} fill={color.text.primary} />
          </g>
        ))}
        {flow.arrows.map((a, k) =>
          a.label ? (
            <rect
              key={`p${k}`}
              x={a.label.cx - a.label.w / 2}
              y={a.label.cy - a.label.h / 2}
              width={a.label.w}
              height={a.label.h}
              fill={color.bg.base}
              opacity={arrowAt(k)}
            />
          ) : null,
        )}
        {flow.boxes.map((b) => (
          <rect
            key={b.id}
            x={b.x + OUTLINE / 2}
            y={b.y + OUTLINE / 2}
            width={b.w - OUTLINE}
            height={b.h - OUTLINE}
            rx={reel.flow.radius}
            fill={color.bg.raised}
            stroke={color.text.secondary}
            strokeWidth={OUTLINE}
            opacity={boxAt(b.order)}
          />
        ))}
      </svg>
      {flow.arrows.map((a, k) =>
        a.label ? (
          <div
            key={`l${k}`}
            style={{
              ...TEXT,
              position: 'absolute',
              left: a.label.cx - a.label.w / 2 + FLOW.plate.padX,
              top: a.label.cy - edge.lineHeight / 2,
              height: edge.lineHeight,
              color: color.text.primary,
              fontFamily: cssStack(STACK.edgeLabel),
              fontSize: edge.size,
              lineHeight: `${edge.lineHeight}px`,
              opacity: arrowAt(k),
            }}
          >
            {a.label.text}
          </div>
        ) : null,
      )}
      {flow.boxes.map((b) => (
        <div
          key={`t${b.id}`}
          style={{
            ...TEXT,
            position: 'absolute',
            left: b.x + FLOW.padX,
            top: b.y + (b.h - b.lines.length * flow.labelLineHeight) / 2,
            color: color.text.primary,
            fontFamily: cssStack(STACK.display600),
            fontSize: flow.labelSize,
            lineHeight: `${flow.labelLineHeight}px`,
            opacity: boxAt(b.order),
          }}
        >
          {b.lines.map((line, i) => (
            <Fragment key={i}>
              <div style={{ height: flow.labelLineHeight }}>{line}</div>
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
