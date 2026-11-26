/**
 * Card height model shared by the server (estimates) and the client (calibration).
 *
 * The server describes every doc card with four height features, in px at the desktop reference layout:
 *   r - row chrome (padding/borders, or the key column's minimum when the value is short)
 *   c - code blocks (they never wrap, so they hardly change with the screen width)
 *   p - one line per text paragraph (`<br>`-separated piece)
 *   x - the paragraphs' characters, as lines at the reference width
 * and the height is predicted as  kr*r + kc*c + kp*p + kx*x.
 *
 * Text wraps very differently on a phone than on a desktop, while row chrome and code do not, so a single scale
 * factor cannot fit both short and long cards. The coefficients start from `priorCoeffs` (a function of the value
 * column's width, fitted on all 3,978 entries at 390/820/1440px: ~3% average error per page), and the client refines
 * them (ridge regression towards that prior) from cards that have actually been rendered. They are used for
 * everything not rendered yet: `contain-intrinsic-size` of off-screen cards (CSS variables) and placeholders of
 * not-yet-mounted chunks.
 */

export type HeightCoeffs = [kr: number, kc: number, kp: number, kx: number];
export type HeightFeatures = [r: number, c: number, p: number, x: number];

/** Used by the server to decide whether a row's text is shorter than its key label; not a client prior. */
export const DEFAULT_COEFFS: HeightCoeffs = [1, 1, 0.5, 1];

/** Width of the value column the estimates' character counts refer to. */
const REFERENCE_VALUE_COLUMN_PX = 1194;
const NARROW_VALUE_COLUMN_PX = 348;
const MID_VALUE_COLUMN_PX = 599;

/**
 * Starting coefficients for a layout, from the measured width of a card's value column and whether the key column is
 * stacked above it (phones). Mirrors the CSS fallbacks on #doc-entries-root in globals.css.
 */
export function priorCoeffs(valueColumnPx: number, stacked: boolean): HeightCoeffs {
  const width = Math.max(200, valueColumnPx || REFERENCE_VALUE_COLUMN_PX);
  if (stacked) {
    // Phones: key label above the value, text wraps in inverse proportion to the column width.
    return [1.7, 1, 0.65, 3.83 * (NARROW_VALUE_COLUMN_PX / width)];
  }
  // Side-by-side columns: linear between the fits at 599px (820 wide) and 1194px (1440 wide) value columns.
  const ratio = REFERENCE_VALUE_COLUMN_PX / width;
  const t = Math.min(1, Math.max(0, (width - MID_VALUE_COLUMN_PX) / (REFERENCE_VALUE_COLUMN_PX - MID_VALUE_COLUMN_PX)));
  return [0.8, 1, 0.72 + 0.16 * t, Math.max(0.5, 0.94 + 1.4 * (ratio - 1))];
}
export const COEFF_CSS_VARS = ['--kr', '--kc', '--kp', '--kx'] as const;
export const FEATURE_CSS_VARS = ['--r', '--c', '--p', '--x'] as const;

const CHARS_PER_LINE = 150;
const LINE_PX = 21;
const ROW_PAD_PX = 19;
const KEY_MIN_PX = 38;
const CODE_LINE_PX = 21;
const CODE_MULTI_CHROME_PX = 60;
const CODE_SINGLE_PX = 52;
const CARD_BORDER_PX = 2;

const PRE_RE_G = /<pre><code>([\s\S]*?)<\/code><\/pre>/g;
const TAG_RE_G = /<[^>]+>/g;
const ENTITY_RE_G = /&(?:#\d+|#x[\da-f]+|[a-z]+);/gi;

/** Server side: height features of one card's HTML. */
export function estimateCardFeatures(html: string): HeightFeatures {
  let rowPx = CARD_BORDER_PX;
  let codePx = 0;
  let piecePx = 0;
  let charPx = 0;
  const rows = html.split('<tr');
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const secondTd = row.indexOf('<td', row.indexOf('</td>'));
    let value = secondTd === -1 ? row : row.slice(secondTd);
    let rowCode = 0;
    if (value.includes('<pre>')) {
      value = value.replace(PRE_RE_G, (_, code: string) => {
        const lines = code.replace(/\n+$/, '').split('\n').length;
        rowCode += lines > 1 ? CODE_MULTI_CHROME_PX + lines * CODE_LINE_PX : CODE_SINGLE_PX;
        return '<br>';
      });
    }
    let rowPieces = 0;
    let rowChars = 0;
    for (const piece of value.split(/<br\s*\/?>/)) {
      const visible = piece.replace(TAG_RE_G, '').replace(ENTITY_RE_G, '_').replace(/\s+/g, ' ').trim().length;
      if (visible > 0) {
        rowPieces++;
        rowChars += visible;
      }
    }
    const rowPiecePx = rowPieces * LINE_PX;
    const rowCharPx = (rowChars / CHARS_PER_LINE) * LINE_PX;
    const content = rowCode + DEFAULT_COEFFS[2] * rowPiecePx + DEFAULT_COEFFS[3] * rowCharPx;
    rowPx += Math.max(ROW_PAD_PX, KEY_MIN_PX - content);
    codePx += rowCode;
    piecePx += rowPiecePx;
    charPx += rowCharPx;
  }
  return [Math.round(rowPx), Math.round(codePx), Math.round(piecePx), Math.round(charPx)];
}

export function predictHeight(f: HeightFeatures | number[], k: HeightCoeffs | number[] = DEFAULT_COEFFS): number {
  return f[0] * k[0] + f[1] * k[1] + f[2] * k[2] + f[3] * k[3];
}

/** `style` attribute value carrying a card's features for the CSS `contain-intrinsic-size` formula. */
export function featuresStyle(f: HeightFeatures): string {
  return FEATURE_CSS_VARS.map((v, i) => `${v}:${f[i]}`).join(';');
}

/** Matches the style written by `featuresStyle`, capturing r, c, p, x. */
export const FEATURES_STYLE_RE_SRC = 'style="--r:(\\d+);--c:(\\d+);--p:(\\d+);--x:(\\d+)"';

const COEFF_MIN: HeightCoeffs = [0.5, 0.6, 0.2, 0.5];
const COEFF_MAX: HeightCoeffs = [4, 2, 4, 8];
/** Ridge strength (px²): roughly "one card's worth" of evidence for the prior (best in offline simulation). */
const RIDGE_LAMBDA = 60_000;

/** Client side: accumulates rendered cards and fits the coefficients. */
export class HeightCalibrator {
  private xtx = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  private xty = [0, 0, 0, 0];
  samples = 0;
  sampledPx = 0;

  constructor(private readonly prior: HeightCoeffs) {}

  add(f: HeightFeatures, real: number): void {
    for (let i = 0; i < 4; i++) {
      this.xty[i] += f[i] * real;
      for (let j = 0; j < 4; j++) this.xtx[i * 4 + j] += f[i] * f[j];
    }
    this.samples++;
    this.sampledPx += real;
  }

  /** Ridge solution towards the prior, clamped to sane ranges. */
  solve(): HeightCoeffs {
    const a = this.xtx.slice();
    const b = this.xty.slice();
    for (let i = 0; i < 4; i++) {
      a[i * 4 + i] += RIDGE_LAMBDA;
      b[i] += RIDGE_LAMBDA * this.prior[i];
    }
    const k = gaussSolve4(a, b) || this.prior.slice();
    return k.map((v, i) => Math.min(COEFF_MAX[i], Math.max(COEFF_MIN[i], v))) as HeightCoeffs;
  }
}

function gaussSolve4(a: number[], b: number[]): number[] | null {
  const n = 4;
  const m = a.slice();
  const v = b.slice();
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row * n + col]) > Math.abs(m[pivot * n + col])) pivot = row;
    }
    if (Math.abs(m[pivot * n + col]) < 1e-9) return null;
    if (pivot !== col) {
      for (let j = 0; j < n; j++) [m[col * n + j], m[pivot * n + j]] = [m[pivot * n + j], m[col * n + j]];
      [v[col], v[pivot]] = [v[pivot], v[col]];
    }
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row * n + col] / m[col * n + col];
      if (factor === 0) continue;
      for (let j = col; j < n; j++) m[row * n + j] -= factor * m[col * n + j];
      v[row] -= factor * v[col];
    }
  }
  return v.map((x, i) => x / m[i * n + i]);
}
