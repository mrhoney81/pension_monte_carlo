# Plan: Partner DC pension blocks

## Goal

Add support for multiple **Partner DC pension** pots, using the same list + add/remove pattern as **defined benefit pensions**. Each block has:

- **Current value** (£) — pot size today
- **Access age** — principal person’s age when this pot becomes available for withdrawal (e.g. when partner reaches their pension age)
- **Annual contribution** (£) — paid into this pot each year until a chosen end point (see below)
- **Contribution end:** either “until principal retires” (tick box) or “until principal reaches a specific age” (number)

All ages are anchored to the **principal person’s age** (the person whose retirement age and timeline the simulation follows).

---

## 1. Data model

**Per–Partner-DC item** (same shape in params and when read from DOM):

- `currentValue` (number) — starting pot in £
- `accessAge` (number) — principal’s age when this pot can be drawn (e.g. 70 when partner’s pension unlocks)
- `annualContribution` (number) — £ added to this pot each year while contributions are active
- `contributionsUntilPrincipalRetires` (boolean) — if **true**, contributions continue each year until the principal retires; if **false**, use `contributionsEndAge`
- `contributionsEndAge` (number) — principal’s age at which contributions to this pot stop (only used when `contributionsUntilPrincipalRetires` is false; e.g. 65 = last contribution in the year before principal turns 65, or define so that the year they turn this age is the last year of contribution — see simulation logic)

**Params:**

- `dcPensions`: array of `{ currentValue, accessAge, annualContribution, contributionsUntilPrincipalRetires, contributionsEndAge }`, same pattern as `dbPensions`.

---

## 2. UI (mirror DB pensions)

- **Placement:** New section **“Partner DC pensions”** immediately after **“Defined benefit pensions”** (before Children).
- **Structure (same pattern as DB):**
  - Heading + short hint (e.g. “Add partner DC pots: current value, your age when each becomes available for withdrawal, and yearly contribution. Each pot grows with the same market return.”).
  - Container: `dcPensionsList` (e.g. `class="dc-pensions-list"`).
  - Button: “Add partner DC pension”.
- **Per-row inputs (each row class `dc-pension-row`):**
  - **Current value (£)** — number, min 0, step e.g. 1000, placeholder or default 0.
  - **Access age (your age)** — number, min e.g. 55, max e.g. 75, default e.g. 57 (principal’s age when this pot can be withdrawn).
  - **Annual contribution (£)** — number, min 0, step e.g. 500, default 0.
  - **Contributions until I retire** — checkbox (checked by default). When **checked**: contributions continue until the principal retires. When **unchecked**: show an extra input:
    - **Contributions end at my age** — number (principal’s age), min e.g. current age, max e.g. 75, default e.g. 65. Contributions to this pot stop when the principal reaches this age (exact rule in §3).
  - **Remove** button to delete the row.
- **Behaviour:** When the checkbox is unchecked, the “Contributions end at my age” input is visible/enabled; when checked, it can be hidden or disabled. No need to read it when checkbox is checked.
- **Styling:** Reuse the same approach as `.db-pensions-list` / `.db-pension-row` (and optionally shared class names like `.pension-row` if you refactor later).
- **Reading params:** In `getParamsFromDom()`, loop over `.dc-pension-row`, read current value, access age, annual contribution, checkbox state, and (if unchecked) contributions end age; push `{ currentValue, accessAge, annualContribution, contributionsUntilPrincipalRetires, contributionsEndAge }` into `dcPensions`.

No README or other docs changes in this plan; only the DC feature.

---

## 3. Simulation logic (high level)

- **Per run:** Keep existing main pot array `allPaths[run][age]`. Add one array per DC pot, e.g. `dcPaths[run][dcIndex][age]` (or a 2D structure that’s easy to index by run and DC index).
- **Same market return for all pots:** Use the same `growthFactor` (same `logR`) for main pot and every DC pot in that year, so all wealth is subject to the same draw.
- **Contributions:**
  - **Main pot:** Unchanged: add `annualContribution` each year while not retired.
  - **Each Partner DC pot:** Add that DC’s `annualContribution` in a given year only while contributions are active for that DC:
    - If `contributionsUntilPrincipalRetires` is **true**: add contribution each year while principal is **not retired** (same as main pot).
    - If **false**: add contribution each year while principal’s age is **strictly less than** `contributionsEndAge` (so the last year of contribution is the year before they reach that age), regardless of retirement. (Alternative: include the year they turn `contributionsEndAge` as the last year of contribution — i.e. contribute while `age <= contributionsEndAge`; state the chosen rule in the implementation.)
- **“Total withdrawable pot”:** In any year when the principal is retired, define:
  - `totalPot = mainPot + sum(dcPot for each DC where principal’s age >= that DC’s accessAge)`.
- **Retirement trigger (threshold):** Decide whether retirement is allowed when “main pot only” vs “total withdrawable pot” reaches the threshold. **Recommendation:** Use **total withdrawable pot** (main + any DC pots already accessible at that age) when comparing to `retirementThreshold`. So if the main pot is below threshold but main + an accessible DC pot exceeds it, the principal can retire. If a DC’s `accessAge` is after the current age, that DC is not included in the total until that age.
- **Withdrawal (after retirement):**
  - Compute **pensions** (state, partner, DB) as now.
  - **Target income** = clamp(withdrawalRate × totalPot, incomeFloor, incomeCeiling).
  - **Withdrawal from pots** = target income − pensions (non‑negative, cap at totalPot).
  - Reduce pots by this withdrawal. **Recommendation:** take from pots **proportionally**:  
    - mainPot -= withdrawal × (mainPot / totalPot),  
    - each accessible dcPot -= withdrawal × (dcPot / totalPot).  
  - (If totalPot is 0, no withdrawal; avoid division by zero.)
  - Apply surplus pension → pot and gift/uni logic as now (against the combined wealth conceptually; implementation can keep applying to main pot only for gifts/uni if that matches your intent, or define a rule for which pot gets the surplus / pays uni and gifts — e.g. main pot first.)
- **Ruin:** Define “ruin” when **total withdrawable pot** (main + all accessible DCs) is ≤ 0 and no more withdrawals can be made (pensions only). So when totalPot hits zero (or would go negative after withdrawal), mark ruin as now.
- **Gifts / uni:** Today these are deducted from the main pot. **Recommendation:** keep deducting from the **main pot** only (so DC pots are not used for gifts/uni until/unless you explicitly change that later). Alternatively you could deduct proportionally from total; the plan should state “main pot only” for simplicity unless you want otherwise.

---

## 4. Implementation steps (order)

1. **Params and DOM**
   - Add `dcPensions` to `getParamsFromDom()` (read from each Partner DC row: current value, access age, annual contribution, “Contributions until I retire” checkbox, and if unchecked “Contributions end at my age”).
   - Add section in `index.html`: heading “Partner DC pensions”, hint, `#dcPensionsList`, “Add partner DC pension” button.
   - In `app.js`: `addDcPensionRow()` (or `addPartnerDcPensionRow()`), `setupDcPensions()` (listener for add button), and row markup: current value, access age, annual contribution, **checkbox “Contributions until I retire”** (checked by default), **“Contributions end at my age”** number input (visible/enabled only when checkbox unchecked, e.g. default 65), Remove button. Toggle visibility/disabled state of the age input when the checkbox changes.
   - Style rows (reuse or mirror `.db-pension-row`).

2. **Simulation**
   - In `simulation.js`, accept `dcPensions` in params.
   - Allocate per-run, per-DC arrays for DC pot values over age (same length as `nAges`).
   - In the main loop, for each year:
     - Compute growth for main pot as now; for each Partner DC, apply same growth and, if contributions are active for that DC (see §3: until principal retires vs until principal reaches contributionsEndAge), add its `annualContribution`.
     - When evaluating retirement: compute total withdrawable pot (main + DCs with age >= accessAge); use it for threshold and “can retire on pensions” check.
     - When retired: compute total withdrawable pot, target income, withdrawal from pots; apply proportional reduction to main pot and each accessible DC pot; then apply surplus, gifts, uni, ruin as now (gifts/uni from main pot only unless you specify otherwise).
   - Ensure ruin uses total pot (main + accessible DCs) ≤ 0.

3. **Reporting and chart**
   - **Chart:** For “portfolio value” over age, use **total pot** (main + all DCs that are accessible at that age) so the line is total wealth. That implies you need to store or recompute total pot per run per age (e.g. when aggregating percentiles).
   - **Stats:** Optionally add a line like “Partner DC pensions: N pots” or “Total Partner DC value at retirement (median): £X” in the stats block; can be in a follow-up.
   - **Full text report:** Include a short Partner DC section (e.g. list each pot’s current value, access age, contribution, and whether contributions run until principal retires or end at a given age; optionally median combined DC value at retirement).

4. **Tests**
   - Extend `test.js` `defaultParams()` with `dcPensions: []` and add one or two tests: e.g. one Partner DC with current value and no contribution, one with contribution (with and without “contributions until principal retires”); check that survival/median pot/retirement age change in the expected direction and that results are reproducible with the same seed.

---

## 5. Edge cases and choices

- **Access age &lt; current age:** Treat as “already accessible” from the first year of the simulation (include in total pot from start of draw phase).
- **Access age &gt; latest retirement age:** Pot only enters “total withdrawable” when principal reaches that age (e.g. partner’s pension at 70); no change to retirement trigger until then.
- **Zero current value, zero contribution:** Valid (e.g. placeholder for a future pot); pot stays 0 unless you add contribution.
- **Contributions end age in the past:** If “Contributions until I retire” is unchecked and `contributionsEndAge` ≤ principal’s current age, no contributions are ever paid into that Partner DC pot (only growth on current value).
- **Retirement threshold:** Use **total withdrawable pot** (main + accessible DCs) so a large DC that’s already accessible can trigger retirement.
- **Gifts and uni:** Plan: deduct from **main pot only**; document this so it can be revisited later if you want DC to participate.

---

## 6. Open decisions (to confirm before or during implementation)

- **Max number of Partner DC blocks:** Either no limit (like DB) or a cap (e.g. 5 or 10) to keep UI and arrays bounded.
- **Contributions end age rule:** When checkbox is unchecked, decide whether the last year of contribution is the year **before** principal reaches `contributionsEndAge` (age &lt; endAge) or the year **when** they reach it (age ≤ endAge).
- **Chart:** Confirm “total pot” (main + accessible DCs) is the single series you want for the existing percentile chart, or if you want a separate “main pot only” series as well.
- **Full report:** How much DC detail (per-pot at retirement vs just count and total).

Once these are decided, implementation can follow the steps above and stay aligned with the existing DB pattern.
