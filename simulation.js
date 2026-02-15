'use strict';

const SIM_END_AGE = 90;

function makeRng(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(mu, sigma, rng) {
  const u1 = rng();
  const u2 = rng();
  if (u1 <= 0) return normal(mu, sigma, rng);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (index - lo) * (sorted[hi] - sorted[lo]);
}

function getPensions(age, params) {
  let p = 0;
  if (age >= params.pension1Age) p += params.pension1Amount;
  if (age >= params.pension2Age) p += params.pension2Amount;
  return p;
}

function runSimulation(params) {
  const {
    currentAge,
    startingPot,
    annualContribution,
    retirementThreshold,
    earliestRetirement,
    latestRetirement,
    incomeFloor,
    incomeCeiling,
    withdrawalRate,
    realArithmeticMean,
    volatility,
    numRuns,
    seed,
    pension1Age,
    pension1Amount,
    pension2Age,
    pension2Amount,
    numChildren,
    children,
    uniFeePerYear,
    uniYears,
    giftAmount,
    giftMinPot,
  } = params;

  const startAge = Math.min(SIM_END_AGE, Math.max(25, currentAge || 45));
  const logMu = Math.log(1 + realArithmeticMean) - 0.5 * volatility * volatility;
  const logSigma = volatility;
  const nAges = SIM_END_AGE - startAge + 1;
  const ages = [];
  for (let a = startAge; a <= SIM_END_AGE; a++) ages.push(a);

  const allPaths = Array(numRuns)
    .fill(null)
    .map(() => new Float64Array(nAges));
  const allTotalIncome = Array(numRuns)
    .fill(null)
    .map(() => new Float64Array(nAges));
  const retirementAges = new Int32Array(numRuns);
  const ruinAges = new Float64Array(numRuns);
  ruinAges.fill(Number.NaN);
  const giftMade = Array(numRuns)
    .fill(null)
    .map(() => new Uint8Array(4));

  for (let run = 0; run < numRuns; run++) {
    const rng = makeRng(seed + run * 1000);
    let retired = false;
    for (let i = 0; i < nAges; i++) allPaths[run][i] = i === 0 ? startingPot : 0;

    for (let i = 1; i < nAges; i++) {
      const age = ages[i];
      const logR = normal(logMu, logSigma, rng);
      const growthFactor = Math.exp(logR);
      const prev = Math.max(allPaths[run][i - 1], 0);
      let newVal = prev * growthFactor;

      if (!retired) {
        if (age >= earliestRetirement) {
          if (newVal >= retirementThreshold || age >= latestRetirement) {
            retired = true;
            retirementAges[run] = age;
          }
        }
      }

      if (!retired) {
        newVal += annualContribution;
      } else {
        const pensions = getPensions(age, params);
        let targetIncome = newVal * withdrawalRate;
        targetIncome = Math.max(targetIncome, incomeFloor);
        targetIncome = Math.min(targetIncome, incomeCeiling);
        let wdFromPot = Math.max(targetIncome - pensions, 0);
        wdFromPot = Math.min(wdFromPot, newVal);
        newVal -= wdFromPot;
        allTotalIncome[run][i] = wdFromPot + pensions;

        for (let c = 0; c < numChildren && c < 4; c++) {
          const child = children[c];
          if (child && child.getsGift && age === child.giftAge && !giftMade[run][c] && newVal >= giftMinPot) {
            newVal -= giftAmount;
            giftMade[run][c] = 1;
          }
        }

        if (newVal <= 0 && Number.isNaN(ruinAges[run])) ruinAges[run] = age;
      }

      for (let c = 0; c < numChildren && c < 4; c++) {
        const child = children[c];
        if (child && child.goesToUni && age >= child.uniStartAge && age < child.uniStartAge + uniYears) {
          newVal -= uniFeePerYear;
        }
      }

      allPaths[run][i] = Math.max(newVal, 0);
    }
  }

  const p5 = new Float64Array(nAges);
  const p10 = new Float64Array(nAges);
  const p25 = new Float64Array(nAges);
  const median = new Float64Array(nAges);
  const p75 = new Float64Array(nAges);
  const p95 = new Float64Array(nAges);
  const row = [];
  for (let i = 0; i < nAges; i++) {
    for (let run = 0; run < numRuns; run++) row[run] = allPaths[run][i];
    row.sort((a, b) => a - b);
    p5[i] = percentile(row, 5);
    p10[i] = percentile(row, 10);
    p25[i] = percentile(row, 25);
    median[i] = percentile(row, 50);
    p75[i] = percentile(row, 75);
    p95[i] = percentile(row, 95);
  }

  let ruinCount = 0;
  for (let r = 0; r < numRuns; r++) if (!Number.isNaN(ruinAges[r])) ruinCount++;

  const retAgesSorted = Array.from(retirementAges).sort((a, b) => a - b);
  const medianRetAge = percentile(retAgesSorted, 50);
  const potsAtRetirement = [];
  for (let r = 0; r < numRuns; r++) {
    const idx = retirementAges[r] - startAge;
    potsAtRetirement.push(allPaths[r][idx]);
  }
  potsAtRetirement.sort((a, b) => a - b);
  const medianPotAtRet = percentile(potsAtRetirement, 50);
  const estate = [];
  const finalIdx = SIM_END_AGE - startAge;
  for (let r = 0; r < numRuns; r++) estate.push(allPaths[r][finalIdx]);
  estate.sort((a, b) => a - b);
  const medianEstate = percentile(estate, 50);

  return {
    startAge,
    ages,
    p5,
    p10,
    p25,
    median,
    p75,
    p95,
    retirementAges,
    ruinCount,
    ruinAges,
    numRuns,
    medianRetAge,
    medianPotAtRet,
    medianEstate,
    survivalPct: 100 - (ruinCount / numRuns) * 100,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runSimulation };
} else {
  window.runSimulation = runSimulation;
}
