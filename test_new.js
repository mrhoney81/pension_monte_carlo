'use strict';

const { runSimulation } = require('./simulation.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, msg, details) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}${details ? '\n    ' + details : ''}`);
    failed++;
  }
}

function stddev(arr) {
  const n = arr.length;
  const mean = arr.reduce((s, x) => s + x, 0) / n;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
}

// ─── Base params ──────────────────────────────────────────────────────────────
const BASE = {
  currentAge: 45, startingPot: 300000, annualContribution: 10000,
  retirementThreshold: 800000, earliestRetirement: 57, latestRetirement: 68,
  incomeFloor: 20000, incomeCeiling: 100000, withdrawalRate: 0.04,
  realArithmeticMean: 0.06, volatility: 0.16, numRuns: 3000, seed: 42,
  pension1Age: 67, pension1Amount: 9000, pension2Age: 60, pension2Amount: 0,
  dbPensions: [], dcPensions: [], numChildren: 0, children: [],
  uniFeePerYear: 0, uniYears: 0, giftAmount: 0, giftMinPot: 0,
};
const p = o => ({ ...BASE, ...o });

// ─── Test 1: N runs produce distinct results ───────────────────────────────────
console.log('\nTest 1: All N runs actually produce distinct intermediate results');
{
  const r = runSimulation(p({ numRuns: 3000, seed: 42 }));
  assert(r.retirementAges.length === 3000, 'retirementAges.length === 3000');
  assert(r.ruinAges.length === 3000, 'ruinAges.length === 3000');
  const arr = Array.from(r.retirementAges);
  const distinct = new Set(arr).size;
  assert(distinct >= 3, `retirementAges has ≥3 distinct values (got ${distinct})`);
  const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
  assert(variance > 0, `variance of retirementAges > 0 (got ${variance.toFixed(4)})`);
}

// ─── Test 2: Forced retirement at earliest age ─────────────────────────────────
console.log('\nTest 2: Forced retirement at earliest age (threshold=1)');
{
  const r = runSimulation(p({ numRuns: 3000, retirementThreshold: 1, earliestRetirement: 57, latestRetirement: 68, seed: 1 }));
  assert(Array.from(r.retirementAges).every(a => a === 57), 'Every run retires at age 57');
  assert(r.medianRetAge === 57, `medianRetAge === 57 (got ${r.medianRetAge})`);
  assert(r.retAgeCounts[57] === 3000, `retAgeCounts[57] === 3000 (got ${r.retAgeCounts[57]})`);
}

// ─── Test 3: Forced retirement at latest age ───────────────────────────────────
console.log('\nTest 3: Forced retirement at latest age (threshold=999B)');
{
  // incomeFloor=1 prevents canRetireOnPensions (pensions=0 < 1)
  const r = runSimulation(p({
    numRuns: 1000, retirementThreshold: 999_000_000_000,
    earliestRetirement: 57, latestRetirement: 68,
    incomeFloor: 1, pension1Amount: 0, pension2Amount: 0, dbPensions: [], seed: 7,
  }));
  assert(Array.from(r.retirementAges).every(a => a === 68), 'Every run retires at age 68');
  assert(r.retAgeCounts[68] === 1000, `retAgeCounts[68] === 1000 (got ${r.retAgeCounts[68]})`);
}

// ─── Test 4: Near-zero volatility → paths converge ────────────────────────────
console.log('\nTest 4: Near-zero volatility → all paths converge');
{
  const r = runSimulation(p({
    numRuns: 500, volatility: 0.0001, annualContribution: 0,
    retirementThreshold: 999_000_000_000, incomeFloor: 1,
    pension1Amount: 0, pension2Amount: 0, seed: 5,
  }));
  // index 10 = age 55, before any forced retirement at 68
  const i = 10;
  const spread = r.p95[i] - r.p5[i];
  const med = r.median[i];
  const spreadPct = (spread / med) * 100;
  assert(spreadPct < 1, `p95-p5 spread at age 55 < 1% of median (got ${spreadPct.toFixed(4)}%)`);
  const expected = BASE.startingPot * Math.pow(1.06, 10);
  const errPct = Math.abs(med - expected) / expected * 100;
  assert(errPct < 2, `median at age 55 ≈ 300000×1.06^10=${expected.toFixed(0)}, within 2% (err=${errPct.toFixed(3)}%)`);
}

// ─── Test 5: Zero mean, zero volatility → flat pot ────────────────────────────
console.log('\nTest 5: Zero mean, near-zero volatility → pot stays flat');
{
  const r = runSimulation(p({
    numRuns: 200, realArithmeticMean: 0, volatility: 0.0001,
    annualContribution: 0, startingPot: 500000,
    retirementThreshold: 999_000_000_000,
    earliestRetirement: 90, latestRetirement: 90,
    incomeFloor: 0, pension1Amount: 0, pension2Amount: 0, seed: 10,
  }));
  const i = 30; // age 75 = 45+30, well before retirement at 90
  const med = r.median[i];
  const medErr = Math.abs(med - 500000) / 500000 * 100;
  assert(medErr < 1, `median at age 75 ≈ 500000 (within 1%, err=${medErr.toFixed(4)}%)`);
  const p5Err = Math.abs(r.p5[i] - 500000) / 500000 * 100;
  const p95Err = Math.abs(r.p95[i] - 500000) / 500000 * 100;
  assert(p5Err < 2 && p95Err < 2,
    `p5 and p95 both ≈ 500000 (within 2%, p5err=${p5Err.toFixed(4)}%, p95err=${p95Err.toFixed(4)}%)`);
}

// ─── Test 6: Contributions + zero returns → linear growth ─────────────────────
console.log('\nTest 6: Zero returns, fixed contributions → pot grows linearly');
{
  const r = runSimulation(p({
    currentAge: 45, startingPot: 0, annualContribution: 10000,
    realArithmeticMean: 0, volatility: 0.0001,
    retirementThreshold: 999_000_000_000,
    earliestRetirement: 90, latestRetirement: 90,
    incomeFloor: 0, pension1Amount: 0, pension2Amount: 0,
    numRuns: 100, seed: 11,
  }));
  const err10 = Math.abs(r.median[10] - 100000) / 100000 * 100;
  assert(err10 < 2, `median at age 55 ≈ 100,000 (within 2%, err=${err10.toFixed(3)}%)`);
  const err20 = Math.abs(r.median[20] - 200000) / 200000 * 100;
  assert(err20 < 2, `median at age 65 ≈ 200,000 (within 2%, err=${err20.toFixed(3)}%)`);
  const spread = r.p95[10] - r.p5[10];
  assert(spread < 2000, `p95-p5 spread at age 55 < 2000 (got ${spread.toFixed(0)})`);
}

// ─── Test 7: incomeFloor exceeds pot → near-universal ruin ────────────────────
console.log('\nTest 7: incomeFloor far exceeds pot → near-universal ruin');
{
  // incomeFloor=90000 forces 90k/yr withdrawal from 100k pot → depletes in ~2 years
  const r = runSimulation(p({
    currentAge: 56, startingPot: 100000, annualContribution: 0,
    retirementThreshold: 1, earliestRetirement: 57, latestRetirement: 57,
    incomeFloor: 90000, incomeCeiling: 10_000_000, withdrawalRate: 0.04,
    pension1Amount: 0, pension2Amount: 0, numRuns: 1000, seed: 77,
  }));
  assert(r.ruinCount > 950, `ruinCount > 950 (got ${r.ruinCount})`);
  assert(r.survivalPct < 5, `survivalPct < 5% (got ${r.survivalPct.toFixed(2)}%)`);
}

// ─── Test 8: Zero income ceiling → no withdrawals → 100% survival ─────────────
console.log('\nTest 8: Zero income ceiling → no withdrawals → 100% survival');
{
  const r = runSimulation(p({
    incomeFloor: 0, incomeCeiling: 0, withdrawalRate: 0.04,
    startingPot: 500000, retirementThreshold: 1, earliestRetirement: 57,
    pension1Amount: 0, pension2Amount: 0, numRuns: 1000, seed: 88,
  }));
  assert(r.ruinCount === 0, `ruinCount === 0 (got ${r.ruinCount})`);
  assert(r.survivalPct === 100, `survivalPct === 100 (got ${r.survivalPct})`);
}

// ─── Test 9: DB pension triggers retirement at exact age ───────────────────────
console.log('\nTest 9: DB pension ≥ incomeFloor triggers retirement at exact age 62');
{
  const r = runSimulation(p({
    numRuns: 500, retirementThreshold: 999_000_000_000,
    earliestRetirement: 60, latestRetirement: 68,
    incomeFloor: 30000, pension1Amount: 0, pension2Amount: 0,
    dbPensions: [{ age: 62, amount: 35000 }], seed: 99,
  }));
  assert(Array.from(r.retirementAges).every(a => a === 62), 'Every run retires at age 62');
  assert(r.retAgeCounts[62] === 500, `retAgeCounts[62] === 500 (got ${r.retAgeCounts[62]})`);
}

// ─── Test 10: Pot at index 0 equals startingPot exactly ──────────────────────
console.log('\nTest 10: Pot at index 0 equals startingPot exactly');
{
  const r = runSimulation(p({ startingPot: 777777, numRuns: 100, seed: 10 }));
  assert(r.median[0] === 777777, `median[0] === 777777 (got ${r.median[0]})`);
  assert(r.p5[0] === 777777, `p5[0] === 777777 (got ${r.p5[0]})`);
  assert(r.p95[0] === 777777, `p95[0] === 777777 (got ${r.p95[0]})`);
}

// ─── Test 11: More runs → narrower confidence interval (law of large numbers) ──
console.log('\nTest 11: More runs → narrower survivalPct confidence interval');
{
  // Params chosen to give ~40-70% survival so sampling variance is meaningful
  const lln = o => p({
    startingPot: 300000, annualContribution: 10000, retirementThreshold: 500000,
    earliestRetirement: 57, latestRetirement: 68,
    incomeFloor: 70000, incomeCeiling: 200000, withdrawalRate: 0.04,
    realArithmeticMean: 0.04, volatility: 0.15,
    pension1Amount: 10000, pension1Age: 67, pension2Amount: 0,
    ...o,
  });
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map(s => s * 200000);
  const pct100  = seeds.map(seed => runSimulation(lln({ numRuns: 100,  seed })).survivalPct);
  const pct5000 = seeds.map(seed => runSimulation(lln({ numRuns: 5000, seed })).survivalPct);
  const sd100  = stddev(pct100);
  const sd5000 = stddev(pct5000);
  console.log(`  std dev with  100 runs: ${sd100.toFixed(3)}%`);
  console.log(`  std dev with 5000 runs: ${sd5000.toFixed(3)}%`);
  assert(sd100 > sd5000 * 2,
    `std dev with 100 runs (${sd100.toFixed(3)}) > 2× std dev with 5000 runs (${sd5000.toFixed(3)})`);
}

// ─── Test 12: Timing scales with numRuns ──────────────────────────────────────
console.log('\nTest 12: Time for 3000 runs is >5× time for 30 runs');
{
  runSimulation(p({ numRuns: 10, seed: 1 })); // JIT warmup
  const t30Start = Date.now();
  runSimulation(p({ numRuns: 30, seed: 2 }));
  const t30 = Date.now() - t30Start;
  const t3000Start = Date.now();
  runSimulation(p({ numRuns: 3000, seed: 3 }));
  const t3000 = Date.now() - t3000Start;
  console.log(`  30 runs:   ${t30}ms`);
  console.log(`  3000 runs: ${t3000}ms`);
  const ratio = t3000 / Math.max(t30, 1);
  assert(ratio > 5, `Time ratio 3000/30 runs > 5 (got ${ratio.toFixed(1)}×)`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
}
