/** OKLCH to linear-ish sRGB [0..1] triplet for shaders. Hue in degrees. */
export function oklchToRgb(
  l: number,
  c: number,
  h: number
): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const l_ = l + 0.396_337_777_4 * a + 0.215_803_757_3 * b;
  const m_ = l - 0.105_561_345_8 * a - 0.063_854_172_8 * b;
  const s_ = l - 0.089_484_177_5 * a - 1.291_485_548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  const r = 4.076_741_662_1 * L - 3.307_711_591_3 * M + 0.230_969_929_2 * S;
  const g = -1.268_438_004_6 * L + 2.609_757_401_1 * M - 0.341_319_396_5 * S;
  const bl = -0.004_196_086_3 * L - 0.703_418_614_7 * M + 1.707_614_701 * S;

  const encode = (x: number) => {
    const v = Math.min(1, Math.max(0, x));
    return v <= 0.003_130_8 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  return [encode(r), encode(g), encode(bl)];
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** "#rrggbb" to an sRGB [0..1] triplet. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const channel = (i: number) => Number.parseInt(h.slice(i, i + 2), 16) / 255;
  return [channel(0), channel(2), channel(4)];
}
