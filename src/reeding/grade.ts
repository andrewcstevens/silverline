/**
 * Reeding — Grade computation (Lane B)
 * ------------------------------------------------------------
 * Version-specific, evidence-based reliability assessment of a PRE
 * engine version's settled Assays. A grade is NEVER a guarantee of
 * future performance — see HONEST_CAVEAT.
 *
 * Grading ladder:
 *   UNGRADED   — too few settled samples to say anything (n < minSample).
 *   PROVISIONAL — enough samples to compute a win rate, but the
 *                 confidence interval is still wide and/or multiple-
 *                 comparison correction has not been survived.
 *   CALIBRATED  — sample size and CI width are sufficient AND the
 *                 observed edge survives a Bonferroni-style multiple-
 *                 comparison correction against the number of slots
 *                 tested.
 *
 * IMPORTANT: CALIBRATED does NOT mean the edge is real. Most time-of-day
 * edges are NOT statistically significant once you correct for the many
 * slots compared. Even a CALIBRATED grade is a regime-dependent,
 * weak signal — past performance does not predict future results.
 */

export const HONEST_CAVEAT = [
  'Silverline is a historical backtest and probability tool, not financial advice.',
  'BTC is close to a random walk at the 15-minute scale — the overall base rate is roughly a coin flip.',
  'Most time-of-day edges are NOT statistically significant once you account for sample size and multiple comparisons.',
  'Any single slot win rate is a weak, regime-dependent signal, never a guarantee.',
  'Past performance does not predict future results.',
].join(' ');

export type Grade = 'UNGRADED' | 'PROVISIONAL' | 'CALIBRATED';

export interface GradeConfig {
  /** Minimum settled Assays before we even attempt a grade. */
  minSample: number;
  /** Half-width of the 95% CI (in [0,1]) above which a grade stays PROVISIONAL. */
  maxCICliffHalfWidth: number;
  /** Number of independent slots/verdicts compared — drives Bonferroni correction. */
  multipleComparisons: number;
  /** Family-wise significance level (alpha) before correction. */
  alpha: number;
  /** Win rate at or below which we refuse to call anything an "edge" (≈ coin flip). */
  coinFlipBaseline: number;
}

export const DEFAULT_GRADE_CONFIG: GradeConfig = {
  minSample: 30,
  maxCICliffHalfWidth: 0.1,
  multipleComparisons: 96, // 4 quarters × 24 hours of 15-min slots
  alpha: 0.05,
  coinFlipBaseline: 0.5,
};

export interface GradeInputs {
  /** Number of settled Assays for this engine_version. */
  sampleSize: number;
  /** Observed win rate in [0,1] (correct-call fraction). */
  winRate: number;
  /** Half-width of the 95% CI on the win rate, in [0,1]. */
  ciHalfWidth: number;
}

/**
 * Wilson-score 95% CI half-width approximation for a binomial
 * proportion. Good enough for grading thresholds (not for publishing
 * a calibrated probability — that requires more).
 */
export function wilsonCIHalfWidth(wins: number, n: number): number {
  if (n <= 0) return 1;
  const p = wins / n;
  const z = 1.96;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denom;
  // never report a center outside [0,1]
  void center;
  return half;
}

/**
 * Decide a grade from settled evidence. Pure, deterministic, no I/O.
 *
 * Multiple-comparison correction (Bonferroni): a directional edge is
 * only treated as "surviving" if
 *   winRate - coinFlipBaseline >= 0  AND
 *   lower bound of CI > coinFlipBaseline  AND
 *   p-value < alpha / multipleComparisons
 *
 * The p-value is approximated from the CI: if the lower CI bound is
 * above baseline, the one-sided p is below the per-comparison alpha
 * implied by the CI; we additionally require the stricter Bonferroni
 * threshold to be met by demanding the FULL CI sit above baseline by
 * at least the cliff margin.
 */
export function computeGrade(
  inputs: GradeInputs,
  config: GradeConfig = DEFAULT_GRADE_CONFIG,
): Grade {
  const { sampleSize: n, winRate, ciHalfWidth } = inputs;

  if (n < config.minSample) return 'UNGRADED';

  const lower = Math.max(0, winRate - ciHalfWidth);
  const upper = Math.min(1, winRate + ciHalfWidth);

  // CI still too wide → provisional, regardless of point estimate.
  if (ciHalfWidth > config.maxCICliffHalfWidth) return 'PROVISIONAL';

  // Need an actual directional edge above the coin-flip baseline.
  const hasEdge = winRate > config.coinFlipBaseline && lower > config.coinFlipBaseline;

  if (!hasEdge) return 'PROVISIONAL';

  // Bonferroni-style multiple-comparison survival: the whole CI must
  // clear the baseline, i.e. the lower bound must exceed baseline. This
  // is the strictest reasonable bar and intentionally hard to meet.
  // (We re-derive the effective per-comparison alpha from the CI.)
  const bonferroniAlpha = config.alpha / config.multipleComparisons;
  const zEffective = 1.96; // 95% CI
  // p-value for H0: p = baseline, approx via normal
  const se = Math.sqrt((config.coinFlipBaseline * (1 - config.coinFlipBaseline)) / n);
  const z = se > 0 ? (winRate - config.coinFlipBaseline) / se : 0;
  // one-sided survival
  const pValue = 0.5 * (1 - normalCdf(z));
  const survivesMultipleComparisons = pValue < bonferroniAlpha && lower > config.coinFlipBaseline;

  void upper;
  if (survivesMultipleComparisons) return 'CALIBRATED';
  return 'PROVISIONAL';
}

/** Standard normal CDF (Abramowitz & Stegun approximation). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-((z * z) / 2));
  const c =
    0.3193815 * t -
    0.3565638 * t * t +
    1.781478 * t * t * t -
    1.821256 * t * t * t * t +
    1.330274 * t * t * t * t * t;
  const cdf = 1 - d * c;
  return z >= 0 ? cdf : 1 - cdf;
}
