// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board applies the watchlist's own rule to every row, not just to the watchlist: a protocol is
// rankable when it records no token and is not a wrapped, staked or bridged product of one that
// trades (no Bridge / Canonical Bridge / Liquid Staking / Liquid Restaking / Restaked BTC / CEX
// category, no whole word wrapped, staked or staking in its name, no exchange's name at its start,
// no version marker at its end). The house drew that line for the watchlist; the board keeps it, so
// WBTC or a bridge never tops a ranking of protocols still waiting on a launch of their own.
//
// Implied value is fitted at run time from the snapshot's own anchors — the protocols that already
// trade — never from a hand-kept list of names:
//
//   log(mcap) = intercept + beta x log(TVL)          OLS on the 128 anchors, fitted here, each run
//   base        = exp(intercept) x TVL^beta          the power law's prediction for this protocol
//   growthMult  = 1 + clamp(change_7d, -30, 50)/100 x 0.25
//   maturityMult= 0.7 + 0.3 x min(age_days, 1095)/1095 (age unknown: 365 days)
//   categoryAdj = shrunk median of mcap / (exp(intercept) x TVL^beta) within the category,
//                 shrunk toward 1 with k = 5, clipped to [0.5, 2]; 1 when the category has no anchor
//   implied     = max(1, round(min(20e9, base x growthMult x maturityMult x categoryAdj)))
//
// The growth weight is a bounded prior, not a fitted coefficient: the snapshot's week is a down week
// (85% of protocols fell), so the raw two-variable OLS growth coefficient comes out at -3.5 per
// 100 points — a fitting artefact, not a signal that growth destroys value. The weight is therefore
// constrained to [0, 0.5] and set at the midpoint 0.25, and the raw coefficient is reported in the
// fit so the choice is visible. The same honesty holds for the validation: the program runs a
// deterministic 5-fold cross-validation (folds by slug order, refitting the power law and the
// category adjustments per fold) and reports the out-of-sample R² and median absolute log error in
// data.js and on the dashboard. On this snapshot the fit is log(mcap) = 6.96 + 0.52 x log(TVL),
// out-of-sample R² ≈ 0.14, median |log error| ≈ 1.22: TVL explains some of value and most of it is
// not in the snapshot, which is why the board is a ranking, not a price.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. The growth weight is a bounded prior (see
 * the header); the rest are the shape of the adjustments, not fitted values. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  cap_usd: number;
  shrink_k: number;
  category_floor: number;
  category_cap: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.25,
  growth_floor: -30,
  growth_cap: 50,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  cap_usd: 20_000_000_000,
  shrink_k: 5,
  category_floor: 0.5,
  category_cap: 2,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2-fitted';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    category_adjustment: number;
    age_days: number | null;
  };
  farm_steps: string[];
  farm_cost_usd: number;
  farm_capital_usd: number;
  farm_weeks: number;
  setup_gas_usd: number;
  weekly_gas_usd: number;
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_adjustment: number;
  farm_cost_usd: number;
  farm_capital_usd: number;
  farm_weeks: number;
  setup_gas_usd: number;
  weekly_gas_usd: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The fitted power law and its validation, as the dashboard shows them. */
export interface FitSummary {
  intercept: number;
  beta: number;
  scale: number;
  anchors: number;
  growth_weight: number;
  growth_raw_coef: number;
  oos_r2: number;
  oos_median_abs_log_err: number;
  category_adjustments: Record<string, number>;
  category_anchor_counts: Record<string, number>;
}

/** Everything the dashboard needs: the board, the live set, the fit and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  fit: FitSummary;
  watchlist_size: number;
  watchlist_slugs: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word wrapped, staked or staking: a wrapped or staked product of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Categories the watchlist's rule keeps off the board: bridges, staking products, exchanges. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
/** Exchange names a protocol name must not begin with. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token and not a wrapped, staked or bridged
 * product of a protocol whose token already trades. This is the watchlist's own rule, applied to
 * every row rather than only to the watchlist. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((prefix) => p.name.startsWith(prefix))) return false;
  return true;
}

/** The snapshot's anchors: protocols that already trade, with a positive market cap, by slug. */
export function anchorsOf(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.gecko_id !== null)
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** Ordinary least squares for y = intercept + beta x, from paired arrays. */
function ols(xs: number[], ys: number[]): { intercept: number; beta: number } {
  const n = xs.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
    sxx += xs[i]! * xs[i]!;
    sxy += xs[i]! * ys[i]!;
  }
  const beta = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return { intercept: (sy - beta * sx) / n, beta };
}

/**
 * The raw two-variable OLS growth coefficient (per 1 point of 7-day growth), by residualising growth
 * and log(mcap) on [1, log(TVL)] first. Reported, never used: on a down week it comes out negative,
 * which is why the growth weight is a bounded prior instead.
 */
function rawGrowthCoef(anchors: SnapshotProtocol[], model: ModelConstants): number {
  const xs = anchors.map((p) => Math.log(p.tvl_usd));
  const ys = anchors.map((p) => Math.log(p.mcap_usd!));
  const gs = anchors.map((p) => Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0))));
  const fitX = ols(xs, gs);
  const fitY = ols(xs, ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < anchors.length; i++) {
    const gr = gs[i]! - (fitX.intercept + fitX.beta * xs[i]!);
    const yr = ys[i]! - (fitY.intercept + fitY.beta * xs[i]!);
    num += gr * yr;
    den += gr * gr;
  }
  return den === 0 ? 0 : num / den;
}

/** A category's adjustment: the shrunk median of mcap / (scale x TVL^beta) among its anchors,
 * shrunk toward 1 with k, clipped to [floor, cap]; 1 when the category has no anchor. */
export function categoryAdjustment(
  category: string,
  anchors: SnapshotProtocol[],
  scale: number,
  beta: number,
  model: ModelConstants,
): number {
  const residuals = anchors
    .filter((p) => (p.category ?? 'Other') === category)
    .map((p) => p.mcap_usd! / (scale * Math.pow(p.tvl_usd, beta)));
  if (residuals.length === 0) return 1;
  const med = median(residuals);
  const shrunk = (residuals.length * med + model.shrink_k * 1) / (residuals.length + model.shrink_k);
  return Math.min(model.category_cap, Math.max(model.category_floor, shrunk));
}

/** Every category's adjustment, keyed by category name in sorted order (deterministic bytes). */
function allCategoryAdjustments(anchors: SnapshotProtocol[], scale: number, beta: number, model: ModelConstants): Record<string, number> {
  const categories = [...new Set(anchors.map((p) => p.category ?? 'Other'))].sort();
  const out: Record<string, number> = {};
  for (const c of categories) out[c] = Math.round(categoryAdjustment(c, anchors, scale, beta, model) * 1e4) / 1e4;
  return out;
}

/** The three multipliers and the implied value one protocol gets under a fit. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: { scale: number; beta: number },
  categoryAdj: number,
  model: ModelConstants,
): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const base = fit.scale * Math.pow(protocol.tvl_usd, fit.beta);
  const implied = Math.max(1, Math.round(Math.min(model.cap_usd, base * growthMult * maturityMult * categoryAdj)));
  return { implied, base, growthPct, growthMult, maturityMult, age };
}

/**
 * The 5-fold validation with the snapshot's date, so each held-out protocol's age is its real age.
 * Folds run by slug order (index % 5), refitting the power law and the category adjustments on each
 * training fold and predicting the held-out fold with the fixed growth weight and maturity shape.
 */
export function crossValidateOn(snapshot: Snapshot, model: ModelConstants = MODEL): { oosR2: number; medianAbsLogErr: number } {
  const anchors = anchorsOf(snapshot);
  const ys = anchors.map((p) => Math.log(p.mcap_usd!));
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const ssTot = ys.reduce((a, y) => a + (y - mean) * (y - mean), 0);
  const oof = new Array<number>(anchors.length).fill(0);
  for (let k = 0; k < 5; k++) {
    const train = anchors.filter((_, i) => i % 5 !== k);
    const testIdx = anchors.map((_, i) => i).filter((i) => i % 5 === k);
    const { intercept, beta } = ols(
      train.map((p) => Math.log(p.tvl_usd)),
      train.map((p) => Math.log(p.mcap_usd!)),
    );
    const scale = Math.exp(intercept);
    for (const i of testIdx) {
      const p = anchors[i]!;
      const adj = categoryAdjustment(p.category ?? 'Other', train, scale, beta, model);
      const { implied } = impliedValue(p, snapshot.as_of, { scale, beta }, adj, model);
      oof[i] = Math.log(implied);
    }
  }
  const ssRes = ys.reduce((a, y, i) => a + (y - oof[i]!) * (y - oof[i]!), 0);
  const absErr = ys.map((y, i) => Math.abs(y - oof[i]!));
  return { oosR2: 1 - ssRes / ssTot, medianAbsLogErr: median(absErr) };
}

/** The fit: the power law, the raw growth coefficient, the validation and every category's adjustment. */
export function fitModel(snapshot: Snapshot, model: ModelConstants = MODEL): FitSummary {
  const anchors = anchorsOf(snapshot);
  const { intercept, beta } = ols(
    anchors.map((p) => Math.log(p.tvl_usd)),
    anchors.map((p) => Math.log(p.mcap_usd!)),
  );
  const scale = Math.exp(intercept);
  const { oosR2, medianAbsLogErr } = crossValidateOn(snapshot, model);
  return {
    intercept: Math.round(intercept * 1e4) / 1e4,
    beta: Math.round(beta * 1e4) / 1e4,
    scale: Math.round(scale * 1e4) / 1e4,
    anchors: anchors.length,
    growth_weight: model.growth_weight,
    growth_raw_coef: Math.round(rawGrowthCoef(anchors, model) * 1e4) / 1e4,
    oos_r2: Math.round(oosR2 * 1e4) / 1e4,
    oos_median_abs_log_err: Math.round(medianAbsLogErr * 1e4) / 1e4,
    category_adjustments: allCategoryAdjustments(anchors, scale, beta, model),
    category_anchor_counts: Object.fromEntries(
      [...new Set(anchors.map((p) => p.category ?? 'Other'))]
        .sort()
        .map((c) => [c, anchors.filter((p) => (p.category ?? 'Other') === c).length]),
    ),
  };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Why pre-token protocols stay off the board, counted by first reason. */
export function exclusionBreakdown(snapshot: Snapshot): { preToken: number; rankable: number; byReason: Record<string, number> } {
  let preToken = 0;
  const byReason: Record<string, number> = {};
  const bump = (r: string): void => {
    byReason[r] = (byReason[r] ?? 0) + 1;
  };
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    preToken++;
    if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) {
      bump(`category ${p.category}`);
      continue;
    }
    if (VERSIONED.test(p.name)) {
      bump('versioned name');
      continue;
    }
    if (WRAPPED_WORD.test(p.name)) {
      bump('wrapped/staked name');
      continue;
    }
    if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) {
      bump('exchange name');
      continue;
    }
  }
  return { preToken, rankable: snapshot.protocols.filter(isRankable).length, byReason };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, fit: FitSummary, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable protocol, whatever its TVL. The floor is a floor.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const adj = fit.category_adjustments[p.category ?? 'Other'] ?? 1;
    const v = impliedValue(p, snapshot.as_of, { scale: fit.scale, beta: fit.beta }, adj, model);
    return { p, ...v, adj };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const steps = farmSteps(s.p, s.age);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: s.implied,
      model: {
        base_usd: Math.round(s.base),
        growth_pct: round4(s.growthPct),
        growth_multiplier: round4(s.growthMult),
        maturity_multiplier: round4(s.maturityMult),
        category_adjustment: round4(s.adj),
        age_days: s.age,
      },
      farm_steps: steps.map(stepText),
      farm_cost_usd: farmCost(s.p, s.age).total_gas_usd,
      farm_capital_usd: capitalFor(s.p),
      farm_weeks: farmCost(s.p, s.age).weeks,
      setup_gas_usd: farmCost(s.p, s.age).setup_gas_usd,
      weekly_gas_usd: farmCost(s.p, s.age).weekly_gas_usd,
    };
  });
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, in dollars: the gas price a farmer actually pays. */
export function gasUsd(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum' || c === 'bitcoin') return c === 'ethereum' ? 5 : 2;
  if (c === 'solana' || c === 'hyperliquid l1') return 0.02;
  if (c === 'binance' || c === 'tron') return c === 'binance' ? 0.2 : 0.5;
  if (c === 'polygon') return 0.05;
  if (c === 'avalanche') return 0.3;
  if (['arbitrum', 'base', 'optimism', 'unichain', 'zksync era', 'scroll', 'linea', 'blast', 'mode', 'fraxtal', 'soneium', 'ink'].includes(c)) return 0.3;
  return 1;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The gas a farm costs in total and how many weeks it runs: setup plus one weekly action per week. */
export function farmCost(p: SnapshotProtocol, age: number | null): { total_gas_usd: number; weeks: number; setup_gas_usd: number; weekly_gas_usd: number } {
  const gas = gasUsd(chainOf(p));
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const setup = Math.round(gas * 2 * 100) / 100;
  const weekly = Math.round(gas * 100) / 100;
  const total = Math.round((setup + weekly * weeks + gas) * 100) / 100;
  return { total_gas_usd: total, weeks, setup_gas_usd: setup, weekly_gas_usd: weekly };
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('locker') || c.includes('lock')) return `Lock $${capital} of tokens in ${name} on ${chain} for the longest term the app offers.`;
  if (c.includes('launchpad') || c.includes('launch')) return `Join one launch on ${name} with $${capital} and hold the allocation.`;
  if (c.includes('ai agent') || c.includes('decentralized ai')) return `Deposit $${capital} into ${name} on ${chain} and run one agent task the app offers.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 * Gas is priced on the protocol's first chain, so an Ethereum farm and a Solana farm cost visibly
 * different amounts.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const cost = farmCost(p, age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `about $${cost.setup_gas_usd} of gas on ${chain} for the first transactions`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${cost.setup_gas_usd} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about $${cost.weekly_gas_usd} of gas a week for ${cost.weeks} weeks`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_usd: row.model.base_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    category_adjustment: row.model.category_adjustment,
    farm_cost_usd: row.farm_cost_usd,
    farm_capital_usd: row.farm_capital_usd,
    farm_weeks: row.farm_weeks,
    setup_gas_usd: row.setup_gas_usd,
    weekly_gas_usd: row.weekly_gas_usd,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData; fit: FitSummary } {
  const fit = fitModel(snapshot, model);
  const board = buildBoard(snapshot, fit, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    fit,
    watchlist_size: snapshot.watchlist.length,
    watchlist_slugs: snapshot.watchlist,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar, fit };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
