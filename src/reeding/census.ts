/**
 * Reeding — Census store (Lane B)
 * ------------------------------------------------------------
 * Append-only evidence base for all Reeding Assays. SEPARATE from
 * Andrew's personal bet ledger — never merged.
 *
 * Immutability model (the core invariant):
 *  - A FROZEN Assay is written once under key `assay/{id}` and NEVER
 *    rewritten. Forecast fields are immutable from that point on.
 *  - Settlement is APPENDED under a separate key `assay/{id}.settlement`,
 *    also write-once. The frozen forecast bytes are never touched.
 *  - `recordSettlement` therefore never edits a FROZEN record; it adds a
 *    sibling settlement record. Re-grades read fresh data, they never
 *    mutate an existing Assay.
 *  - Settling twice fails (idempotent only if the exact same settlement
 *    is supplied again).
 *
 * Backed by a pluggable `StorageAdapter` (Lane C implements Vercel Blob).
 */

import { createHash } from 'node:crypto';
import {
  StorageAdapter,
  PutOptions,
  AssayAlreadyExistsError,
} from './storage-adapter';
import {
  computeGrade as computeGradeRaw,
  DEFAULT_GRADE_CONFIG,
  GradeConfig,
  wilsonCIHalfWidth,
  Grade,
  GradeInputs,
} from './grade';

export type { StorageAdapter, PutOptions };
export { AssayAlreadyExistsError };
export type { Grade, GradeConfig, GradeInputs };

export const ASSAY_SCHEMA_VERSION = '1.0.0';

export type Verdict = 'BUY_UP' | 'BUY_DOWN' | 'SPECULATIVE' | 'WAIT';
export type AssayStatus = 'FROZEN' | 'SETTLED' | 'VOID';
export type Outcome = 'up' | 'down';
export type SettlementSource = 'kalshi-public' | 'coinbase-spot-proxy';

export interface MarketContextSnapshot {
  target_price: number;
  last_price_at_forecast: number;
  cost_assumption_cents: number;
}

export interface Settlement {
  outcome: Outcome;
  settlement_price: number;
  settled_at: string; // ISO8601
  source: SettlementSource;
}

export interface Assay {
  assay_id: string;
  engine_version: string;
  forecast_time: string; // ISO8601
  interval_ticker: string;
  occurrence_time: string; // ISO8601
  verdict: Verdict;
  confidence: number;
  rationale: string;
  market_context_snapshot: MarketContextSnapshot;
  status: AssayStatus;
  settlement: Settlement | null;
  grade: Grade | null;
  created_at: string; // ISO8601
  schema_version: string;
}

export interface NewAssayInput {
  engine_version: string;
  forecast_time: string;
  interval_ticker: string;
  occurrence_time: string;
  verdict: Verdict;
  confidence: number;
  rationale: string;
  market_context_snapshot: MarketContextSnapshot;
  /** Optional override; otherwise computed deterministically. */
  created_at?: string;
}

export interface SettlementInput {
  outcome: Outcome;
  settlement_price: number;
  settled_at: string;
  source: SettlementSource;
}

export class AssayNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Assay not found: ${id}`);
    this.name = 'AssayNotFoundError';
  }
}

export class AssayNotFrozenError extends Error {
  constructor(public readonly id: string, public readonly status: AssayStatus) {
    super(`Assay ${id} is ${status}, cannot settle (must be FROZEN)`);
    this.name = 'AssayNotFrozenError';
  }
}

export class AssayAlreadySettledError extends Error {
  constructor(public readonly id: string) {
    super(`Assay ${id} is already SETTLED — settlement is append-once`);
    this.name = 'AssayAlreadySettledError';
  }
}

export class AssayValidationError extends Error {
  constructor(message: string, public readonly errors: string[]) {
    super(message);
    this.name = 'AssayValidationError';
  }
}

/** Deterministic assay_id = SHA-256(engine_version + forecast_time + interval_ticker). */
export function computeAssayId(input: {
  engine_version: string;
  forecast_time: string;
  interval_ticker: string;
}): string {
  const material = `${input.engine_version}|${input.forecast_time}|${input.interval_ticker}`;
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

export interface AssayFilter {
  engine_version?: string;
  status?: AssayStatus;
  verdict?: Verdict;
  interval_ticker?: string;
}

const KEY_PREFIX = 'assay/';
const SETTLEMENT_SUFFIX = '.settlement';

function assayKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}
function settlementKey(id: string): string {
  return `${KEY_PREFIX}${id}${SETTLEMENT_SUFFIX}`;
}

/** Parse a storage key back into its assay id (strips prefix + settlement suffix). */
export function keyToAssayId(key: string): string | null {
  if (!key.startsWith(KEY_PREFIX)) return null;
  let rest = key.slice(KEY_PREFIX.length);
  if (rest.endsWith(SETTLEMENT_SUFFIX)) {
    rest = rest.slice(0, -SETTLEMENT_SUFFIX.length);
  }
  return rest;
}

export class Census {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly gradeConfig: GradeConfig = DEFAULT_GRADE_CONFIG,
  ) {}

  // ---- write paths --------------------------------------------------

  /**
   * Freeze a new Assay. Write-once: re-freezing the same id with
   * identical bytes is idempotent; different bytes for the same id throws.
   */
  async appendAssay(input: NewAssayInput): Promise<Assay> {
    this.validateNewAssayInput(input);
    const assay: Assay = {
      assay_id: computeAssayId(input),
      engine_version: input.engine_version,
      forecast_time: input.forecast_time,
      interval_ticker: input.interval_ticker,
      occurrence_time: input.occurrence_time,
      verdict: input.verdict,
      confidence: roundConfidence(input.confidence),
      rationale: input.rationale,
      market_context_snapshot: { ...input.market_context_snapshot },
      status: 'FROZEN',
      settlement: null,
      grade: null,
      created_at: input.created_at ?? new Date().toISOString(),
      schema_version: ASSAY_SCHEMA_VERSION,
    };

    const key = assayKey(assay.assay_id);
    const bytes = serializeAssay(assay);
    const existing = await this.storage.get(key);
    if (existing !== null) {
      if (existing === bytes) return assay; // idempotent re-freeze
      throw new AssayAlreadyExistsError(key);
    }
    await this.storage.put(key, bytes, { failIfExisting: true });
    return assay;
  }

  /**
   * Append a settlement to a FROZEN Assay. Idempotent: re-applying the
   * exact same settlement succeeds; any other settlement after the first
   * throws `AssayAlreadySettledError`.
   */
  async recordSettlement(
    id: string,
    settlement: SettlementInput,
  ): Promise<Assay> {
    this.validateSettlementInput(settlement);

    const aKey = assayKey(id);
    const frozenBytes = await this.storage.get(aKey);
    if (frozenBytes === null) throw new AssayNotFoundError(id);

    const frozen = deserializeAssay(frozenBytes);
    if (frozen.status !== 'FROZEN') {
      throw new AssayNotFrozenError(id, frozen.status);
    }
    const sKey = settlementKey(id);
    const sBytes = serializeSettlement({
      outcome: settlement.outcome,
      settlement_price: settlement.settlement_price,
      settled_at: settlement.settled_at,
      source: settlement.source,
    });

    // The frozen bytes always carry status FROZEN (we never rewrite them).
    // The *effective* status is derived from any record appended under the
    // settlement key: a settlement object, or a void marker.
    const existing = await this.storage.get(sKey);
    if (existing !== null) {
      const parsed = parseSettlement(existing);
      if (parsed === null) {
        // void marker present → assay is VOID, not FROZEN
        throw new AssayNotFrozenError(id, 'VOID');
      }
      if (existing === sBytes) {
        // idempotent re-settle with identical payload
        return this.assembleAssay(frozen, parsed);
      }
      throw new AssayAlreadySettledError(id);
    }

    if (frozen.occurrence_time >= settlement.settled_at) {
      throw new AssayValidationError(
        `settled_at (${settlement.settled_at}) must be after occurrence_time (${frozen.occurrence_time})`,
        ['settled_at'],
      );
    }
    if (frozen.forecast_time >= settlement.settled_at) {
      throw new AssayValidationError(
        `settled_at must be after forecast_time (${frozen.forecast_time})`,
        ['settled_at'],
      );
    }

    await this.storage.put(sKey, sBytes, { failIfExisting: true });
    return this.assembleAssay(frozen, settlement);
  }

  /** Mark a FROZEN assay VOID (administrative). Cannot void a SETTLED assay. */
  async voidAssay(id: string): Promise<Assay> {
    const aKey = assayKey(id);
    const frozenBytes = await this.storage.get(aKey);
    if (frozenBytes === null) throw new AssayNotFoundError(id);
    const frozen = deserializeAssay(frozenBytes);
    if (frozen.status === 'SETTLED') {
      throw new AssayValidationError(`Cannot VOID a SETTLED assay: ${id}`, ['status']);
    }
    // VOID is recorded under the settlement key slot (a settlement-like
    // append) so the frozen forecast bytes remain untouched.
    const vKey = settlementKey(id);
    const vBytes = JSON.stringify({ void: true, voided_at: new Date().toISOString() });
    const existing = await this.storage.get(vKey);
    if (existing !== null && existing !== vBytes) {
      throw new AssayValidationError(`Assay ${id} already has an appended record`, ['status']);
    }
    if (existing === null) {
      await this.storage.put(vKey, vBytes, { failIfExisting: true });
    }
    return { ...frozen, status: 'VOID' };
  }

  // ---- read paths --------------------------------------------------

  async getAssay(id: string): Promise<Assay | null> {
    const frozenBytes = await this.storage.get(assayKey(id));
    if (frozenBytes === null) return null;
    const frozen = deserializeAssay(frozenBytes);
    const sBytes = await this.storage.get(settlementKey(id));
    if (sBytes === null) return frozen;
    const settlement = parseSettlement(sBytes);
    if (settlement === null) {
      // void marker
      return { ...frozen, status: 'VOID' };
    }
    return this.assembleAssay(frozen, settlement);
  }

  async listAssays(filter?: AssayFilter): Promise<Assay[]> {
    const keys = await this.storage.list(KEY_PREFIX);
    const ids = new Set<string>();
    for (const k of keys) {
      const id = keyToAssayId(k);
      if (id) ids.add(id);
    }
    const assays: Assay[] = [];
    for (const id of ids) {
      const a = await this.getAssay(id);
      if (!a) continue;
      if (filter) {
        if (filter.engine_version && a.engine_version !== filter.engine_version) continue;
        if (filter.status && a.status !== filter.status) continue;
        if (filter.verdict && a.verdict !== filter.verdict) continue;
        if (filter.interval_ticker && a.interval_ticker !== filter.interval_ticker) continue;
      }
      assays.push(a);
    }
    return assays;
  }

  // ---- grading ------------------------------------------------------

  async computeGrade(engine_version: string): Promise<Grade> {
    const settled = await this.listAssays({ engine_version, status: 'SETTLED' });
    // Only directional verdicts contribute to directional calibration.
    const directional = settled.filter(
      (a) => a.verdict === 'BUY_UP' || a.verdict === 'BUY_DOWN',
    );
    const wins = directional.filter(
      (a) =>
        (a.verdict === 'BUY_UP' && a.settlement?.outcome === 'up') ||
        (a.verdict === 'BUY_DOWN' && a.settlement?.outcome === 'down'),
    ).length;
    const n = directional.length;
    if (n === 0) return 'UNGRADED';
    const winRate = wins / n;
    const ciHalfWidth = wilsonCIHalfWidth(wins, n);
    const inputs: GradeInputs = { sampleSize: n, winRate, ciHalfWidth };
    return computeGradeRaw(inputs, this.gradeConfig);
  }

  // ---- internals ----------------------------------------------------

  private assembleAssay(frozen: Assay, settlement: Settlement): Assay {
    return {
      ...frozen,
      status: 'SETTLED',
      settlement,
    };
  }

  private validateNewAssayInput(input: NewAssayInput): void {
    const errors: string[] = [];
    if (!input.engine_version) errors.push('engine_version');
    if (!input.forecast_time) errors.push('forecast_time');
    if (!input.interval_ticker) errors.push('interval_ticker');
    if (!input.occurrence_time) errors.push('occurrence_time');
    if (input.forecast_time && input.occurrence_time && input.forecast_time >= input.occurrence_time) {
      errors.push('forecast_time must precede occurrence_time');
    }
    if (!isVerdict(input.verdict)) errors.push(`verdict`);
    if (input.confidence < 0 || input.confidence > 1) errors.push('confidence');
    if (!input.rationale) errors.push('rationale');
    if (input.rationale && input.rationale.length > 280) errors.push('rationale too long');
    const m = input.market_context_snapshot;
    if (!m) errors.push('market_context_snapshot');
    if (m) {
      if (typeof m.target_price !== 'number' || m.target_price < 0) errors.push('target_price');
      if (typeof m.last_price_at_forecast !== 'number' || m.last_price_at_forecast < 0)
        errors.push('last_price_at_forecast');
      if (typeof m.cost_assumption_cents !== 'number' || m.cost_assumption_cents < 0 || m.cost_assumption_cents > 100)
        errors.push('cost_assumption_cents');
    }
    if (errors.length) {
      throw new AssayValidationError('Invalid Assay input', errors);
    }
  }

  private validateSettlementInput(s: SettlementInput): void {
    const errors: string[] = [];
    if (s.outcome !== 'up' && s.outcome !== 'down') errors.push('outcome');
    if (typeof s.settlement_price !== 'number' || s.settlement_price < 0)
      errors.push('settlement_price');
    if (!s.settled_at) errors.push('settled_at');
    if (s.source !== 'kalshi-public' && s.source !== 'coinbase-spot-proxy') errors.push('source');
    if (errors.length) throw new AssayValidationError('Invalid settlement', errors);
  }
}

// ---- serialization helpers ------------------------------------------

function serializeAssay(a: Assay): string {
  return JSON.stringify(a);
}
function deserializeAssay(bytes: string): Assay {
  return JSON.parse(bytes) as Assay;
}
function serializeSettlement(s: Settlement): string {
  return JSON.stringify(s);
}
function parseSettlement(bytes: string): Settlement | null {
  const obj = JSON.parse(bytes) as Record<string, unknown>;
  if ('void' in obj) return null;
  return obj as unknown as Settlement;
}

function isVerdict(v: unknown): v is Verdict {
  return v === 'BUY_UP' || v === 'BUY_DOWN' || v === 'SPECULATIVE' || v === 'WAIT';
}
function roundConfidence(c: number): number {
  if (c < 0) return 0;
  if (c > 1) return 1;
  return Math.round(c * 1e6) / 1e6;
}

// ---- In-memory StorageAdapter (for tests + local dev) --------------

export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  async put(key: string, data: string, opts?: PutOptions): Promise<void> {
    if (this.store.has(key)) {
      if (this.store.get(key) === data) return; // idempotent
      if (opts?.failIfExisting) throw new AssayAlreadyExistsError(key);
      throw new AssayAlreadyExistsError(key);
    }
    this.store.set(key, data);
  }
  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.store.keys());
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  }
  /** Test-only: inspect the raw frozen bytes (proves settlement is a separate key). */
  _rawGet(key: string): string | undefined {
    return this.store.get(key);
  }
}
