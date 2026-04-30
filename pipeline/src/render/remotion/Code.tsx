// The code band (DESIGN.md "Code block"): edge to edge, bg.raised between two
// 2 px rules, no radius, no shadow, no window dots. Lines fade in 4 frames
// apart; once all are in, highlighted lines get a bg.overlay row and the other
// lines drop to text.secondary. Mistakes: rules in `error` and a top-right
// "Mistake" label with a drawn xmark.
import { reel } from '@reels/tokens';
import { interpolateColors } from 'remotion';
import { CODE_BAND, STACK, type CodeLayout } from '../layout';
import { highlightCode } from '../syntax';
import { color, cssStack, SYNTAX, TEXT, useMotion } from './theme';

function XMark({ size }: { size: number }) {
  const inset = 3;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <path
        d={`M ${inset} ${inset} L ${size - inset} ${size - inset} M ${size - inset} ${inset} L ${inset} ${size - inset}`}
        stroke={color.error.base}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function CodeBand({ code, language }: { code: CodeLayout; language: string }) {
  const { fade, fadeFrames, step } = useMotion();
  const lines = highlightCode(code.lines.join('\n'), language);
  const revealed = (code.lines.length - 1) * step + fadeFrames;
  const emphasis = code.highlight.length ? fade(revealed) : 0;
  const rule = code.mistake ? color.error.base : color.line.hairline;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: code.top,
        width: reel.canvas.width,
        height: code.height,
        boxSizing: 'border-box',
        background: color.bg.raised,
        borderTop: `${CODE_BAND.rule}px solid ${rule}`,
        borderBottom: `${CODE_BAND.rule}px solid ${rule}`,
        paddingTop: CODE_BAND.padY,
        opacity: fade(),
      }}
    >
      {code.mistake && (
        <div
          style={{
            ...TEXT,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: CODE_BAND.xmarkGap,
            height: reel.mistakeLabel.lineHeight,
            marginBottom: CODE_BAND.labelGap,
            paddingRight: code.inset,
            color: color.error.base,
            fontFamily: cssStack(STACK.mistake),
            fontSize: reel.mistakeLabel.size,
            lineHeight: `${reel.mistakeLabel.lineHeight}px`,
          }}
        >
          <XMark size={CODE_BAND.xmark} />
          <span>Mistake</span>
        </div>
      )}
      {lines.map((tokens, i) => {
        const hot = code.highlight.includes(i + 1);
        const dim = code.highlight.length > 0 && !hot;
        return (
          <div
            key={i}
            style={{
              position: 'relative',
              height: code.lineHeight,
              opacity: fade(i * step),
            }}
          >
            {hot && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: color.bg.overlay,
                  opacity: emphasis,
                }}
              />
            )}
            <div
              style={{
                ...TEXT,
                position: 'relative',
                paddingLeft: code.inset,
                fontFamily: cssStack(STACK.code),
                fontSize: code.size,
                lineHeight: `${code.lineHeight}px`,
              }}
            >
              {tokens.map((t, j) => (
                <span
                  key={j}
                  style={{
                    color: dim
                      ? interpolateColors(emphasis, [0, 1], [SYNTAX[t.role], color.text.secondary])
                      : SYNTAX[t.role],
                    fontFamily: t.role === 'keyword' ? cssStack(STACK.codeKeyword) : undefined,
                  }}
                >
                  {t.text}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
