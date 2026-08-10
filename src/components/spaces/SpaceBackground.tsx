'use client';

interface SpaceBackgroundProps {
  spaceId: string;
  spaceColor: string;
}

/**
 * Deterministic LCG seeded from a string.
 * Same spaceId always produces the same sequence — the pattern is permanent
 * for the lifetime of the space, and unique across spaces.
 */
function makeRng(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0;
  }
  // Ensure odd so the LCG period is maximal.
  s = s | 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) || 100,
    g: parseInt(clean.slice(2, 4), 16) || 130,
    b: parseInt(clean.slice(4, 6), 16) || 160,
  };
}

interface Blob {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
  opacity: number;
}

interface Curve {
  d: string;
  opacity: number;
}

function generateElements(
  spaceId: string
): { blobs: Blob[]; curves: Curve[] } {
  const rng = makeRng(spaceId);

  // W × H of the SVG viewport.
  const W = 1200;
  const H = 800;

  // Five soft blobs. To keep them atmospheric rather than centred on content,
  // we bias their positions toward the edges and corners.
  const edgeBias = (): { cx: number; cy: number } => {
    const side = Math.floor(rng() * 4); // 0=top, 1=right, 2=bottom, 3=left
    switch (side) {
      case 0: return { cx: rng() * W,         cy: -80 + rng() * 200 };
      case 1: return { cx: W + 80 - rng() * 200, cy: rng() * H };
      case 2: return { cx: rng() * W,         cy: H + 80 - rng() * 200 };
      default:return { cx: -80 + rng() * 200, cy: rng() * H };
    }
  };

  const blobs: Blob[] = Array.from({ length: 5 }, () => {
    const { cx, cy } = edgeBias();
    return {
      cx,
      cy,
      rx: 160 + rng() * 220,
      ry: 100 + rng() * 180,
      rotation: rng() * 360,
      opacity: 0.08 + rng() * 0.07, // 8–15 % before blur softens it further
    };
  });

  // Three flowing cubic-bezier lines that cross the full width of the viewport.
  // They are thin and very faint — a whisper of contour lines on a map.
  const curves: Curve[] = Array.from({ length: 3 }, () => {
    const y0 = 60 + rng() * (H - 120);
    const y1 = 60 + rng() * (H - 120);
    const cp1x = 200 + rng() * 300;
    const cp1y = rng() * H;
    const cp2x = 700 + rng() * 300;
    const cp2y = rng() * H;
    return {
      d: `M -60 ${y0.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${W + 60} ${y1.toFixed(1)}`,
      opacity: 0.1 + rng() * 0.08,
    };
  });

  return { blobs, curves };
}

export function SpaceBackground({ spaceId, spaceColor }: SpaceBackgroundProps) {
  const { blobs, curves } = generateElements(spaceId);
  const { r, g, b } = hexToRgb(spaceColor);

  // Unique filter ID so multiple instances on one page (e.g. sidebar previews)
  // don't share the same <filter> element.
  const filterId = `ruang-blob-blur-${spaceId.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/*
           * stdDeviation 70 turns each ellipse into a soft watercolour wash.
           * x/y/width/height on the filter are expanded so the blur doesn't
           * get clipped at the SVG viewport boundary.
           */}
          <filter
            id={filterId}
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="70" />
          </filter>
        </defs>

        {/* Blobs — heavily blurred ellipses that read as soft washes of colour */}
        <g filter={`url(#${filterId})`}>
          {blobs.map((blob, i) => (
            <ellipse
              key={i}
              cx={blob.cx}
              cy={blob.cy}
              rx={blob.rx}
              ry={blob.ry}
              fill={`rgb(${r},${g},${b})`}
              opacity={blob.opacity}
              transform={`rotate(${blob.rotation.toFixed(1)},${blob.cx.toFixed(1)},${blob.cy.toFixed(1)})`}
            />
          ))}
        </g>

        {/* Flowing curves — unblurred, thin, very faint */}
        {curves.map((curve, i) => (
          <path
            key={i}
            d={curve.d}
            fill="none"
            stroke={`rgb(${r},${g},${b})`}
            strokeWidth="1.2"
            opacity={curve.opacity}
          />
        ))}
      </svg>
    </div>
  );
}
