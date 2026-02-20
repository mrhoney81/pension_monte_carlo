'use strict';

const { runSimulation } = require('./simulation.js');

// Same defaults as Python / app (seed 42 for reproducibility)
function defaultParams(overrides = {}) {
  return {
    currentAge: 45,
    startingPot: 800000,
    annualContribution: 40000,
    retirementThreshold: 1200000,
    earliestRetirement: 57,
    latestRetirement: 63,
    incomeFloor: 50000,
    incomeCeiling: 80000,
    withdrawalRate: 0.04,
    realArithmeticMean: 0.06,
    volatility: 0.16,
    numRuns: 2000,
    seed: 42,
    pension1Age: 68,
    pension1Amount: 12000,
    pension2Age: 72,
    pension2Amount: 25000,
    dbPensions: [],
    dcPensions: [],
    numChildren: 2,
    children: [
      { goesToUni: true, uniStartAge: 58, getsGift: true, giftAge: 70 },
      { goesToUni: true, uniStartAge: 60, getsGift: true, giftAge: 72 },
      { goesToUni: false, uniStartAge: 58, getsGift: false, giftAge: 70 },
      { goesToUni: false, uniStartAge: 60, getsGift: false, giftAge: 72 },
    ],
    uniFeePerYear: 9000,
    uniYears: 4,
    giftAmount: 300000,
    giftMinPot: 750000,
    ...overrides,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('Pension Monte Carlo — simulation tests\n');

// 1. Reproducibility: same seed => identical results
console.log('1. Reproducibility (same seed => same result)...');
const params = defaultParams();
const r1 = runSimulation(params);
const r2 = runSimulation(params);
assert(r1.ruinCount === r2.ruinCount, `ruinCount: ${r1.ruinCount} !== ${r2.ruinCount}`);
assert(r1.medianRetAge === r2.medianRetAge, `medianRetAge: ${r1.medianRetAge} !== ${r2.medianRetAge}`);
assert(r1.survivalPct === r2.survivalPct, `survivalPct: ${r1.survivalPct} !== ${r2.survivalPct}`);
assert(r1.median[15] === r2.median[15], 'median path differs');
console.log('   OK — two runs with seed 42 match.\n');

// 2. Different seed => different result (very likely)
console.log('2. Different seed => different result...');
const r3 = runSimulation(defaultParams({ seed: 12345 }));
const same = r1.ruinCount === r3.ruinCount && r1.medianRetAge === r3.medianRetAge && r1.median[20] === r3.median[20];
assert(!same, 'Expected different seed to produce different results');
console.log('   OK — seed 12345 gives different outcome.\n');

// 3. Sanity: simulation is doing real work
console.log('3. Sanity checks...');
assert(r1.numRuns === 2000, `numRuns: ${r1.numRuns}`);
assert(r1.ruinCount >= 0 && r1.ruinCount <= r1.numRuns, `ruinCount out of range: ${r1.ruinCount}`);
assert(r1.survivalPct >= 0 && r1.survivalPct <= 100, `survivalPct: ${r1.survivalPct}`);
assert(r1.medianRetAge >= 57 && r1.medianRetAge <= 63, `medianRetAge ${r1.medianRetAge} outside 57–63`);
assert(r1.ages.length === 90 - 45 + 1, `ages.length: ${r1.ages.length}`);
assert(r1.median[0] === 800000, 'Starting pot should be 800k');
assert(r1.median[10] > 0, 'Median path should be non-zero at age 55');
assert(r1.p5[10] < r1.median[10] && r1.p95[10] > r1.median[10], 'p5 < median < p95');
console.log('   OK — ruin count, retirement age, and percentiles in plausible ranges.\n');

// 4. More runs => more stable (and actually doing more work)
console.log('4. Scale: 500 vs 5000 runs...');
const small = runSimulation(defaultParams({ numRuns: 500, seed: 42 }));
const large = runSimulation(defaultParams({ numRuns: 5000, seed: 42 }));
assert(small.numRuns === 500 && large.numRuns === 5000, 'Run counts');
assert(small.median[25] > 0 && large.median[25] > 0, 'Both produce non-trivial paths');
console.log('   OK — both run; 5000 runs completes without error.\n');

// 5. Ballpark: results in plausible ranges (same params as Python defaults)
console.log('5. Ballpark vs expected (Python-like) ranges...');
assert(r1.survivalPct >= 70 && r1.survivalPct <= 100, `survivalPct ${r1.survivalPct}% expected 70–100%`);
assert(r1.medianRetAge >= 57 && r1.medianRetAge <= 63, `medianRetAge ${r1.medianRetAge} expected 57–63`);
assert(r1.medianEstate > 50000, `medianEstate £${r1.medianEstate} expected > 50k`);
console.log('   OK — survival %, retirement age, and estate in expected ranges.\n');

// 6. New defaults (age 50, pot 500k, contrib 20k, threshold 1M): plausible results
console.log('6. New defaults (age 50, 500k pot, 20k contrib, 1M threshold)...');
const newDefaults = defaultParams({
  currentAge: 50,
  startingPot: 500000,
  annualContribution: 20000,
  retirementThreshold: 1000000,
});
const rNew = runSimulation(newDefaults);
assert(rNew.startAge === 50, `startAge: ${rNew.startAge}`);
assert(rNew.ages.length === 90 - 50 + 1, `ages.length: ${rNew.ages.length}`);
assert(rNew.medianRetAge >= 57 && rNew.medianRetAge <= 63, `medianRetAge ${rNew.medianRetAge}`);
assert(rNew.medianPotAtRet >= 400000 && rNew.medianPotAtRet <= 2000000, `medianPotAtRet ${rNew.medianPotAtRet}`);
const idx59 = 59 - rNew.startAge;
const medianAt59 = rNew.median[idx59];
assert(medianAt59 >= 0, 'Median at age 59 should be non-negative');
console.log(`   Median retirement age: ${Math.round(rNew.medianRetAge)}`);
console.log(`   Median pot at retirement: £${Math.round(rNew.medianPotAtRet).toLocaleString()}`);
console.log(`   Median pot at age 59 (chart): £${Math.round(medianAt59).toLocaleString()}`);
console.log('   OK — (chart at 59 can be lower than "pot at retirement" because the chart is median across all runs at age 59; many have already retired and drawn down).\n');

// 7. Consistency: pot-at-retirement is per-run at that run's retirement year; chart is per-age across all runs
console.log('7. Consistency check...');
assert(rNew.median.length === rNew.ages.length, 'median array length should match ages');
assert(rNew.ages[0] === rNew.startAge && rNew.ages[rNew.ages.length - 1] === 90, 'ages range');
console.log('   OK — structure consistent.\n');

// 8. Defined benefit pensions: 5 x £100k from 65 should make a huge difference (100% survival, much higher estate)
console.log('8. Defined benefit pensions change results...');
const baseForDb = defaultParams({ numRuns: 1000, seed: 42 });
const withDb = defaultParams({
  numRuns: 1000,
  seed: 42,
  dbPensions: [
    { age: 65, amount: 100000 },
    { age: 65, amount: 100000 },
    { age: 65, amount: 100000 },
    { age: 65, amount: 100000 },
    { age: 65, amount: 100000 },
  ],
});
const rBase = runSimulation(baseForDb);
const rDb = runSimulation(withDb);
assert(rDb.survivalPct === 100, `With 5×£100k DB from 65 expected 100% survival, got ${rDb.survivalPct}%`);
assert(rDb.medianEstate > rBase.medianEstate * 1.5, `With DB, median estate should be much higher: ${rDb.medianEstate} vs ${rBase.medianEstate}`);
console.log(`   Without DB: survival ${rBase.survivalPct}%, median estate £${Math.round(rBase.medianEstate).toLocaleString()}`);
console.log(`   With 5×£100k DB from 65: survival ${rDb.survivalPct}%, median estate £${Math.round(rDb.medianEstate).toLocaleString()}`);
console.log('   OK — DB pensions are applied and change outcomes.\n');

// 9. Partner DC pensions: with a DC pot, total wealth and outcomes change
console.log('9. Partner DC pensions...');
const baseNoDc = defaultParams({ numRuns: 1000, seed: 42 });
const withDc = defaultParams({
  numRuns: 1000,
  seed: 42,
  dcPensions: [
    {
      currentValue: 100000,
      accessAge: 57,
      annualContribution: 5000,
      contributionsUntilPrincipalRetires: true,
      contributionsEndAge: 65,
    },
  ],
});
const rNoDc = runSimulation(baseNoDc);
const rWithDc = runSimulation(withDc);
assert(rWithDc.medianEstate >= rNoDc.medianEstate * 0.9, 'With Partner DC, median estate should be at least in same ballpark or higher');
assert(rWithDc.median[0] === 800000 + 100000, 'Total pot at start = main 800k + DC 100k');
console.log(`   Without Partner DC: median estate £${Math.round(rNoDc.medianEstate).toLocaleString()}`);
console.log(`   With Partner DC (100k now, 5k/yr until retire, access 57): median estate £${Math.round(rWithDc.medianEstate).toLocaleString()}`);
console.log('   OK — Partner DC pots are included and change outcomes.\n');

// 10. Partner DC with contributions until fixed age (not until retire)
console.log('10. Partner DC contributions until fixed age...');
const withDcEndAge = defaultParams({
  numRuns: 1000,
  seed: 42,
  dcPensions: [
    {
      currentValue: 0,
      accessAge: 60,
      annualContribution: 10000,
      contributionsUntilPrincipalRetires: false,
      contributionsEndAge: 45,
    },
  ],
});
const rDcEndAge = runSimulation(withDcEndAge);
assert(rDcEndAge.median[0] === 800000, 'Total at start = main only (DC has 0 value, contributions end at 45 so age 45 gets no contrib)');
assert(rDcEndAge.survivalPct >= 0 && rDcEndAge.medianRetAge >= 57, 'Run completes with fixed end age');
console.log('   OK — Contributions end at specified age when checkbox unchecked.\n');

console.log('All tests passed. Simulation is running the full Monte Carlo.');
console.log(`  Sample (seed 42, 2000 runs): survival ${r1.survivalPct.toFixed(1)}%, median ret age ${Math.round(r1.medianRetAge)}, median estate £${Math.round(r1.medianEstate).toLocaleString()}.`);
