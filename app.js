(function () {
  'use strict';

  const SIM_END_AGE = 90;

  function getParamsFromDom() {
    const get = (id) => document.getElementById(id);
    const getNum = (id) => Number(get(id).value) || 0;
    const lockSeed = get('lockSeed').checked;
    const seed = lockSeed ? 42 : Math.floor(Math.random() * 1e6);
    return {
      currentAge: getNum('currentAgeNum') || 45,
      startingPot: getNum('startingPotNum'),
      annualContribution: getNum('annualContributionNum'),
      retirementThreshold: getNum('retirementThresholdNum'),
      earliestRetirement: getNum('earliestRetirementNum'),
      latestRetirement: getNum('latestRetirementNum'),
      incomeFloor: getNum('incomeFloorNum'),
      incomeCeiling: getNum('incomeCeilingNum'),
      withdrawalRate: getNum('withdrawalRateNum') / 100,
      realArithmeticMean: getNum('realReturnNum') / 100,
      volatility: getNum('volatilityNum') / 100,
      numRuns: Math.max(100, getNum('numRunsNum') || 3000),
      seed,
      pension1Age: getNum('pension1AgeNum') || 68,
      pension1Amount: getNum('pension1AmountNum'),
      pension2Age: getNum('pension2AgeNum') || 72,
      pension2Amount: getNum('pension2AmountNum'),
      numChildren: Math.min(4, Math.max(0, getNum('numChildrenNum') || 0)),
      children: (function () {
        const n = Math.min(4, Math.max(0, getNum('numChildrenNum') || 0));
        const arr = [];
        for (let c = 1; c <= 4; c++) {
          arr.push({
            goesToUni: get('child' + c + 'Uni').checked,
            uniStartAge: getNum('child' + c + 'UniAgeNum') || 58,
            getsGift: get('child' + c + 'Gift').checked,
            giftAge: getNum('child' + c + 'GiftAgeNum') || 70,
          });
        }
        return arr;
      })(),
      uniFeePerYear: getNum('uniFeePerYearNum'),
      uniYears: Math.max(1, getNum('uniYearsNum') || 4),
      giftAmount: getNum('giftAmountNum'),
      giftMinPot: getNum('giftMinPotNum'),
    };
  }

  function formatNum(x) {
    if (x >= 1e6) return (x / 1e6).toFixed(2) + 'M';
    return Math.round(x).toLocaleString();
  }

  let portfolioChart = null;

  function updateChart(result, params) {
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    const ages = result.ages;
    const inMillions = (arr) => Array.from(arr).map((v) => v / 1e6);
    const yMaxRaw = document.getElementById('chartYMax').value.trim();
    const yMax = yMaxRaw === '' || isNaN(Number(yMaxRaw)) ? undefined : Number(yMaxRaw);

    if (portfolioChart) portfolioChart.destroy();
    portfolioChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ages,
        datasets: [
          {
            label: '95th %ile',
            data: inMillions(result.p95),
            borderColor: 'rgba(37, 99, 235, 0.6)',
            borderWidth: 1,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: 'rgba(37, 99, 235, 0.8)',
          },
          {
            label: '75th %ile',
            data: inMillions(result.p75),
            borderColor: 'rgba(37, 99, 235, 0.5)',
            borderWidth: 1,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: 'rgba(37, 99, 235, 0.8)',
          },
          {
            label: 'Median',
            data: inMillions(result.median),
            borderColor: '#2563eb',
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#2563eb',
          },
          {
            label: '25th %ile',
            data: inMillions(result.p25),
            borderColor: 'rgba(37, 99, 235, 0.5)',
            borderWidth: 1,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: 'rgba(37, 99, 235, 0.8)',
          },
          {
            label: '5th %ile',
            data: inMillions(result.p5),
            borderColor: 'rgba(239, 68, 68, 0.9)',
            borderWidth: 1.2,
            borderDash: [4, 2],
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: 'rgba(239, 68, 68, 0.9)',
          },
          {
            label: 'Retirement threshold',
            data: ages.map(() => params.retirementThreshold / 1e6),
            borderColor: '#f59e0b',
            borderWidth: 1.2,
            borderDash: [2, 2],
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#f59e0b',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: `Portfolio value — money lasts to 90 in ${result.survivalPct.toFixed(0)}% of runs`,
          },
          legend: { display: true },
          tooltip: {
            callbacks: {
              label: function (context) {
                const age = ages[context.dataIndex];
                const valM = context.parsed.y;
                const val = valM * 1e6;
                const str = val >= 1e6 ? '£' + valM.toFixed(2) + 'M' : '£' + Math.round(val).toLocaleString();
                return context.dataset.label + ': ' + str + ' (age ' + age + ')';
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Age' },
            min: params.currentAge || 45,
            max: SIM_END_AGE,
          },
          y: {
            title: { display: true, text: 'Portfolio (£M)' },
            min: 0,
            max: yMax,
            ticks: { callback: (v) => '£' + v + 'M' },
          },
        },
      },
    });
  }

  function updateStats(result) {
    document.getElementById('survivalPct').textContent = result.survivalPct.toFixed(1);
    document.getElementById('ruinCount').textContent =
      result.ruinCount.toLocaleString() + ' / ' + result.numRuns.toLocaleString();
    document.getElementById('medianRetAge').textContent = Math.round(result.medianRetAge);
    document.getElementById('medianPotRet').textContent = formatNum(result.medianPotAtRet);
    document.getElementById('medianEstate').textContent = formatNum(result.medianEstate);
  }

  function runAndUpdate() {
    const loading = document.getElementById('loading');
    const stats = document.getElementById('stats');
    loading.hidden = false;
    stats.style.opacity = '0.5';
    setTimeout(() => {
      const params = getParamsFromDom();
      const result = window.runSimulation(params);
      updateStats(result);
      updateChart(result, params);
      loading.hidden = true;
      stats.style.opacity = '1';
    }, 10);
  }

  function bindSliders() {
    const pairs = [
      ['currentAge', 'currentAgeNum', 25, 60],
      ['startingPot', 'startingPotNum', 0, 2000000],
      ['annualContribution', 'annualContributionNum', 0, 80000],
      ['retirementThreshold', 'retirementThresholdNum', 100000, 2000000],
      ['earliestRetirement', 'earliestRetirementNum', 55, 62],
      ['latestRetirement', 'latestRetirementNum', 60, 68],
      ['incomeFloor', 'incomeFloorNum', 20000, 80000],
      ['incomeCeiling', 'incomeCeilingNum', 40000, 120000],
      ['withdrawalRate', 'withdrawalRateNum', 2, 6],
      ['pension1Age', 'pension1AgeNum', 66, 70],
      ['pension1Amount', 'pension1AmountNum', 0, 15000],
      ['pension2Age', 'pension2AgeNum', 66, 75],
      ['pension2Amount', 'pension2AmountNum', 0, 40000],
      ['numChildren', 'numChildrenNum', 0, 4],
      ['uniFeePerYear', 'uniFeePerYearNum', 0, 15000],
      ['uniYears', 'uniYearsNum', 3, 5],
      ['giftAmount', 'giftAmountNum', 0, 500000],
      ['giftMinPot', 'giftMinPotNum', 0, 1500000],
      ['child1UniAge', 'child1UniAgeNum', 50, 65],
      ['child1GiftAge', 'child1GiftAgeNum', 65, 80],
      ['child2UniAge', 'child2UniAgeNum', 50, 65],
      ['child2GiftAge', 'child2GiftAgeNum', 65, 80],
      ['child3UniAge', 'child3UniAgeNum', 50, 65],
      ['child3GiftAge', 'child3GiftAgeNum', 65, 80],
      ['child4UniAge', 'child4UniAgeNum', 50, 65],
      ['child4GiftAge', 'child4GiftAgeNum', 65, 80],
      ['realReturn', 'realReturnNum', 2, 10],
      ['volatility', 'volatilityNum', 8, 25],
      ['numRuns', 'numRunsNum', 500, 5000],
    ];
    pairs.forEach(([sliderId, numId, minVal, maxVal]) => {
      const slider = document.getElementById(sliderId);
      const numInput = document.getElementById(numId);
      if (!slider || !numInput) return;
      function fromSlider() {
        numInput.value = slider.value;
      }
      function fromNum() {
        const v = Number(numInput.value);
        if (isNaN(v)) return;
        // Only move the slider to the clamped value; keep the number input as typed
        // so the simulation uses whatever value the user entered (even outside slider range)
        const clamped = Math.max(minVal, Math.min(maxVal, v));
        slider.value = clamped;
      }
      slider.addEventListener('input', fromSlider);
      numInput.addEventListener('input', fromNum);
      numInput.addEventListener('change', fromNum);
    });
  }

  function setupRunButton() {
    document.getElementById('runBtn').addEventListener('click', runAndUpdate);
  }

  function setupChartYMax() {
    const el = document.getElementById('chartYMax');
    if (!el) return;
    function applyYMax() {
      if (!portfolioChart) return;
      const v = el.value.trim();
      portfolioChart.options.scales.y.max = v === '' || isNaN(Number(v)) ? undefined : Number(v);
      portfolioChart.update();
    }
    el.addEventListener('input', applyYMax);
    el.addEventListener('change', applyYMax);
  }

  function updateChildBlocksVisibility() {
    const n = Math.min(4, Math.max(0, Number(document.getElementById('numChildrenNum').value) || 0));
    for (let c = 1; c <= 4; c++) {
      const block = document.getElementById('childBlock' + c);
      if (block) block.hidden = c > n;
    }
  }

  function setupChildBlocksVisibility() {
    const numEl = document.getElementById('numChildrenNum');
    const sliderEl = document.getElementById('numChildren');
    if (numEl) numEl.addEventListener('input', updateChildBlocksVisibility);
    if (numEl) numEl.addEventListener('change', updateChildBlocksVisibility);
    if (sliderEl) sliderEl.addEventListener('input', updateChildBlocksVisibility);
    updateChildBlocksVisibility();
  }

  function loadInstructions() {
    const el = document.getElementById('instructions');
    if (!el) return;
    // Cache-bust so updates to instructions.md show after deploy (e.g. GitHub Pages)
    const url = 'instructions.md?v=' + (window.__buildTimestamp__ || Date.now());
    fetch(url)
      .then((r) => r.text())
      .then((text) => {
        if (typeof marked !== 'undefined') {
          el.innerHTML = marked.parse(text);
        } else {
          el.textContent = text;
        }
      })
      .catch(() => {
        el.textContent = 'Instructions could not be loaded. Add instructions.md to this folder when serving the page (e.g. via GitHub Pages or a local server).';
      });
  }

  bindSliders();
  setupRunButton();
  setupChartYMax();
  setupChildBlocksVisibility();
  loadInstructions();
  // Initial run on load so the page isn't empty
  runAndUpdate();
})();
