/**
 * Silverline PRE — Predictive Reeding Engine (Lane C).
 * ------------------------------------------------------------
 * The REAL edge engine. Pure, deterministic, no I/O, no deps. Node 20 ESM.
 *
 * This replaces the previous placeholder verdict (`side: "PLACEHOLDER"`).
 * It consumes the SAME slimmed settled-market records the snapshot produces
 * ({t,s,r,f,v,c,...}) and produces an honestly-graded report: per-slot stats,
 * a Bonferroni-corrected significance ladder, AND a chronological
 * walk-forward / out-of-sample validation that prevents the same data from
 * both selecting and confirming an edge.
 *
 * Grading math is ported faithfully from silverline-integ/src/reeding/grade.ts
 * (wilsonCIHalfWidth, computeGrade, normalCdf). The Bonferroni p-value uses
 * the two-sided normal approximation specified in the engine spec:
 *   z = (upRate - 0.5) / sqrt(0.25 / n)
 *   p = 2 * (1 - Phi(|z|))
 *   survive if p < alpha / multipleComparisons.
 *
 * HONESTY: CALIBRATED does NOT mean the edge is real. The honestVerdict field
 * is the source of truth. If zero slots survive calibration AND out-of-sample
 * validation, it says so plainly. BTC 15-min is near a coin flip; the engine
 * is willing to confirm "no edge." Do not bet on noise.
 */

"use strict";

export const HONEST_CAVEAT = [
  "Silverline is a historical backtest and probability tool, not financial advice.",
  "BTC is close to a random walk at the 15-minute scale — the overall base rate is roughly a coin flip.",
  "Most time-of-day edges are NOT statistically significant once you account for sample size and multiple comparisons.",
  "Any single slot win rate is a weak, regime-dependent signal, never a guarantee.",
  "Past performance does not predict future results.",
].join(" ");

export const DEFAULT_PRE_CONFIG = {
  /** Minimum resolved samples per slot before we even attempt a grade. */
  minSample: 30,
  /** Number of independent slots compared — drives Bonferroni correction. */
  multipleComparisons: 96, // 4 per hour x 24 hours of 15-min slots
  /** Family-wise significance level (alpha) before correction. */
  alpha: 0.05,
  /** Win rate at or below which we refuse to call anything an edge (= coin flip). */
  coinFlipBaseline: 0.5,
  /** Walk-forward split: fraction of the chronological sample used as training. */
  walkForwardTrainFrac: 0.7,
  /** Minimum held-out (test) samples per slot before we trust a persistence check. */
  minTestSample: 5,
  /** Number of UTC 15-min slots in a day. */
  slots: 96,
  /** Wilson z for 95% CI. */
  z: 1.96,
  /** How many pages of settled markets the route should pull (tunable for testing). */
  fetchPages: 6,
};

/**
 * Wilson-score 95% CI for a binomial proportion (yes / (yes+no)).
 * Ported from grade.ts `wilsonCIHalfWidth`. Returns center + [lo, hi] + half.
 */
export function wilsonCI(yes, n, z = 1.96) {
  if (n <= 0) return { center: 0, lo: 0, hi: 0, half: 1 };
  const p = yes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denom;
  return {
    center,
    lo: Math.max(0, center - half),
    hi: Math.min(1, center + half),
    half,
  };
}

/** Standard normal CDF (Abramowitz & Stegun). Ported from grade.ts. */
export function normalCdf(z) {
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

/**
 * Two-sided p-value for a binomial test of H0: upRate = baseline.
 * Normal approximation: z = (upRate - baseline) / sqrt(baseline*(1-baseline)/n),
 * two-sided p = 2 * (1 - Phi(|z|)). Specified by the engine spec.
 */
export function binomPTwoSided(upRate, n, baseline = 0.5) {
  if (n <= 0) return 1;
  const se = Math.sqrt((baseline * (1 - baseline)) / n);
  if (se <= 0) return 1;
  const z = (upRate - baseline) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/** slot index 0..95 from an ISO close_time (UTC). Mirrors the frontend slotIdx. */
export function slotIdxFromISO(iso) {
  if (!iso) return -1;
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  if (Number.isNaN(d.getTime())) return -1;
  return Math.floor((d.getUTCHours() * 60 + d.getUTCMinutes()) / 15);
}

/** "HH:MM UTC" label for a slot index 0..95. */
export function slotLabel(i) {
  if (i < 0 || i > 95) return "—";
  const h = Math.floor((i * 15) / 60);
  const m = (i * 15) % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + " UTC";
}

/**
 * Grade a single slot from full-sample stats. Ported from grade.ts
 * `computeGrade`, made bidirectional (UP and DOWN edges) and using the
 * two-sided Bonferroni p-value from the engine spec.
 *
 *   UNGRADED   — n < minSample.
 *   PROVISIONAL — enough samples, but the 95% CI does not exclude the
 *                 coin-flip baseline (no directional edge), OR it excludes
 *                 0.5 but fails the Bonferroni multiple-comparison gate.
 *   CALIBRATED  — CI excludes 0.5 AND two-sided p < alpha/multipleComparisons.
 *
 * The "CI excludes 0.5" check already encodes the CI-width requirement (a
 * wide CI cannot exclude the baseline), so the separate maxCICliffHalfWidth
 * gate from grade.ts is intentionally not double-applied here.
 */
export function computeGrade(n, upRate, ciHalfWidth, config = DEFAULT_PRE_CONFIG) {
  if (n < config.minSample) return "UNGRADED";
  const lower = Math.max(0, upRate - ciHalfWidth);
  const upper = Math.min(1, upRate + ciHalfWidth);
  const baseline = config.coinFlipBaseline;

  const upEdge = upRate > baseline && lower > baseline;
  const downEdge = upRate < baseline && upper < baseline;
  const ciExcludesBaseline = upEdge || downEdge;
  if (!ciExcludesBaseline) return "PROVISIONAL";

  const p = binomPTwoSided(upRate, n, baseline);
  const bonferroniAlpha = config.alpha / config.multipleComparisons;
  return p < bonferroniAlpha ? "CALIBRATED" : "PROVISIONAL";
}

/** Side label from an upRate vs baseline. */
function sideOf(upRate, baseline = 0.5) {
  if (upRate > baseline) return "UP";
  if (upRate < baseline) return "DOWN";
  return "FLAT";
}

/**
 * The PRE engine. Pure: takes the slimmed settled-market array (the same shape
 * the snapshot produces — each row has `r` ("yes"/"no") and `c` (close_time
 * ISO UTC)) and returns the graded report. No fetching, no I/O.
 *
 * Walk-forward: settled markets are sorted chronologically; the oldest 70% are
 * the TRAINING set, the newest 30% the held-out TEST set. Per-slot edges are
 * computed on the training set; a slot is "out-of-sample validated" only if
 * its training-set directional edge persists (same side of 0.5) in the test
 * window. This is the data-snooping guard: the same data must NOT both select
 * and report the edge.
 */
export function gradeSettled(settled, config = DEFAULT_PRE_CONFIG) {
  const cfg = { ...DEFAULT_PRE_CONFIG, ...config };
  const { slots, z, coinFlipBaseline, walkForwardTrainFrac, minTestSample } = cfg;

  const fetchedAt = new Date().toISOString();

  // Keep only resolved markets with a parseable close_time.
  const resolved = (settled || [])
    .filter((m) => m && (m.r === "yes" || m.r === "no") && m.c)
    .map((m) => ({ result: m.r, close: m.c, slot: slotIdxFromISO(m.c) }))
    .filter((m) => m.slot >= 0 && m.slot < slots);

  // Sort chronologically (oldest first) for walk-forward.
  resolved.sort((a, b) => Date.parse(a.close) - Date.parse(b.close));

  const settledCount = resolved.length;
  const oldest = settledCount ? resolved[0].close : null;
  const newest = settledCount ? resolved[settledCount - 1].close : null;

  // Walk-forward split.
  const splitIdx = Math.max(1, Math.floor(settledCount * walkForwardTrainFrac));
  const train = resolved.slice(0, splitIdx);
  const test = resolved.slice(splitIdx);
  const splitAt = test.length ? test[0].close : newest;

  const emptyAcc = () => ({ yes: 0, no: 0 });
  const trainAcc = Array.from({ length: slots }, emptyAcc);
  const testAcc = Array.from({ length: slots }, emptyAcc);
  const fullAcc = Array.from({ length: slots }, emptyAcc);

  for (const m of train) {
    if (m.result === "yes") trainAcc[m.slot].yes++;
    else trainAcc[m.slot].no++;
  }
  for (const m of test) {
    if (m.result === "yes") testAcc[m.slot].yes++;
    else testAcc[m.slot].no++;
  }
  for (const m of resolved) {
    if (m.result === "yes") fullAcc[m.slot].yes++;
    else fullAcc[m.slot].no++;
  }

  const slotRows = [];
  for (let i = 0; i < slots; i++) {
    const f = fullAcc[i];
    const n = f.yes + f.no;
    const upRate = n > 0 ? f.yes / n : 0;
    const ci = wilsonCI(f.yes, n, z);
    const edge = upRate - coinFlipBaseline;
    const grade = computeGrade(n, upRate, ci.half, cfg);

    // Out-of-sample persistence (training-set edge vs held-out test window).
    const tr = trainAcc[i];
    const te = testAcc[i];
    const trainN = tr.yes + tr.no;
    const testN = te.yes + te.no;
    const trainUpRate = trainN > 0 ? tr.yes / trainN : 0;
    const trainEdge = trainUpRate - coinFlipBaseline;
    const testUpRate = testN > 0 ? te.yes / testN : 0;

    let survivesOutOfSample = false;
    if (trainN >= cfg.minSample && testN >= minTestSample) {
      if (trainEdge > 0 && testUpRate > coinFlipBaseline) survivesOutOfSample = true;
      else if (trainEdge < 0 && testUpRate < coinFlipBaseline) survivesOutOfSample = true;
    }

    slotRows.push({
      slot: i,
      label: slotLabel(i),
      n,
      upRate: round4(upRate),
      ci: [round4(ci.lo), round4(ci.hi)],
      edge: round4(edge),
      side: sideOf(upRate, coinFlipBaseline),
      grade,
      survivesOutOfSample,
      trainUpRate: round4(trainUpRate),
      trainN,
      testUpRate: round4(testUpRate),
      testN,
    });
  }

  const calibrated = slotRows.filter((s) => s.grade === "CALIBRATED");
  const provisional = slotRows.filter((s) => s.grade === "PROVISIONAL");
  // A slot is a real, validated edge only if it is CALIBRATED on the full
  // sample AND its training-set edge persists out-of-sample.
  const survivors = calibrated
    .filter((s) => s.survivesOutOfSample)
    .sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge));
  const topCalibrated = survivors.length ? survivors[0].slot : null;

  const calibratedCount = calibrated.length;
  const provisionalCount = provisional.length;
  const oosSurvivorCount = survivors.length;

  let honestVerdict;
  if (oosSurvivorCount === 0) {
    honestVerdict =
      "NO DECISION-GRADE EDGE DETECTED — BTC 15-min is consistent with a random walk. " +
      "Zero slots survived both Bonferroni calibration and out-of-sample walk-forward validation. " +
      "Do not bet on noise. Of " +
      slots +
      " slots, " +
      calibratedCount +
      " reached CALIBRATED on the full sample and " +
      oosSurvivorCount +
      " persisted out-of-sample. Treat any per-slot tilt below as unvalidated descriptive statistics, not a signal.";
  } else {
    const lines = survivors.slice(0, 5).map((s) => {
      return `${s.label} (${s.side}, full-sample up-rate ${(s.upRate * 100).toFixed(1)}%, n=${s.n}, edge ${(s.edge >= 0 ? "+" : "") + (s.edge * 100).toFixed(1)}pp; train up-rate ${(s.trainUpRate * 100).toFixed(1)}% → test up-rate ${(s.testUpRate * 100).toFixed(1)}%, n_test=${s.testN})`;
    });
    honestVerdict =
      `${oosSurvivorCount} slot(s) survived both Bonferroni calibration AND out-of-sample walk-forward validation: ` +
      lines.join("; ") +
      `. These are weak, regime-dependent historical tilts — NOT a forecast and NOT a guarantee. Past performance does not predict future results. ${HONEST_CAVEAT}`;
  }

  return {
    fetchedAt,
    engine: "PRE v1.0 (Predictive Reeding Engine)",
    settledCount,
    samplePeriod: { oldest, newest },
    walkForward: {
      trainCount: train.length,
      testCount: test.length,
      splitAt,
      trainFrac: walkForwardTrainFrac,
      minTestSample,
    },
    config: {
      minSample: cfg.minSample,
      multipleComparisons: cfg.multipleComparisons,
      alpha: cfg.alpha,
      coinFlipBaseline: cfg.coinFlipBaseline,
      bonferroniAlpha: cfg.alpha / cfg.multipleComparisons,
    },
    slots: slotRows,
    verdict: {
      calibratedCount,
      provisionalCount,
      ungradedCount: slotRows.length - calibratedCount - provisionalCount,
      oosSurvivorCount,
      topCalibrated,
      topCalibratedLabel: topCalibrated != null ? slotLabel(topCalibrated) : null,
      honestVerdict,
    },
    honestVerdict,
    caveat: HONEST_CAVEAT,
  };
}

function round4(x) {
  if (!Number.isFinite(x)) return x;
  return Math.round(x * 1e4) / 1e4;
}
