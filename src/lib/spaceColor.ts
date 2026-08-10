/**
 * Chip styling derived from a space's own colour.
 *
 * Space colours are user-chosen and arbitrary, so a chip cannot use fixed
 * tokens: it tints the background towards white and darkens the text until it
 * clears WCAG AA against that tint. Otherwise a pale space colour (say sand)
 * would render as unreadable light-on-light.
 */

const FALLBACK = '#738290';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(value: string | null | undefined): Rgb {
  const hex = (value || FALLBACK).trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex.length === 6
      ? hex
      : FALLBACK.replace('#', '');
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return parseHex(FALLBACK);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function toCss({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** `amount` 0 → base unchanged, 1 → fully `target`. */
function mix(base: Rgb, target: Rgb, amount: number): Rgb {
  return {
    r: base.r + (target.r - base.r) * amount,
    g: base.g + (target.g - base.g) * amount,
    b: base.b + (target.b - base.b) * amount,
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface SpaceChipStyle {
  background: string;
  color: string;
  borderColor: string;
}

/** Background tint, readable text and border for a chip in `color`. */
export function spaceChipStyle(color: string | null | undefined): SpaceChipStyle {
  const base = parseHex(color);
  const background = mix(base, WHITE, 0.82);

  let text = mix(base, BLACK, 0.35);
  // Darken in steps rather than jumping straight to near-black, so vivid
  // colours keep their hue instead of all collapsing to the same dark grey.
  for (let step = 0; step < 8 && contrast(text, background) < 4.5; step++) {
    text = mix(text, BLACK, 0.15);
  }

  return {
    background: toCss(background),
    color: toCss(text),
    borderColor: toCss(mix(base, WHITE, 0.5)),
  };
}

/** Solid dot colour for tree rows and list markers. */
export function spaceDotColor(color: string | null | undefined): string {
  return toCss(parseHex(color));
}
