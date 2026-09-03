import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../assay.schema.json';
import { computeAssayId, type Assay } from '../census';

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function frozenAssay(): Assay {
  const id = computeAssayId({
    engine_version: 'pre-0.1',
    forecast_time: '2026-09-02T21:00:00Z',
    interval_ticker: 'KXBTC15M-26SEP022115',
  });
  return {
    assay_id: id,
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
    status: 'FROZEN',
    settlement: null,
    grade: null,
    created_at: '2026-09-02T21:00:05Z',
    schema_version: '1.0.0',
  };
}

describe('assay.schema.json', () => {
  it('is a valid draft-2020-12 schema with the right title', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.title).toBe('Reeding Assay');
  });

  it('declares all required top-level fields', () => {
    const required = schema.required as string[];
    for (const field of [
      'assay_id', 'engine_version', 'forecast_time', 'interval_ticker',
      'occurrence_time', 'verdict', 'confidence', 'rationale',
      'market_context_snapshot', 'status', 'created_at', 'schema_version',
    ]) {
      expect(required).toContain(field);
    }
  });

  it('validates a well-formed FROZEN assay', () => {
    expect(validate(frozenAssay())).toBe(true);
  });

  it('validates a SETTLED assay with an appended settlement', () => {
    const a = frozenAssay();
    a.status = 'SETTLED';
    a.settlement = {
      outcome: 'up',
      settlement_price: 58210,
      settled_at: '2026-09-02T21:16:00Z',
      source: 'kalshi-public',
    };
    expect(validate(a)).toBe(true);
  });

  it('rejects an invalid assay_id (not 64 hex chars)', () => {
    const a = frozenAssay();
    a.assay_id = 'not-a-hash';
    expect(validate(a)).toBe(false);
  });

  it('rejects confidence out of [0,1]', () => {
    const a = frozenAssay();
    a.confidence = 1.5;
    expect(validate(a)).toBe(false);
  });

  it('rejects an unknown verdict', () => {
    const a = frozenAssay();
    (a as { verdict: string }).verdict = 'BUY_SIDEWAYS';
    expect(validate(a)).toBe(false);
  });

  it('rejects an unknown settlement source', () => {
    const a = frozenAssay();
    a.status = 'SETTLED';
    a.settlement = {
      outcome: 'up',
      settlement_price: 58210,
      settled_at: '2026-09-02T21:16:00Z',
      source: 'binance' as 'kalshi-public',
    };
    expect(validate(a)).toBe(false);
  });

  it('rejects additional unknown properties', () => {
    const a = frozenAssay() as unknown as Record<string, unknown>;
    a.unexpected_field = 'no';
    expect(validate(a)).toBe(false);
  });

  it('rejects rationale over 280 chars', () => {
    const a = frozenAssay();
    a.rationale = 'x'.repeat(281);
    expect(validate(a)).toBe(false);
  });

  it('rejects a settlement with a missing required field', () => {
    const a = frozenAssay();
    a.status = 'SETTLED';
    a.settlement = {
      outcome: 'up',
      settlement_price: 58210,
      settled_at: '2026-09-02T21:16:00Z',
      // source missing
    } as Assay['settlement'];
    expect(validate(a)).toBe(false);
  });
});
