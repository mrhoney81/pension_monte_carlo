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
      dbPensions: (function () {
        const rows = document.querySelectorAll('.db-pension-row');
        const arr = [];
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const ageEl = r.querySelector('.db-age-num');
          const amountEl = r.querySelector('.db-amount-num');
          if (ageEl && amountEl) {
            const age = Number(ageEl.value) || 65;
            const amount = Number(amountEl.value) || 0;
            arr.push({ age: age, amount: amount });
          }
        }
        return arr;
      })(),
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
    var isMobile = window.innerWidth <= 900;
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
        maintainAspectRatio: !isMobile,
        aspectRatio: isMobile ? 1 : 2,
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

  function updateStats(result, params) {
    document.getElementById('survivalPct').textContent = result.survivalPct.toFixed(1);
    document.getElementById('ruinCount').textContent =
      result.ruinCount.toLocaleString() + ' / ' + result.numRuns.toLocaleString();
    document.getElementById('medianRetAge').textContent = Math.round(result.medianRetAge);
    document.getElementById('medianPotRet').textContent = formatNum(result.medianPotAtRet);
    document.getElementById('medianEstate').textContent = formatNum(result.medianEstate);
    var dbSumEl = document.getElementById('dbPensionsSummary');
    if (dbSumEl) {
      var db = (params && params.dbPensions) ? params.dbPensions : [];
      if (db.length > 0) {
        var total = 0;
        var minAge = 999;
        for (var d = 0; d < db.length; d++) {
          total += (db[d].amount || 0);
          if ((db[d].age || 0) < minAge) minAge = db[d].age;
        }
        dbSumEl.textContent = 'DB pensions in this run: ' + db.length + ' (total £' + Math.round(total).toLocaleString() + '/yr from age ' + minAge + ')';
        dbSumEl.style.display = '';
      } else {
        dbSumEl.style.display = 'none';
      }
    }
  }

  function fmt(x) {
    if (typeof x !== 'number' || isNaN(x)) return '—';
    if (x >= 1e6) return '£' + (x / 1e6).toFixed(2) + 'M';
    return '£' + Math.round(x).toLocaleString();
  }
  function fmtNum(x) {
    if (typeof x !== 'number' || isNaN(x)) return '—';
    return Math.round(x).toLocaleString();
  }

  function buildReport(result, params) {
    var p = params;
    var r = result;
    if (!r || !r.retirementAges || !r.ages) return 'Run simulation to generate the full report.';
    var lines = [];
    var ear = r.earliestRetirement != null ? r.earliestRetirement : 57;
    var lat = r.latestRetirement != null ? r.latestRetirement : 63;
    var retCounts = r.retAgeCounts || {};
    var incStats = r.incomeStats || {};
    lines.push('MONTE CARLO — DYNAMIC RETIREMENT AGE + 4% RULE — TODAY\'S £');
    lines.push('========================================================================');
    lines.push('  Starting pot:          ' + fmt(p.startingPot) + '  (age ' + p.currentAge + ')');
    lines.push('  Annual contribution:   ' + fmt(p.annualContribution));
    lines.push('  Retirement trigger:    Pot ≥ ' + fmt(p.retirementThreshold));
    lines.push('  Retirement window:     Age ' + p.earliestRetirement + '–' + p.latestRetirement);
    lines.push('  Withdrawal:            ' + (p.withdrawalRate * 100) + '% of pot = target income (inc. pensions); surplus pension added to pot');
    lines.push('  Income floor:          ' + fmt(p.incomeFloor) + '/yr');
    lines.push('  Income ceiling:        ' + fmt(p.incomeCeiling) + '/yr');
    lines.push('  Retirement:            when pot ≥ threshold, or age = latest, or pension income ≥ floor');
    lines.push('  State pension:         ' + fmt(p.pension1Amount) + '/yr from age ' + p.pension1Age);
    lines.push('  Partner pension:       ' + fmt(p.pension2Amount) + '/yr from age ' + p.pension2Age);
    var db = p.dbPensions || [];
    for (var d = 0; d < db.length; d++) {
      lines.push('  DB pension ' + (d + 1) + ':            ' + fmt(db[d].amount) + '/yr from age ' + db[d].age);
    }
    var uniParts = [];
    for (var c = 0; c < p.numChildren && c < p.children.length; c++) {
      if (p.children[c] && p.children[c].goesToUni)
        uniParts.push('child ' + (c + 1) + ' from age ' + p.children[c].uniStartAge);
    }
    lines.push('  Uni fees:              ' + fmt(p.uniFeePerYear) + '/yr × ' + p.uniYears + ' yrs' + (uniParts.length ? ', ' + uniParts.join(', ') : ' (none)'));
    var giftAges = [];
    for (var c2 = 0; c2 < p.numChildren && c2 < p.children.length; c2++) {
      if (p.children[c2] && p.children[c2].getsGift) giftAges.push(p.children[c2].giftAge);
    }
    lines.push('  Gifts:                 ' + fmt(p.giftAmount) + ' per child at ages ' + (giftAges.length ? giftAges.join(' & ') : '—'));
    lines.push('  Gift min pot:          ' + fmt(p.giftMinPot));
    lines.push('  Real return (arith):   ' + (p.realArithmeticMean * 100).toFixed(1) + '%');
    lines.push('  Volatility:            ' + (p.volatility * 100).toFixed(1) + '%');
    lines.push('  Simulations:           ' + fmtNum(r.numRuns));
    lines.push('========================================================================');
    lines.push('');
    lines.push('  RETIREMENT AGE DISTRIBUTION:');
    for (var a = ear; a <= lat; a++) {
      var count = retCounts[a] || 0;
      var pct = (count / r.numRuns * 100).toFixed(1);
      var bar = '█'.repeat(Math.floor(pct / 2));
      lines.push('    Age ' + a + ': ' + fmtNum(count).padStart(5) + ' runs (' + pct.padStart(5) + '%)  ' + bar);
    }
    lines.push('    Median retirement age: ' + Math.round(r.medianRetAge));
    lines.push('    Mean retirement age:   ' + (r.meanRetAge != null ? r.meanRetAge.toFixed(1) : '—'));
    lines.push('');
    lines.push('  POT AT RETIREMENT:');
    lines.push('    5th percentile:   ' + fmt(r.potAtRetirementP5));
    lines.push('    25th percentile:  ' + fmt(r.potAtRetirementP25));
    lines.push('    Median:           ' + fmt(r.medianPotAtRet));
    lines.push('    75th percentile:  ' + fmt(r.potAtRetirementP75));
    lines.push('    95th percentile:  ' + fmt(r.potAtRetirementP95));
    lines.push('');
    var gAll = r.giftAllCount != null ? r.giftAllCount : 0;
    var gSome = r.giftSomeCount != null ? r.giftSomeCount : 0;
    var gNone = r.giftNoneCount != null ? r.giftNoneCount : r.numRuns;
    lines.push('  GIFTS TO CHILDREN (' + fmt(p.giftAmount) + ' each, min pot ' + fmt(p.giftMinPot) + '):');
    lines.push('     All gifts made:        ' + fmtNum(gAll) + ' runs (' + (gAll / r.numRuns * 100).toFixed(1) + '%)');
    lines.push('     Some gifts made:       ' + fmtNum(gSome) + ' runs (' + (gSome / r.numRuns * 100).toFixed(1) + '%)');
    lines.push('     No gifts made:         ' + fmtNum(gNone) + ' runs (' + (gNone / r.numRuns * 100).toFixed(1) + '%)');
    lines.push('');
    var reportAges = [57, 60, 63, 65, 68, 70, 72, 75, 80, 85, 90].filter(function(age) { return age >= r.startAge && age <= 90; });
    lines.push(' Age  Pensions     ------- Total Income -------      ------ Portfolio Value ------');
    lines.push('                      5th    25th   Median    95th       5th      25th   Median    95th');
    lines.push('-'.repeat(95));
    function pensionsAtAge(age) {
      var t = (age >= p.pension1Age ? p.pension1Amount : 0) + (age >= p.pension2Age ? p.pension2Amount : 0);
      for (var d = 0; d < (p.dbPensions || []).length; d++) {
        if (age >= p.dbPensions[d].age) t += p.dbPensions[d].amount;
      }
      return t;
    }
    for (var i = 0; i < reportAges.length; i++) {
      var age = reportAges[i];
      var idx = age - r.startAge;
      if (idx < 0 || idx >= r.median.length) continue;
      var pens = pensionsAtAge(age);
      var inc = incStats[age];
      if (!inc) inc = { p5: 0, p25: 0, median: 0, p95: 0 };
      var retiredPct = 0;
      for (var rr = 0; rr < r.numRuns; rr++) if (r.retirementAges[rr] <= age) retiredPct++;
      retiredPct = (retiredPct / r.numRuns * 100).toFixed(0);
      var note = reportAges.length > 5 && age < p.latestRetirement ? '  (' + retiredPct + '% retired)' : '';
      lines.push(
        '  ' + String(age).padStart(2) + '  ' + fmt(pens).padStart(8) +
        '  ' + fmt(inc.p5).padStart(8) + ' ' + fmt(inc.p25).padStart(8) + ' ' + fmt(inc.median).padStart(8) + ' ' + fmt(inc.p95).padStart(8) +
        '  ' + fmt(r.p5[idx]).padStart(8) + ' ' + fmt(r.p25[idx]).padStart(8) + ' ' + fmt(r.median[idx]).padStart(8) + ' ' + fmt(r.p95[idx]).padStart(8) + note
      );
    }
    lines.push('');
    lines.push('  💰 Probability money lasts to 90:  ' + r.survivalPct.toFixed(1) + '%');
    lines.push('  ⚠️  Runs where money ran out:       ' + fmtNum(r.ruinCount) + ' / ' + fmtNum(r.numRuns) + ' (' + (r.ruinCount / r.numRuns * 100).toFixed(1) + '%)');
    if (r.ruinCount > 0 && r.medianRuinAge != null) {
      lines.push('     Median ruin age (when it happens): ' + Math.round(r.medianRuinAge));
      lines.push('     Earliest ruin age:                 ' + Math.round(r.earliestRuinAge));
      var totalPens = (p.pension1Amount || 0) + (p.pension2Amount || 0);
      for (var dp = 0; dp < (p.dbPensions || []).length; dp++) totalPens += (p.dbPensions[dp].amount || 0);
      lines.push('     After pot depleted, income = pensions only (up to ' + fmt(totalPens) + '/yr)');
    }
    lines.push('');
    lines.push('  🏠 ESTATE AT DEATH (age 90):');
    lines.push('     5th percentile:   ' + fmt(r.estateP5));
    lines.push('     10th percentile:  ' + fmt(r.estateP10));
    lines.push('     25th percentile:  ' + fmt(r.estateP25));
    lines.push('     Median:           ' + fmt(r.medianEstate));
    lines.push('     75th percentile:  ' + fmt(r.estateP75));
    lines.push('     95th percentile:  ' + fmt(r.estateP95));
    lines.push('     Mean:             ' + fmt(r.estateMean));
    return lines.join('\n');
  }

  function safeBuildReport(result, params) {
    try {
      return buildReport(result, params);
    } catch (e) {
      return 'Full report could not be generated. Run the simulation again.';
    }
  }

  function runAndUpdate() {
    const loading = document.getElementById('loading');
    const stats = document.getElementById('stats');
    loading.hidden = false;
    stats.style.opacity = '0.5';
    setTimeout(() => {
      const params = getParamsFromDom();
      const result = window.runSimulation(params);
      updateStats(result, params);
      updateChart(result, params);
      var reportEl = document.getElementById('fullReport');
      if (reportEl) reportEl.textContent = safeBuildReport(result, params);
      setTimeout(function () {
        if (portfolioChart) portfolioChart.resize();
      }, 150);
      loading.hidden = true;
      stats.style.opacity = '1';
    }, 10);
  }

  function bindSliders() {
    // Sliders removed; number inputs only
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
    if (numEl) numEl.addEventListener('input', updateChildBlocksVisibility);
    if (numEl) numEl.addEventListener('change', updateChildBlocksVisibility);
    updateChildBlocksVisibility();
  }

  function setupHelpPopover() {
    const popover = document.getElementById('helpPopover');
    if (!popover) return;
    function show(e) {
      const icon = e.target.closest('.help-icon');
      if (!icon || !icon.dataset.help) return;
      e.preventDefault();
      e.stopPropagation();
      popover.textContent = icon.dataset.help;
      popover.hidden = false;
      const rect = icon.getBoundingClientRect();
      const gap = 6;
      popover.style.left = rect.left + 'px';
      popover.style.top = (rect.bottom + gap) + 'px';
      requestAnimationFrame(function () {
        const popRect = popover.getBoundingClientRect();
        let left = parseFloat(popover.style.left);
        let top = parseFloat(popover.style.top);
        if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
        if (left < 8) left = 8;
        if (top + popRect.height > window.innerHeight - 8) top = rect.top - popRect.height - gap;
        if (top < 8) top = 8;
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';
      });
    }
    function hide() {
      popover.hidden = true;
    }
    document.body.addEventListener('click', function (e) {
      if (e.target.closest('.help-icon')) show(e);
      else if (!e.target.closest('.help-popover')) hide();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hide();
    });
  }

  function bindDbRow(row) {
    // No slider sync needed; number inputs only
  }

  function addDbPensionRow() {
    const list = document.getElementById('dbPensionsList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'db-pension-row';
    row.innerHTML =
      '<div class="control-group">' +
        '<label>Start age</label>' +
        '<input type="number" class="db-age-num" min="55" max="75" value="65" />' +
      '</div>' +
      '<div class="control-group">' +
        '<label>Amount (£/yr)</label>' +
        '<input type="number" class="db-amount-num" min="0" max="500000" step="500" value="5000" />' +
      '</div>' +
      '<button type="button" class="db-remove-btn">Remove</button>';
    const removeBtn = row.querySelector('.db-remove-btn');
    if (removeBtn) removeBtn.addEventListener('click', function () { row.remove(); });
    list.appendChild(row);
    bindDbRow(row);
  }

  function setupDbPensions() {
    const btn = document.getElementById('addDbPensionBtn');
    if (btn) btn.addEventListener('click', addDbPensionRow);
  }

  function loadInstructions() {
    const el = document.getElementById('instructions');
    if (!el) return;
    el.innerHTML = '<p style="color:#64748b">Loading…</p>';
    var baseEl = document.querySelector('base');
    var base = (baseEl && baseEl.href) || window.location.href;
    if (!base.endsWith('/') && !base.endsWith('.html')) base += '/';
    if (base.endsWith('.html')) base = base.replace(/\/[^/]*$/, '/');
    var url = base + 'instructions.md?v=' + (window.__buildTimestamp__ || Date.now());
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error(r.statusText);
        return r.text();
      })
      .then(function (text) {
        if (typeof marked !== 'undefined') {
          el.innerHTML = marked.parse(text);
        } else {
          el.textContent = text;
        }
      })
      .catch(function () {
        var fromFile = window.location.protocol === 'file:';
        el.innerHTML = fromFile
          ? '<p>Instructions are loaded when you view this page from the web (e.g. GitHub Pages). Opening the file directly from your computer does not load <code>instructions.md</code>.</p>'
          : '<p>Instructions could not be loaded. Add <code>instructions.md</code> when serving the page (e.g. GitHub Pages or a local server).</p>';
      });
  }

  window.addEventListener('resize', function () {
    if (portfolioChart && window.innerWidth <= 900) portfolioChart.resize();
  });

  bindSliders();
  setupRunButton();
  setupChartYMax();
  setupChildBlocksVisibility();
  setupDbPensions();
  setupHelpPopover();
  loadInstructions();
  // Initial run on load so the page isn't empty
  runAndUpdate();
})();
