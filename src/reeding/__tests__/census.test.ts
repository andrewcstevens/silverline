import {
  Census,
  MemoryStorageAdapter,
  AssayAlreadyExistsError,
  AssayAlreadySettledError,
  AssayNotFrozenError,
  AssayNotFoundError,
  computeAssayId,
  type NewAssayInput,
  type SettlementInput,
  type Assay,
} from '../census';

function baseAssay(overrides: Partial<NewAssayInput> = {}): NewAssayInput {
  return {
    engine_version: 'pre-0.1',
    forecast_time: '2026-09-02T21:00:00Z',
    interval_ticker: 'KXBTC15M-26SEP022115',
    occurrence_time: '2026-09-02T21:15:00Z',
    verdict: 'BUY_UP',
    confidence: 0.62,
    rationale: 'historical skew toward up in this slot',
    market_context_snapshot: {
      target_price: 58000,
      last_price_at_forecast: 57980,
      cost_assumption_cents: 52,
    },
    ...overrides,
  };
}

function settlement(overrides: Partial<SettlementInput> = {}): SettlementInput {
  return {
    outcome: 'up',
    settlement_price: 58210,
    settled_at: '2026-09-02T21:16:00Z',
    source: 'kalshi-public',
    ...overrides,
  };
}

describe('Census — append-only / immutability', () => {
  it('computes a deterministic assay_id from engine_version+forecast_time+ticker', () => {
    const a = computeAssayId({
      engine_version: 'pre-0.1',
      forecast_time: '2026-09-02T21:00:00Z',
      interval_ticker: 'KXBTC15M-26SEP022115',
    });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    const b = computeAssayId({
      engine_version: 'pre-0.1',
      forecast_time: '2026-09-02T21:00:00Z',
      interval_ticker: 'KXBTC15M-26SEP022115',
    });
    expect(a).toBe(b);
  });

  it('appendAssay writes a FROZEN assay with settlement=null', async () => {
    const census = new Census(new MemoryStorageAdapter());
    const assay = await census.appendAssay(baseAssay());
    expect(assay.status).toBe('FROZEN');
    expect(assay.settlement).toBeNull();
    expect(assay.grade).toBeNull();
    expect(assay.schema_version).toBe('1.0.0');
  });

  it('re-freezing the identical assay is idempotent', async () => {
    const census = new Census(new MemoryStorageAdapter());
    const input = baseAssay();
    const a = await census.appendAssay(input);
    const b = await census.appendAssay(input);
    expect(b.assay_id).toBe(a.assay_id);
  });

  it('freezing a different assay under the same id (same bytes impossible — different fields) throws', async () => {
    const census = new Census(new MemoryStorageAdapter());
    await census.appendAssay(baseAssay({ verdict: 'BUY_UP' }));
    // Same engine_version/forecast/ticker → same id, but different verdict bytes.
    await expect(census.appendAssay(baseAssay({ verdict: 'WAIT' }))).rejects.toThrow(
      AssayAlreadyExistsError,
    );
  });

  it('the frozen forecast bytes are NEVER rewritten when settling', async () => {
    const mem = new MemoryStorageAdapter();
    const census = new Census(mem);
    const assay = await census.appendAssay(baseAssay());
    const frozenKey = `assay/${assay.assay_id}`;
    const frozenBytesBefore = mem._rawGet(frozenKey);
    expect(frozenBytesBefore).toBeDefined();
    const before = JSON.parse(frozenBytesBefore!);
    expect(before.status).toBe('FROZEN');
    expect(before.settlement).toBeNull();

    await census.recordSettlement(assay.assay_id, settlement());

    // The frozen key bytes must be byte-identical after settlement.
    const frozenBytesAfter = mem._rawGet(frozenKey);
    expect(frozenBytesAfter).toBe(frozenBytesBefore);
    // Settlement lives under a SEPARATE key.
    expect(mem._rawGet(`assay/${assay.assay_id}.settlement`)).toBeDefined();
  });
});

describe('Census — settlement idempotency & guards', () => {
  it('settling an unknown assay throws AssayNotFoundError', async () => {
    const census = new Census(new MemoryStorageAdapter());
    await expect(census.recordSettlement('deadbeef', settlement())).rejects.toThrow(
      AssayNotFoundError,
    );
  });

  it('settling a FROZEN assay returns SETTLED with the appended settlement', async () => {
    const census = new Census(new MemoryStorageAdapter());
    const a = await census.appendAssay(baseAssay());
    const settled = await census.recordSettlement(a.assay_id, settlement());
    expect(settled.status).toBe('SETTLED');
    expect(settled.settlement).toMatchObject({ outcome: 'up', source: 'kalshi-public' });
  });

  it('settling twice with the SAME payload is idempotent and succeeds', async () => {
    const census = new Census(new MemoryStorageAdapter());
    const a = await census.appendAssay(baseAssay());
    const s = settlement();
    await census.recordSettlement(a.assay_id, s);
    const second = await census.recordSettlement(a.assay_id, s);
    expect(second.status).toBe('SETTLED');
  });

  it('settling twice with a DIFFERENT payload throws AssayAlreadySettledError', async () => {
    const census = new Census(new MemoryStorageAdapter());
    const a = await census.appendAssay(baseAssay());
    await census.recordSettlement(a.assay_id, settlement({ outcome: 'up' }));
    await expect(
      census.recordSettlement(a.assay_id, settlement({ outcome: 'down' })),
    ).rejects.toThrow(AssayAlreadySettledError);
  });

  it('cannot settle if settled_at is before occurrence_time', async () => {
    const census = new Census(new MemoryStorageAdapter());
    const a = await census.appendAssay(baseAssay());
    await expect(
      census.recordSettlement(
        a.assay_id,
        settlement({ settled_at: '2026-09-02T21:14:00Z' }),
      ),
    ).rejects.toThrow();
  });

  it('VOID assay cannot be settled (not FROZEN)', async () => {
    const census = new Census(new MemoryStorageAdapter());
    const a = await census.appendAssay(baseAssay());
    await census.voidAssay(a.assay_id);
    await expect(census.recordSettlement(a.assay_id, settlement())).rejects.toThrow(
      AssayNotFrozenError,
    );
  });
});

describe('Census — listing & filtering', () => {
  it('listAssays returns only stored assays and respects filters', async () => {
    const census = new Census(new MemoryStorageAdapter());
    await census.appendAssay(baseAssay({ verdict: 'BUY_UP', interval_ticker: 'KXBTC15M-AAA' }));
    await census.appendAssay(
      baseAssay({ verdict: 'WAIT', interval_ticker: 'KXBTC15M-BBB' }),
    );
    const all = await census.listAssays();
    expect(all).toHaveLength(2);
    const ups = await census.listAssays({ verdict: 'BUY_UP' });
    expect(ups).toHaveLength(1);
    expect(ups[0].interval_ticker).toBe('KXBTC15M-AAA');
  });
});

describe('Census — validation', () => {
  it('rejects confidence outside [0,1]', async () => {
    const census = new Census(new MemoryStorageAdapter());
    await expect(census.appendAssay(baseAssay({ confidence: 1.5 }))).rejects.toThrow();
  });

  it('rejects forecast_time after occurrence_time', async () => {
    const census = new Census(new MemoryStorageAdapter());
    await expect(
      census.appendAssay(
        baseAssay({
          forecast_time: '2026-09-02T21:20:00Z',
          occurrence_time: '2026-09-02T21:15:00Z',
        }),
      ),
    ).rejects.toThrow();
  });

  it('rejects rationale over 280 chars', async () => {
    const census = new Census(new MemoryStorageAdapter());
    await expect(
      census.appendAssay(baseAssay({ rationale: 'x'.repeat(281) })),
    ).rejects.toThrow();
  });
});

describe('Census — grade computation', () => {
  async function seedSettled(
    census: Census,
    version: string,
    n: number,
    winRate: number,
    tickerBase = 'KXBTC15M-SLOT',
  ): Promise<void> {
    // Always predict BUY_UP. Wins = outcome up (correct); losses = outcome
    // down (wrong). This gives a true directional win rate of winRate.
    const wins = Math.round(n * winRate);
    for (let i = 0; i < n; i++) {
      const won = i < wins;
      const outcome = won ? 'up' : 'down';
      const idx = String(i).padStart(3, '0');
      const a = await census.appendAssay(
        baseAssay({
          engine_version: version,
          verdict: 'BUY_UP',
          interval_ticker: `${tickerBase}-${idx}`,
          forecast_time: `2026-09-02T21:${idx.slice(0, 2)}:00Z`,
          occurrence_time: `2026-09-02T21:${idx.slice(0, 2)}:15Z`,
        }),
      );
      await census.recordSettlement(
        a.assay_id,
        settlement({
          outcome: outcome as SettlementInput['outcome'],
          settled_at: `2026-09-02T21:${idx.slice(0, 2)}:16Z`,
        }),
      );
    }
  }

  it('returns UNGRADED below min sample size', async () => {
    const census = new Census(new MemoryStorageAdapter());
    await seedSettled(census, 'pre-0.1', 10, 0.7);
    const grade = await census.computeGrade('pre-0.1');
    expect(grade).toBe('UNGRADED');
  });

  it('returns PROVISIONAL when CI is wide / edge not significant', async () => {
    const census = new Census(new MemoryStorageAdapter());
    // ~0.55 win rate over 60 samples → wide CI, not significant after correction
    await seedSettled(census, 'pre-0.1', 60, 0.55);
    const grade = await census.computeGrade('pre-0.1');
    expect(grade).toBe('PROVISIONAL');
  });

  it('returns CALIBRATED only with a large, clearly significant edge', async () => {
    const census = new Census(new MemoryStorageAdapter());
    // 0.75 win rate over 400 samples → tight CI, survives correction
    await seedSettled(census, 'pre-0.1', 400, 0.75);
    const grade = await census.computeGrade('pre-0.1');
    expect(grade).toBe('CALIBRATED');
  });

  it('grade is version-specific — different versions grade independently', async () => {
    const census = new Census(new MemoryStorageAdapter());
    await seedSettled(census, 'pre-0.1', 400, 0.75);
    await seedSettled(census, 'pre-0.2', 5, 0.8);
    expect(await census.computeGrade('pre-0.1')).toBe('CALIBRATED');
    expect(await census.computeGrade('pre-0.2')).toBe('UNGRADED');
  });

  it('WAIT/SPECULATIVE-only assays grade UNGRADED (no directional evidence)', async () => {
    const census = new Census(new MemoryStorageAdapter());
    for (let i = 0; i < 50; i++) {
      const idx = String(i).padStart(3, '0');
      const a = await census.appendAssay(
        baseAssay({
          verdict: 'WAIT',
          interval_ticker: `KXBTC15M-W-${idx}`,
          forecast_time: `2026-09-02T22:${idx.slice(0, 2)}:00Z`,
          occurrence_time: `2026-09-02T22:${idx.slice(0, 2)}:15Z`,
        }),
      );
      await census.recordSettlement(
        a.assay_id,
        settlement({ settled_at: `2026-09-02T22:${idx.slice(0, 2)}:16Z` }),
      );
    }
    expect(await census.computeGrade('pre-0.1')).toBe('UNGRADED');
  });
});
