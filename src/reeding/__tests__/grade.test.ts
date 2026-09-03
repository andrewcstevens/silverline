import {
  computeGrade,
  wilsonCIHalfWidth,
  DEFAULT_GRADE_CONFIG,
  HONEST_CAVEAT,
} from '../grade';

describe('grade — thresholds', () => {
  it('UNGRADED when n < minSample', () => {
    expect(
      computeGrade({ sampleSize: 10, winRate: 0.9, ciHalfWidth: 0.01 }),
    ).toBe('UNGRADED');
  });

  it('PROVISIONAL when CI is wide', () => {
    expect(
      computeGrade({ sampleSize: 100, winRate: 0.6, ciHalfWidth: 0.2 }),
    ).toBe('PROVISIONAL');
  });

  it('PROVISIONAL when edge is below coin-flip baseline', () => {
    expect(
      computeGrade({ sampleSize: 400, winRate: 0.48, ciHalfWidth: 0.02 }),
    ).toBe('PROVISIONAL');
  });

  it('PROVISIONAL when edge exists but does not survive multiple-comparison correction', () => {
    // 0.55 over 200 → real edge, but not Bonferroni-significant
    const n = 200;
    const wins = 110;
    const ci = wilsonCIHalfWidth(wins, n);
    expect(computeGrade({ sampleSize: n, winRate: wins / n, ciHalfWidth: ci })).toBe(
      'PROVISIONAL',
    );
  });

  it('CALIBRATED only with large, clearly significant edge', () => {
    const n = 1000;
    const wins = 750;
    const ci = wilsonCIHalfWidth(wins, n);
    expect(computeGrade({ sampleSize: n, winRate: wins / n, ciHalfWidth: ci })).toBe(
      'CALIBRATED',
    );
  });

  it('honors custom config', () => {
    expect(
      computeGrade(
        { sampleSize: 5, winRate: 0.9, ciHalfWidth: 0.01 },
        { ...DEFAULT_GRADE_CONFIG, minSample: 3 },
      ),
    ).not.toBe('UNGRADED');
  });
});

describe('grade — honest caveat', () => {
  it('includes the Silverline compliance language verbatim', () => {
    expect(HONEST_CAVEAT).toContain('not financial advice');
    expect(HONEST_CAVEAT).toContain('random walk at the 15-minute scale');
    expect(HONEST_CAVEAT).toContain('multiple comparisons');
    expect(HONEST_CAVEAT).toContain('Past performance does not predict future results');
  });
});
