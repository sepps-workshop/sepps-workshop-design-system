/**
 * color.mjs — colour maths shared by the build tools and by ports.
 * Hex in, hex or number out. No dependencies.
 */

/** "#rrggbb" → [r, g, b], each 0..255. */
export function parseHex(hex) {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Bad hex color: ${hex}`);
  }
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** [r, g, b] → "#rrggbb", clamped and rounded. */
export function toHex(rgb) {
  return (
    "#" +
    rgb
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** Mix in gamma-encoded sRGB: `a` weighted p, `b` weighted 1 − p. */
export function mix(a, b, p) {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex(x.map((v, i) => v * p + y[i] * (1 - p)));
}

/** Composite a translucent foreground over an opaque background. */
export function alphaOver(fg, bg, alpha) {
  return mix(fg, bg, alpha);
}

/** A brand tint: pct % of the base colour, the rest white. */
export function tint(base, pct) {
  return mix(base, "#ffffff", pct / 100);
}

const linear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance. */
export function relLum(hex) {
  const [r, g, b] = parseHex(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1..21. */
export function contrast(a, b) {
  const x = relLum(a);
  const y = relLum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** sRGB hex → OKLab [L, a, b] (L in 0..1). */
export function oklab(hex) {
  const [r, g, b] = parseHex(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Perceptual distance: OKLab Euclidean × 100. About 2 is just noticeable. */
export function deltaE(a, b) {
  const x = oklab(a);
  const y = oklab(b);
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** OKLab hue angle in radians. */
export function hueAngle(hex) {
  const [, a, b] = oklab(hex);
  return Math.atan2(b, a);
}

/**
 * APCA lightness contrast (Lc), APCA-W3 0.0.98G-4g constants.
 * Negative for light text on a dark background. Report only — not a gate.
 */
export function apca(text, bg) {
  const y = (hex) => {
    const [r, g, b] = parseHex(hex).map((v) => (v / 255) ** 2.4);
    const lum = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    return lum < 0.022 ? lum + (0.022 - lum) ** 1.414 : lum;
  };
  const yt = y(text);
  const yb = y(bg);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return s > -0.1 ? 0 : (s + 0.027) * 100;
}
