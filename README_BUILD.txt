KPI Matrix Grid by Baztec — SOURCE v1.29.15.0
==============================================

v1.29.15.0 changes from v1.29.14.0:

  1. FIXED: confirmed bug — DAX measures using the "-1 = None" sentinel
     convention (a KPI-specific data-entry convention: -1 means "a
     real, confirmed result of nothing outstanding", distinct from a
     blank/not-yet-entered cell) returned the literal text "None", but
     the visual displayed it as "NA" instead. Root cause: parseCell()
     bucketed ANY non-numeric string into a single generic isNA state,
     and both displayMonthly()/displaySummary() then hardcoded the
     rendered text to the literal word "NA" regardless of what the
     underlying string actually said — correct in the DAX, wrong in
     the render. Confirmed via a live test: a measure temporarily
     returning the literal string "TESTVALUE123" also rendered as
     "NA", proving the mislabeling was unconditional for any non-
     numeric text, not specific to "NA" vs "None".

     Fix: added a third ParsedCell state, isNone, checked via an exact
     match on the literal text "None" ahead of the generic isNaN(...)
     fallback — so it can never collide with a genuine "NA" entry or
     a real numeric result. displayMonthly()/displaySummary() now
     check isNone first and render "None" instead of falling through
     to "NA". lastReportedIndex() also now treats isNone as "reported"
     (same as isNA already was), so a KPI whose latest month is a
     confirmed -1 isn't mistaken for one that's never reported at all.

     Deliberately unchanged: the derived Summary-column paths (Prior
     Month / Sum YTD / Average YTD, i.e. any row NOT on "custom" Wells
     5-7 mode) already excluded "None" from their sums/averages
     correctly before this fix, since deriveSummaryFromArrays() only
     ever inspects .numeric, never .isNA/.isNone — a None month was
     already silently treated as blank there, matching the existing
     (and requested) treatment of NA in that same code path. Only the
     two literal object bridges feeding those cells needed isNone:
     false added, for type-completeness, not behaviour change.

KPI Matrix Grid by Baztec — SOURCE v1.29.2.0 (FORMATTING MODEL MIGRATION, IN PROGRESS — NOT PRODUCTION)
==========================================================================================================

*** DO NOT IMPORT THIS INTO A PRODUCTION REPORT — 4 of 13 objects'
    format pane controls are still temporarily invisible: the four
    per-row/per-section repeating cards (rowLevelDecimals,
    rowLevelSummaryDisplay, rowLevelBehavior, sectionHeaders). ***

KPI Matrix Grid by Baztec — SOURCE v1.29.14.0
==============================================

v1.29.14.0 changes from v1.29.13.0 — Phase 3 (metadata/process
cleanup), partial. Per Master Prompt: Certification-Aligned Custom
Visual Development, Part E, Phase 3 items done that don't require
information only Barry has; the two that do are explicitly still
outstanding (see below), not silently skipped.

  Done:
    - package.json's lint script renamed from "lint" to "eslint",
      running the exact command the certification spec requires:
      "npx eslint . --ext .js,.jsx,.ts,.tsx" (previously just
      "npx eslint ."). Verified working via `npm run eslint`.
    - Dependency compatibility ceiling re-verified against the live
      npm registry, per Part C's explicit instruction to re-check
      this at each stage rather than assume it's still accurate:
      @typescript-eslint/eslint-plugin@8.64.0's peer dependency range
      is confirmed still `typescript: '>=4.8.4 <6.1.0'`. Enumerated
      every 6.0.x TypeScript release on the registry - 6.0.3 (current
      pin) is confirmed still the highest STABLE release in that
      range (everything above it up through the actual latest,
      7.0.2, is either outside the compatible range or an unreleased
      dev/rc build, not a real option). powerbi-visuals-api (5.11.0),
      powerbi-visuals-tools (7.1.2), eslint (10.7.0), and
      @typescript-eslint/eslint-plugin (8.64.0) are all already at
      current latest. Net result: no dependency version changes
      needed - the existing pins are still optimal, re-confirmed
      rather than assumed stale or assumed still fine.

  Explicitly still outstanding (asked Barry directly; deferred, not
  fabricated):
    - pbiviz.json's supportUrl is still the placeholder
      "https://example.com" - needs a real support URL before
      AppSource submission.
    - pbiviz.json's author.email is still the placeholder
      "barry@example.com" - needs a real email before AppSource
      submission.
    Per the child of "no work needed" principles this document
    follows elsewhere: a placeholder that looks plausible is worse
    than an obvious one - these were left exactly as-is rather than
    replaced with any invented-but-plausible-looking value, since
    only Barry has the real values.

  Not yet done, deliberately deferred to Phase 4 (not a Phase 3 gap):
    - A real package-lock.json only needs to exist in the actual
      GitHub certification-branch repo, not in these delivery zips
      (which deliberately exclude it, per the established two-
      deliverable convention, Part B item 4) - regenerating it is a
      one-command step (`npm install`) whenever Phase 4's repo setup
      actually happens, not useful to produce speculatively now.

  Verification (per the standing Part B checklist):
    - tsc --noEmit -p tsconfig.json - clean, 0 errors.
    - eslint . --ext .js,.jsx,.ts,.tsx (project's own eslint.config.mjs,
      now runnable as `npm run eslint`) - clean, 0 errors, 0 warnings.
    - pbiviz package - succeeds.
    - pbiviz package --certification-audit - still zero
      certification-blocking findings (Rendering Events and innerHTML
      both remain resolved from v1.29.10.0/v1.29.13.0). External
      Requests audit still clean.

  Breaking changes: none. No property, capability, format-pane, or
  rendering change of any kind - this version touches only
  package.json's scripts block and pbiviz.json's version string.

KPI Matrix Grid by Baztec — SOURCE v1.29.13.0
==============================================

v1.29.13.0 changes from v1.29.12.0 — Phase 2, Region 6 (Hover popup)
converted from innerHTML to real DOM APIs. This was the LAST
remaining innerHTML site in the visual - Phase 2 is now functionally
complete: zero innerHTML use anywhere in visual.ts, per Master Prompt:
Certification-Aligned Custom Visual Development, Part E.

  Converted: `this.tooltipEl.innerHTML = line(...) + line(...) + ...`
  (the Prior/New/Swing hover popup content, built via a `line()`
  string-template helper) is now built with a `makeLine()` helper that
  returns a real HTMLElement (createElement/appendChild/textContent),
  appended directly into `this.tooltipEl` after clearing its previous
  children with the same `while (firstChild) removeChild` pattern
  already used elsewhere in this file for clearing `this.container`.
  Same structure preserved exactly: Prior line, New line, then a
  bordered wrapper div containing the Swing line - three top-level
  children, identical styles/colours/font sizes to before.

  `esc()` is no longer called anywhere in visual.ts as of this
  version - every text-insertion site in the entire rendering
  pipeline now goes through `.textContent` or `.dataset`, both
  injection-safe by construction. The helper function itself is left
  in place (unused-but-harmless) rather than deleted, since removing
  it is a separate, deliberately trivial cleanup step - not bundled
  into this certification-focused change.

  Verified with real runtime evidence (jsdom smoke test, test-only,
  not part of delivered source):
    - Dispatched a real `mouseenter` event on a `.mgcell` element
      after a normal `update()` call. Confirmed: dataset values read
      correctly (prior=100, cur=110, pl=JAN, cl=FEB,
      polarity=moreIsMore), tooltip became visible
      (style.display="block"), got exactly 3 child elements matching
      the original Prior/New/Swing structure, and rendered the
      correct text ("Prior (JAN)100New (FEB)110Swing+10.0" with the
      up-arrow glyph) with the correct swing colour logic.
    - Dispatched `mouseleave` - confirmed display reverts to "none".
    - Dispatched a second `mouseenter` - confirmed child count stays
      at 3 (not 6), proving old content is genuinely cleared before
      rebuilding on repeat hovers, not accumulated.

  Verification (per the standing Part B checklist):
    - tsc --noEmit -p tsconfig.json - clean, 0 errors.
    - eslint . --ext .js,.jsx,.ts,.tsx (project's own eslint.config.mjs)
      - clean, 0 errors, 0 warnings.
    - pbiviz package - succeeds.
    - pbiviz package --certification-audit - the
      powerbi-visuals/no-inner-outer-html finding is GONE. Lint check
      completed with zero errors reported at all. External Requests
      audit still clean ("No external requests found in the visual.").

  Breaking changes: none. No property, capability, or format-pane
  change. Rendered markup/styles/behaviour identical to v1.29.12.0,
  confirmed via the smoke test above.

  Net effect on Part C's certification checklist: BOTH real blockers
  identified at v1.29.9.0 (Rendering Events API, innerHTML) are now
  fully resolved. Remaining work before certification submission is
  Phase 2 Step 7 (re-validate the auto-fit/measurement pass under
  real DOM-built cells - next up), then Phase 3 (metadata/process
  cleanup: real supportUrl, real author email, package.json eslint
  script rename, package-lock.json), Phase 4 (GitHub repo +
  certification branch, Barry's side), and Phase 5 (final
  re-verification + submission prep).

KPI Matrix Grid by Baztec — SOURCE v1.29.12.0
==============================================

v1.29.12.0 changes from v1.29.11.0 — Phase 2, Regions 2/3/5 (KPI row
rendering, Summary column, Trend chart) converted from innerHTML to
real DOM APIs in one combined pass, plus Region 4 (section header
rows) folded in for the same structural reason - per Master Prompt:
Certification-Aligned Custom Visual Development, Part E.

  Explicit deviation from the original strict region-by-region split,
  decided and confirmed before building: row label, monthly cells,
  Summary column cells, and the Trend chart cell are all siblings
  within the same <tr> for a given KPI row, so they could not be
  converted as independent innerHTML-free checkpoints the way the
  table skeleton (Region 1) could - any attempt to keep them separate
  would have required a small innerHTML/insertAdjacentHTML bridge
  somewhere to splice unconverted string-built cells into an otherwise
  real <tr>, which doesn't actually reduce certification risk. Section
  header rows (originally its own Region 4) were folded in for the
  identical reason: once <tbody> itself stops being string-built,
  every row appended into it - KPI row or section header - has to be
  a real DOM node.

  Converted:
    - `renderTagValue()` - now returns a real HTMLElement (built with
      createElement/appendChild/textContent) instead of an HTML
      string. Both the "stacked" and "right" tagPosition layouts
      preserved exactly - same divs/spans, same classes
      (value-number-block, value-prefix-part, value-digits-part,
      value-suffix-part), same styles.
    - `renderGoalDeltaCell()` - now returns a real HTMLTableCellElement
      instead of an HTML string. Both goalDeltaLayout branches
      ("oneLine" and stacked/default) preserved exactly, including the
      goaldelta-goal-part / goaldelta-delta-part classes the auto-fit
      pass measures against.
    - Section header rows, the KPI row <tr> itself, the row-label
      <td>, every monthly value <td> (including its data-prior /
      data-cur / data-pl / data-cl / data-decmode / data-decmonthly /
      data-polarity attributes - now set via `.dataset.*` instead of
      string-interpolated HTML attributes, functionally identical),
      all three Summary column branches (tagPosition "right" with
      Value+Tag+GoalDelta, stacked without GoalDelta using colspan=2,
      stacked with GoalDelta), and the Trend chart cell (real <canvas
      class="trend-canvas"> with data-rowidx via .dataset, or the grey
      filler cell when a row's chart is off) - all now built with
      createElement/appendChild/textContent/.dataset, appended
      directly into a real <tbody> via tbody.appendChild(tr).
    - The `esc()` helper's job (HTML-attribute/text escaping) is now
      handled implicitly and more robustly by `.textContent` and
      `.dataset` assignment - both are injection-safe by construction,
      so no manual escaping call was needed at any of these sites
      (esc() itself is untouched and still used by the one remaining
      innerHTML site - the hover popup).

  Not touched, confirmed unnecessary to touch: `drawSparkline()` and
  the canvas-based trend chart drawing logic - already pure Canvas 2D
  API, never used innerHTML, per the Phase 2 sequence's own note to
  verify this rather than assume it.

  Verified with real runtime evidence, not just static checks (given
  the scope - most of update()'s body changed construction method):
  built a jsdom-based smoke-test harness (test-only, not part of the
  delivered source) that ran the actual `update()` method against
  representative mock data through jsdom, then inspected the real DOM
  output:
    - No runtime exceptions on initial render, on a simulated data
      refresh (second update() call), or on the empty-dataView path.
    - renderingStarted/renderingFinished fired in lockstep every time
      (1/1, then 2/2, then 3/3 across three update() calls) with 0
      renderingFailed calls throughout.
    - Row labels and monthly values rendered correctly in the correct
      cells; header row month labels correct; a second update() call
      correctly cleared and rebuilt (no row duplication/leakage).
    - Trend chart cells rendered real <canvas class="trend-canvas">
      elements with correct data-rowidx per row; jsdom's own "canvas
      2D context not implemented" limitation was hit and handled
      gracefully by the existing `if (!ctx) return;` guard in
      drawSparkline - no crash.
    - Summary/Goal-Delta cells rendered correctly empty when no
      summary measures were bound (matches documented no-goal
      blank-grey-cell behaviour) - initially misread as a possible
      bug ("tag=\"undefined\"" in a debug log line) but confirmed to
      be a test-harness artifact (optional-chaining a null element,
      not real rendered text) via an explicit follow-up check
      scanning the whole DOM for literal "undefined" text in real
      elements - none found.

  Verification (per the standing Part B checklist):
    - tsc --noEmit -p tsconfig.json - clean, 0 errors.
    - eslint . --ext .js,.jsx,.ts,.tsx (project's own eslint.config.mjs)
      - clean, 0 errors, 0 warnings.
    - pbiviz package - succeeds.
    - pbiviz package --certification-audit - innerHTML finding count
      dropped from 2 to 1. Only remaining site: this.tooltipEl.innerHTML
      (hover popup, Phase 2 step 6 - untouched by this version).
      External Requests audit still clean.

  Breaking changes: none. No property, capability, or format-pane
  change. Rendered markup/CSS classes/data attributes are identical
  in shape to v1.29.11.0 - construction method only, confirmed by the
  smoke test above, not just assumed from the diff.

  Next: Phase 2, Region 6 (hover popup - this.tooltipEl.innerHTML).
  Once that's converted, innerHTML should be fully eliminated from the
  visual - Phase 2, Step 7 (re-validate the auto-fit/measurement pass
  under real DOM-built cells) becomes the natural next step after that,
  since it already relies on querySelectorAll against the same CSS
  classes this version preserved.

KPI Matrix Grid by Baztec — SOURCE v1.29.11.0
==============================================

v1.29.11.0 changes from v1.29.10.0 — Phase 2, Region 1 (Table
skeleton) converted from innerHTML to real DOM APIs, per Master
Prompt: Certification-Aligned Custom Visual Development, Part E.

  Converted: the <table>/<colgroup>/<thead> construction that used to
  be built as one template-literal string and injected via
  `tableWrap.innerHTML = html`. Now built entirely with
  `document.createElement()` / `.appendChild()` / `.style.cssText` /
  `.textContent` - no string concatenation, no innerHTML, anywhere in
  this region. Header cell text (site name, month labels, summary
  header label, "Trend") now goes through `.textContent` instead of
  the `esc()` helper + string interpolation - `.textContent` is
  inherently safe against injection, so `esc()` is simply unnecessary
  here (still used elsewhere, unchanged, until those regions convert).

  Bridged, not yet converted (intentional - their own checkpoints,
  Phase 2 steps 2-4 per Part E): KPI row rendering, Summary column,
  and section header rows are still built as one HTML string exactly
  as before, then set via `tbody.innerHTML = html` on a real `<tbody>`
  element that gets appended into the real DOM-built `<table>`. This
  keeps the visual in a working, testable state at every checkpoint -
  same discipline used for the 13-object Formatting Model migration.

  Also bridged, unaffected: this.tooltipEl.innerHTML (hover popup,
  Phase 2 step 6) - completely untouched by this change.

  Downstream compatibility - verified, not assumed: the auto-fit /
  shrink-to-fit measurement pass, and the click-to-expand hover popup
  logic, both locate the table and its cells via
  `tableWrap.querySelector("table")` and `tableWrap.querySelectorAll(...)`
  against CSS classes (.col-label, .col-value, .th-summary, etc.).
  Since the real DOM-built <table> carries the same classes as before
  and is appended into the same `tableWrap` div, every one of these
  selectors continues to resolve identically - confirmed by reading
  each call site, not assumed to "just work."

  Verification (per the standing Part B checklist):
    - tsc --noEmit -p tsconfig.json - clean, 0 errors.
    - eslint . --ext .js,.jsx,.ts,.tsx (project's own eslint.config.mjs)
      - clean, 0 errors, 0 warnings. (Note: stale .tmp/ build output
      from a prior `pbiviz package` run briefly caused unrelated
      parsing errors on generated .d.ts files - not a source issue,
      resolved by clearing .tmp/ before linting, same reason .tmp/ is
      already excluded from the source zip.)
    - pbiviz package - succeeds.
    - pbiviz package --certification-audit - the innerHTML finding
      count is unchanged at 2 (tbody bridge line, tooltip line) -
      confirms Region 1's conversion introduced no new finding and
      genuinely eliminated the table-skeleton's own innerHTML use.
      External Requests audit still clean.

  Breaking changes: none. No property, capability, or format-pane
  change. Rendered markup/CSS classes are identical to v1.29.10.0 -
  this is an internal construction-method change only, not a visual
  or behavioural change.

  Next: Phase 2, Region 2 (KPI row rendering - row label cell, monthly
  value cells).

KPI Matrix Grid by Baztec — SOURCE v1.29.10.0
==============================================

v1.29.10.0 changes from v1.29.9.0 — Rendering Events API added
(Certification Phase 1, per Master Prompt: Certification-Aligned
Custom Visual Development).

  Adds the required renderingStarted() / renderingFinished() /
  renderingFailed() calls that Power BI's "export to PDF" and "export
  to PowerPoint" listeners depend on to know when the visual has
  actually finished rendering. Confirmed missing at v1.29.9.0 by
  `pbiviz package --certification-audit`:

      error  Rendering Events - https://learn.microsoft.com/en-us/power-bi/developer/visuals/event-service
      error  Found 1 certification issue(s). Fix them before submitting for certification.

  That error is now gone from the audit output - re-verified below.

  Implementation, verified against Microsoft's current documentation
  (https://learn.microsoft.com/en-us/power-bi/developer/visuals/event-service),
  not assumed from memory:

    - New `private events: IVisualEventService` field, initialized in
      the constructor from `options.host.eventService`.
    - `update()` itself is now a thin wrapper: calls
      `renderingStarted(options)`, then runs the entire previous
      update() body (now extracted unchanged into a new private
      `render(options)` method) inside a try/catch. On success, calls
      `renderingFinished(options)`. On any thrown error, calls
      `renderingFailed(options, String(error))` and rethrows (so
      existing error behaviour is unchanged - failures still surface
      the same way to Power BI, they're just reported to the event
      service too).
    - Both of render()'s existing early-return paths (no dataView /
      no categorical, and no measures bound to KPI Actual Values) are
      untouched - they return normally out of render(), and update()
      calls renderingFinished() right after render() returns either
      way. No dedicated per-branch signaling was needed for these,
      since neither is a failure state.
    - Not touched: any of render()'s actual rendering logic, its two
      innerHTML sites (tableWrap.innerHTML, tooltipEl.innerHTML - that
      rewrite is Phase 2, a separate dedicated project), the Formatting
      Model / settings.ts, or capabilities.json.

  Verification (per the standing Part B checklist, all clean):
    - tsc --noEmit -p tsconfig.json - clean, 0 errors.
    - eslint . --ext .js,.jsx,.ts,.tsx (project's own eslint.config.mjs)
      - clean, 0 errors, 0 warnings.
    - pbiviz package - succeeds. Its own bundled recommended-config
      lint pass still reports the 2 known, already-documented
      innerHTML findings (powerbi-visuals/no-inner-outer-html at the
      same two sites as before, tableWrap.innerHTML and
      tooltipEl.innerHTML) - pre-existing, not a regression from this
      change, and explicitly Phase 2's job, not Phase 1's.
    - pbiviz package --certification-audit - re-run and confirmed the
      "Rendering Events" error is no longer present. The External
      Requests audit still reports clean ("No external requests found
      in the visual."). Remaining audit output is only the same 9
      "recommended, not required" feature warnings from v1.29.9.0
      (Allow Interactions, Color Palette, Context Menu, High Contrast,
      Highlight Data, Keyboard Navigation, Landing Page, Selection
      Across Visuals, Tooltips) - unchanged, still not certification
      blockers.

  Breaking changes: none. No property, capability, or format-pane
  change of any kind - this version touches only visual.ts's internal
  update()/render() structure and adds one new private field.

  Net effect on Part C's certification checklist: of the two real
  blockers identified at v1.29.9.0 (Rendering Events API, innerHTML),
  one is now fully resolved. innerHTML remains, tracked as its own
  Phase 2 project per the master prompt's Part E sequencing.

KPI Matrix Grid by Baztec — SOURCE v1.29.9.0
=============================================

v1.29.9.0 changes from v1.29.8.0 — ROLLBACK, explicitly rejected.

  v1.29.8.0 moved decimalsMode/valueUnit/popupPolarity out of each
  KPI's own group into a separate, dedicated top-level "Global
  Settings" group. Explicitly rejected after seeing it - rolled back to
  the exact v1.29.7.0 structure: each of the 30 "KPI N" groups again
  opens with its own "----- Monthly and Summary Global Settings -----"
  block (Decimals mode, Value unit, Popup polarity), before Monthly
  Value Columns / Summary Col 1/2/3 / Trend Chart, exactly as it was
  at the end of v1.29.7.0. No separate top-level "Global Settings"
  group exists anymore.

  capabilities.json is unaffected by this rollback (v1.29.8.0 never
  changed it either - only settings.ts's grouping changed and has now
  changed back).

  Confirmed clean: tsc --noEmit, eslint, a full pbiviz package, and a
  re-run of --certification-audit all succeed with no regressions -
  identical state to v1.29.7.0's structure.

v1.29.8.0 changes from v1.29.7.0 — Global Settings pulled out to its
own top-level group, per explicit request.

  decimalsMode/valueUnit/popupPolarity no longer open each of the 30
  "KPI N" groups. They now live in a single, SEPARATE, dedicated
  top-level group named "Global Settings" (first in the list, before
  KPI 1), containing all 30 KPIs' worth of these 3 controls as one flat
  list with a "----- KPI N -----" ReadOnlyText divider separating each
  KPI's own three values.

  Important nuance preserved (not lost in the restructure): these are
  still NOT single shared values - each of the 30 KPIs keeps its own
  fully independent decimalsMode/valueUnit/popupPolarity, exactly as
  before. Only the format-pane PRESENTATION changed - which group they
  visually sit in - not their underlying data model. A Group cannot
  contain child Groups (confirmed against the library's actual type
  definitions before building this - CardGroupEntity only has `slices`,
  never `groups`), so "one group per KPI" wasn't achievable for this
  block without breaking the "one dedicated top-level group" requirement
  - the flat-list-with-dividers approach was the correct fit instead.

  Each of the 30 "KPI N" groups now starts directly with "Monthly Value
  Columns" - unchanged otherwise from v1.29.7.0's regional ordering
  (Monthly -> Summary Col 1/2/3 -> Trend Chart).

  capabilities.json UNCHANGED this version - property names and the
  rowLevelControl object are identical to v1.29.7.0; only settings.ts's
  grouping/presentation changed, not the underlying property structure.

  Confirmed clean: tsc --noEmit, eslint, a full pbiviz package, and a
  re-run of --certification-audit all succeed with no regressions.

v1.29.7.0 changes from v1.29.6.0 — major restructuring of all per-row
controls, per explicit request.

  1. REMOVED: chartStyle.trendChartNote (the v1.29.6.0 ReadOnlyText test
     example) - no longer needed now that the real pattern is used at
     scale below.

  2. BREAKING: the three separate Row Level Control cards/objects
     (rowLevelDecimals, rowLevelSummaryDisplay, rowLevelBehavior)
     CONSOLIDATED into ONE card/object: "rowLevelControl". Property
     NAMES are completely unchanged (kpi1decimalsMode, kpi1noGoal,
     etc.) - only the capabilities.json object they're declared under
     changed, from three objects down to one. Any report with values
     already saved under the three old object names will have those
     specific values reset to default on upgrade - flagged explicitly
     multiple times in the conversation record before this was built,
     confirmed acceptable given this visual's current development
     stage.

  3. NEW internal organization within each KPI's collapsible group:
     controls are no longer grouped by type (toggle/dropdown) - they're
     grouped LEFT TO RIGHT by which part of the rendered visual they
     actually affect, separated by ReadOnlyText divider lines
     ("----- Label -----" format) instead of real controls:
       ----- Monthly and Summary Global Settings -----
         Decimals mode, Value unit, Popup polarity
       ----- Monthly Value Columns -----
         Custom decimals (monthly), Disable conditional formatting
       ----- Summary — Value (Col 1) -----
         Show actual value, Summary mode, Summary decimals
       ----- Summary — Tag (Col 2) -----
         Summary tag
       ----- Summary — Goal/Delta (Col 3) -----
         No goal, Show goal, Show delta
       ----- Trend Chart -----
         Show trend chart

  4. REAL FINDING while building the Global Settings block (confirmed
     against the actual render code, not assumed): three properties
     affect BOTH monthly cells and the Summary column, not just one
     region each -
       - decimalsMode / valueUnit: already known to apply to both
         monthly and summary display formatting.
       - popupPolarity: confirmed via effectivePolarity in visual.ts -
         drives BOTH the monthly hover popup's swing colour AND the
         Summary column's own CF background colour for derived summary
         modes (Prior Month/Sum YTD/Average YTD). Originally assumed to
         be monthly-only; moved to the Global block once this was
         actually verified in code rather than guessed.
     All other 10 properties were individually checked against the
     render logic and confirmed genuinely single-region - e.g.
     disableCF was verified to affect ONLY monthly-cell CF, never
     Summary CF, so it correctly stays in the Monthly block.

  5. rowCtrl() in visual.ts updated: all 13 getProp() calls that used to
     read from "rowLevelDecimals"/"rowLevelSummaryDisplay"/
     "rowLevelBehavior" now read from the single "rowLevelControl"
     object - this is the actual RENDER-time read (independent of the
     format pane), so this update was required for rendering to keep
     working correctly with the new consolidated object, not just a
     format-pane cosmetic change.

  Confirmed clean: tsc --noEmit, eslint, a full pbiviz package, and a
  re-run of --certification-audit all succeed with no regressions -
  Format Pane remains absent from the audit output, only Rendering
  Events remains as a certification blocker, unchanged.

v1.29.6.0 changes from v1.29.5.0 — first real ReadOnlyText example,
worked example per explicit request.

  Added chartStyle.trendChartNote: a ReadOnlyText slice placed directly
  between the "Show trend chart column" toggle and "Trend chart column
  width" - a static, non-editable line of text reading "The settings
  below only apply when \"Show trend chart column\" is on."

  Confirms the mechanism concretely: ReadOnlyText is a genuine Slice
  (same family as ToggleSwitch/NumUpDown/ColorPicker/etc.) so it can be
  placed anywhere inside a slices array, interspersed between real
  controls - distinct from a slice's own `description` field, which is
  a hover-tooltip attached to ONE specific control rather than a
  standalone line in the card's flow.

  Confirmed clean: tsc --noEmit, eslint, and a full pbiviz package all
  succeed with no errors. NOTE: the exact rendered appearance (font
  size, spacing, whether it reads as a plain line of text or something
  more boxed-in) has not been visually confirmed in a live Power BI
  Desktop session in this environment - worth checking once imported,
  and reporting back if the styling needs adjustment.

KPI Matrix Grid by Baztec — SOURCE v1.29.5.0
=============================================

v1.29.5.0 changes from v1.29.4.0 — format pane naming clarity pass.

  Investigated whether the visual had genuinely redundant/overlapping
  controls (prompted directly). Found NO literal duplication - nothing
  where two properties do the exact same thing - but did find several
  controls in different cards sharing the EXACT SAME unqualified label,
  which reads as overlap when scanning the pane even though each
  targets a distinct rendered element. Six displayName strings renamed
  to be self-descriptive without needing card context - property names
  and stored values are completely unaffected, this is purely a label
  change:
    - hoverPopup.fontSize: "Font size" -> "Hover popup font size"
    - monthlyValues.fontSize: "Font size" -> "Monthly values font size"
    - kpiRowHeaders.font: "Font" -> "Row label font"
    - kpiRowHeaders.color: "Text color" -> "Row label text color"
    - kpiRowHeaders.alignment: "Alignment" -> "Row label alignment"
    - columnHeaders.font: "Font" -> "Column header font"
    - columnHeaders.color: "Text color" -> "Column header text color"
    - columnHeaders.alignment: "Alignment" -> "Column header alignment"

  Deliberately NOT changed: chartStyle's "Positive/Negative line
  colour" vs conditionalFormatting's "Positive/Negative color" (and
  font color) pairs. These control genuinely different rendered
  elements (trend chart line stroke vs cell background/text) - merging
  or renaming them risks implying they're more related than they are;
  flagged in the conversation record as understood-but-distinct rather
  than acted on.

  Also noted, not acted on: 10 independent font-size controls and 6
  independent bold toggles exist across 9 different cards. Not
  redundant - each targets genuinely distinct text (row labels, column
  headers, monthly cell values, summary value, goal/delta text, tag
  text, chart month letters, hover popup text, section header text) -
  but flagged as inherent surface area from this visual's granular
  per-element styling, not something introduced by or fixable through
  the Formatting Model migration.

v1.29.4.0 changes from v1.29.3.0 — both items deferred during the
Formatting Model migration, now done:

  1. chartStyle.goalLineStyle upgraded from free text to a genuine
     capabilities.json enumeration (Dashed / Dotted / Solid), matching
     an AutoDropdown in settings.ts instead of a TextInput. Render logic
     in visual.ts is unchanged - it already checked for "dashed"/
     "dotted" and fell through to solid for anything else; "solid" is
     now an explicit, correctly-labelled dropdown choice rather than an
     implicit catch-all. Any existing report already using "dashed" or
     "dotted" is unaffected - same stored string values.

  2. kpiRowHeaders and columnHeaders: fontFamily/fontSize/bold
     consolidated into a single FontControl composite slice each - one
     combined font picker control in the format pane instead of three
     separate rows. Each sub-part's name still binds to the exact same
     capabilities.json property it always did (fontFamily/fontSize/
     bold) - purely a format-pane presentation change, no property
     renamed, no stored values affected. columnHeaders' Site Name
     fontSize/bold were deliberately left as separate slices - there is
     no siteNameFontFamily property to pair them with, and FontControl
     requires a fontFamily sub-part.

  Confirmed clean: tsc --noEmit, eslint, a full pbiviz package, and a
  re-run of --certification-audit all succeed with no regressions -
  Format Pane remains absent from the audit output, only Rendering
  Events remains as a certification blocker, unchanged from v1.29.3.0.

v1.29.3.0 changes from v1.29.2.0 — migrated the final 4 of 13 objects
and completed the migration:

  1. rowLevelDecimals, rowLevelSummaryDisplay, rowLevelBehavior,
     sectionHeaders all added to settings.ts as CompositeCard classes,
     each built via a loop (kpi1..kpi30, or s1..s12 for sections) rather
     than 30/12 hand-written near-identical blocks - same shape as the
     old enumerateObjectInstances loops, just constructing Group/Slice
     objects instead of a flat property dictionary.

  2. REAL UX UPGRADE delivered as a side effect: using CompositeCard
     (multiple named Groups per card) instead of SimpleCard means each
     KPI and each section is now its own COLLAPSIBLE group in the format
     pane, instead of one very long flat list of ~180/~120/~90/~52
     properties. This was already flagged as a separate long-standing
     wishlist item before the migration started - it came for free by
     choosing the right component type for these four objects.

  3. sectionHeaders specifically: one "Global settings" group (the 4
     global properties, unchanged) followed by 12 "Section N" groups (4
     properties each) - matches the reduced 12-slot count from v1.28.0.0.

  4. One real technical note: NumUpDown's value type is a plain number,
     not nullable - sNpos (section row position) previously defaulted to
     literal null via getProp(..., null). Now defaults to 0, which
     produces IDENTICAL behaviour to the old default under
     readSections()'s existing `pos >= 1` check (0 fails that check
     exactly like null did) - a deliberate, verified-equivalent
     substitution, not a behaviour change.

  5. STEP 5 COMPLETE: enumerateObjectInstances() removed entirely from
     visual.ts (162 lines) - it had been confirmed dead code at runtime
     since v1.29.0.0 (Power BI calls only one of
     getFormattingModel()/enumerateObjectInstances() for the whole
     visual, never both), and every object has now been migrated so
     there was nothing left for it to serve as reference for. Two
     now-unused imports (EnumerateVisualObjectInstancesOptions,
     VisualObjectInstanceEnumeration) removed alongside it.
     getProp()/getColorProp() are UNCHANGED and still used extensively
     throughout update() for actual rendering - only the format-pane-
     population mechanism changed, never the rendering logic itself,
     exactly as scoped at the start of this migration.

  6. CONFIRMED RESULT: re-ran `pbiviz package --certification-audit`
     with all 13 objects present. The "Format Pane" certification
     warning is gone from the output completely - not just reduced,
     entirely absent, confirmed by direct before/after comparison
     across this whole migration. Only "Rendering Events" remains as a
     certification blocker - separate, unrelated work. The innerHTML
     architecture issue (the single biggest certification blocker,
     identified before this migration started) is also unaffected by
     this work - a real rendering-layer rewrite, not a format-pane
     concern.

  Confirmed clean throughout every step of this migration: tsc --noEmit,
  eslint (both plain and the exact --ext .js,.jsx,.ts,.tsx form required
  for certification), and a full pbiviz package all succeeded with zero
  errors at every checkpoint, not just the final one.

v1.29.2.0 changes from v1.29.1.0 — migrated objects 3 through 9 of 13:
"monthlyValues", "chartStyle", "gridLines", "conditionalFormatting",
"kpiRowHeaders", "columnHeaders", "summaryColumn".

  All seven Cards added to settings.ts, each checked property-by-property
  against the real current enumerateObjectInstances defaults before
  writing (not assumed from memory) - confirmed matching exactly.

  Two real design decisions made along the way, both flagged in code
  comments at the point of decision:
    - chartStyle.goalLineStyle stays a TextInput (matching
      capabilities.json's actual declared type - "text": true, not a
      true enumeration) rather than upgrading it to a dropdown. A real
      opportunity, deliberately deferred to keep this migration pass
      mechanical/low-risk rather than also redesigning controls mid-move.
    - kpiRowHeaders/columnHeaders keep fontSize/fontFamily/bold as three
      independent slices rather than consolidating into a single
      FontControl composite slice (which the library does support). Same
      reasoning - noted as a future enhancement, not done now.

  Two new Slice types introduced this pass (not needed for the first two
  objects): AutoDropdown for every true capabilities.json enumeration
  (alignment fields, goalDeltaLayout, tagPosition) - pulls its item list
  directly from the existing capabilities.json declaration, no
  duplicated option list in code. FontPicker specifically for the
  "formatting": {"fontFamily": true} property type.

  Cards migrated so far (9 of 13): hoverPopup, layout, monthlyValues,
  chartStyle, gridLines, conditionalFormatting, kpiRowHeaders,
  columnHeaders, summaryColumn.
  Still on the old path (all four are the big repeating objects, built
  via loops rather than individual declarations - deliberately saved for
  their own dedicated pass): rowLevelDecimals, rowLevelSummaryDisplay,
  rowLevelBehavior, sectionHeaders.

  Confirmed clean: tsc --noEmit, eslint, and a full pbiviz package all
  succeed with no errors at this checkpoint.

v1.29.1.0 changes from v1.29.0.0 — migrated object 2 of 13: "layout".

  Added LayoutCardSettings to settings.ts, covering all 6 existing
  layout properties (rowPaddingV, rowPaddingH, showKpiNumbers,
  showSummaryColumn, alternateRowShading, showFutureMonths) - defaults
  matched exactly against the current enumerateObjectInstances "layout"
  case before writing the Card, not assumed. Confirmed clean: tsc
  --noEmit, eslint, and a full pbiviz package all succeed with no errors.

  Cards migrated so far: hoverPopup, layout (2 of 13).
  Still on the old path: monthlyValues, chartStyle, gridLines,
  conditionalFormatting, kpiRowHeaders, columnHeaders, summaryColumn,
  rowLevelDecimals, rowLevelSummaryDisplay, rowLevelBehavior,
  sectionHeaders.

v1.29.0.0 changes from v1.28.1.0 — Formatting Model migration, STEP 1
(skeleton) + STEP 2 (hoverPopup proof of concept) of the 6-step plan:

  1. NEW FILE: src/settings.ts - defines VisualSettingsModel (extends
     formattingSettings.Model) with ONE card so far: HoverPopupCardSettings,
     covering the single "fontSize" property (default 44, matching the
     existing capabilities.json/enumerateObjectInstances default exactly).

  2. visual.ts changes:
       - Added imports: FormattingSettingsService (from
         powerbi-visuals-utils-formattingmodel) and VisualSettingsModel
         (from ./settings).
       - New private members: formattingSettingsService,
         settingsModel.
       - Constructor: instantiates FormattingSettingsService via
         this.host.createLocalizationManager() - NOTE: IVisualHost does
         NOT have a direct .localizationManager property (a real error
         caught by tsc during this build) - the correct call is the
         createLocalizationManager() METHOD.
       - update(): one new line populating this.settingsModel from the
         current dataView, placed immediately after this.lastDataView is
         set. This is DELIBERATELY independent of the existing
         objects/getProp()/getColorProp() reads used for actual
         rendering everywhere else in update() - settingsModel only
         feeds the format pane, never the render logic. Confirms the
         plan's claim that update()'s rendering path is unaffected by
         this migration.
       - New method: getFormattingModel(), calling
         formattingSettingsService.buildFormattingModel(this.settingsModel).

  3. CRITICAL FINDING, confirmed by testing (not assumed): Power BI
     treats getFormattingModel() and enumerateObjectInstances() as
     MUTUALLY EXCLUSIVE FOR THE WHOLE VISUAL, not per-object. The moment
     getFormattingModel() exists, Power BI stops calling
     enumerateObjectInstances() entirely - for every object, not just
     hoverPopup. enumerateObjectInstances() is left in the code
     unmodified, but is DEAD CODE at runtime in this build - kept only
     as reference material for migrating the remaining 12 objects.
     This means the migration cannot be shipped/tested as a series of
     small production-ready increments in Power BI Desktop the way
     ordinary feature work can - every remaining object needs its Card
     written before this can replace the real v1.28.x line. Individual
     objects CAN still be written and type-checked incrementally
     (as done here), just not round-tripped in the actual format pane
     one at a time without hiding the rest.

  4. CONFIRMED RESULT: re-ran `pbiviz package --certification-audit`
     against this build. The "Format Pane" certification warning
     ("going to be required soon") is GONE from the output entirely -
     confirmed by direct before/after comparison, not assumed. Only
     "Rendering Events" remains as a certification blocker (unrelated,
     separate work). This validates the migration approach concretely
     before committing to migrating the other 12 objects.

NEXT STEPS (not yet done): migrate the remaining 12 objects per the
established order (layout, monthlyValues, chartStyle, gridLines,
conditionalFormatting, kpiRowHeaders, columnHeaders, summaryColumn, then
the four repeating objects last: rowLevelDecimals, rowLevelSummaryDisplay,
rowLevelBehavior, sectionHeaders), then remove enumerateObjectInstances()
entirely once every object has a working Card in settings.ts.

v1.28.1.0 changes from v1.28.0.0:

  MAINTENANCE (build tooling / dependencies only - no rendering or
  format-pane behaviour changes):

  1. powerbi-visuals-api: ~5.3.0 -> ~5.11.0 (pbiviz.json apiVersion
     updated to match).
  2. powerbi-visuals-utils-formattingmodel: 6.0.4 -> 7.1.0 (still unused
     in code - ready for the eventual Formatting Model migration).
  3. powerbi-visuals-tools (global pbiviz CLI): 7.1.0 -> 7.1.2.
  4. eslint: ^9.11.1 -> ^10.7.0.
  5. @typescript-eslint/eslint-plugin: ^8.8.0 -> ^8.64.0.
  6. eslint-plugin-powerbi-visuals: ^1.0.0 -> ^1.1.1.
  7. typescript: pinned at 6.0.3 - NOT the absolute latest (7.0.2).
     Tested first: TypeScript 7.0.2 install fails outright, since
     @typescript-eslint/eslint-plugin@8.64.0 (the current latest) peer-
     depends on typescript "<6.1.0" - the two tools aren't compatible
     with each other yet regardless of what TypeScript itself supports.
     6.0.3 is the actual current ceiling given that constraint.
  8. FIXED (found while testing the TypeScript 6.0.3 pin for real,
     rather than as an accidental global-vs-local mismatch as
     previously documented): tsconfig.json's moduleResolution was set
     to the classic "node" mode, deprecated as of TypeScript 6.0 and
     due for full removal in 7.0 - reproduced the exact error this
     project's own history had flagged before. Migrated to the modern
     "bundler" resolution (module: "ESNext" also set to match) rather
     than just suppressing the deprecation warning. This surfaced one
     knock-on fix: the .less stylesheet side-effect import
     (import "./../style/visual.less";) could no longer be resolved
     under the stricter bundler mode - added src/less.d.ts (an ambient
     module declaration) and added it to tsconfig.json's "files" list
     to resolve this. Confirmed clean: tsc --noEmit, eslint (both the
     plain run and the exact --ext .js,.jsx,.ts,.tsx form required for
     certification), and a full pbiviz package all succeed with no
     errors on the real source (the "2 lint errors" pbiviz's own
     internal check reports are confirmed to be stray .tmp/dist build
     artifacts being linted, not the actual project source - these
     folders should never be committed to any repository regardless).

v1.28.0.0 changes from v1.27.0.0:

  1. BREAKING: Section header slots reduced 25 -> 12 (s1-s12 remain;
     s13-s25 REMOVED entirely). Section headers were never tied 1:1 to
     KPI rows - this is independent of item 7's KPI slot increase. Any
     report using section slots above 12 will have those specific
     sections silently drop on upgrade.

  2. FIXED: no more border between Cell A (Value) and the Tag column
     introduced in v1.27.0.0 - only the shared inner edge is suppressed
     (border-right removed from Value, border-left removed from Tag);
     top/bottom/outer borders are untouched. Reads as one seamless
     block. Only applies when Tag has its own column (non-stacked mode)
     - stacked mode is unaffected.

  3. CHANGED + FIXED: Value cell's horizontal padding doubled (2x
     rowPaddingH, computed dynamically - not a separate fixed property,
     so it always tracks whatever rowPaddingH is set to). Bundled with a
     genuine bug fix found while implementing this: the auto-fit width
     measurement for Value (non-stacked mode) and for Goal/Delta
     (oneLine mode) was measuring ONLY the inner content
     (.value-number-block / the Goal+Delta sub-columns), never
     accounting for the <td>'s own padding at all - meaning padding was
     silently squeezing whatever space was left inside an
     already-exactly-sized column, compounding truncation rather than
     being properly reserved for. Both measurements now explicitly add
     back their cell's real padding before computing natural width, so
     doubling Value's padding actually widens the column to compensate,
     rather than squeezing content further.
       Also fixed in the same pass: the numeric digits box
     (.value-digits-part) was missing white-space:nowrap and
     text-overflow:ellipsis - every other shrinking element in this
     visual already had both. Without them, a digit that didn't fit the
     shrunk box silently WRAPPED to an invisible second line (hidden by
     the cell's fixed row height) instead of ellipsing visibly -
     confirmed as "144.09M" losing its "5" with zero visual indication
     anything was cut. Now ellipses cleanly ("14...M") like everything
     else, and widening the visual (reducing shrink pressure) restores
     the full number on the next render.

  4. NEW: background colour property for the Site Name corner cell
     (columnHeaders.siteNameBackground), independent of the shared
     columnHeaders.background used for month headers. Default: no
     colour (transparent).

  5. BREAKING: "Show Trend chart" and "Trend chart column width"
     (previously layout.showTrendChart / layout.chartColumnWidth) moved
     to the Trend Chart card (chartStyle.showTrendChart /
     chartStyle.chartColumnWidth). Any existing report with these set
     will have them reset to default on upgrade (confirmed acceptable).

  6. CHANGED: Row Level Control - Summary Display property order
     rearranged so all four toggles (No Goal, Show Goal, Show Actual,
     Show Delta) appear first, followed by Summary Tag, then Value
     Unit - was previously Summary Tag, Value Unit, then the four
     toggles. Property names are unchanged, only their declared order
     (which drives format-pane display order) - no data loss, existing
     values are unaffected by this reordering.

  7. BREAKING (additive - existing settings unaffected): KPI row slots
     increased 25 -> 30, applied consistently everywhere the cap
     existed: rowLevelDecimals, rowLevelSummaryDisplay, rowLevelBehavior,
     and the underlying Wells 2/3/4 data role caps (actualValues/
     goalValues/cfValues max 25 -> 30). Section headers (item 1) are
     explicitly excluded from this increase - they use their own,
     separate, now-smaller slot count.

v1.27.0.0 changes from v1.26.0.0:

  1. BREAKING: "Tag position" (summaryColumn.tagPosition) enum reduced to
     TWO values - "stacked" (Above value, default, unchanged) and
     "right" (Right of value, own column). The "left" option has been
     REMOVED entirely from the dropdown. Any report with tagPosition
     explicitly stored as "left" will now be treated identically to
     "right" (defensive backward-compatibility handling: every internal
     check is now tagPosition !== "stacked" rather than === "right"), so
     the Tag doesn't silently disappear - it just renders on the right
     instead of the left, which is the closest available equivalent
     now that "left" no longer exists as a concept.

  2. BREAKING: "Tag/value gap" (summaryColumn.tagValueGap) REMOVED
     entirely. It controlled the flex gap between Tag and Value when
     they shared one cell - that shared-cell layout no longer exists in
     "right" mode (see below), so there's nothing left for a gap to
     apply to.

  3. NEW (root-cause architectural fix): in "right" mode, the Tag now
     renders in its OWN DEDICATED COLUMN, immediately to the right of
     Value, centered within it - not sharing a flex row with Value at
     all anymore. This eliminates an entire confirmed bug class from
     v1.23.0.0/v1.25.0.0/v1.26.0.0 at its root: Tag's rendered width
     used to depend on Value's own prefix/suffix/digit width (which
     varies unpredictably row to row, e.g. a K/M suffix eating into the
     shared space), causing exactly the kind of squeeze/clipping that
     three prior versions tried and failed to fully resolve within the
     shared-cell model. With Tag fully independent:
       - Tag's natural width is auto-measured globally (widest Tag text
         anywhere in the matrix) and NEVER grows beyond that, regardless
         of surplus width elsewhere - only Goal/Delta absorbs surplus,
         unchanged from existing design.
       - Tag CAN shrink under real width pressure, as a genuine third
         participant in the existing shrink-to-fit cascade alongside
         Value and Goal/Delta (previously a two-way split, now three-way
         when Tag exists as its own column) - down to the same 24px
         floor used elsewhere.
       - Tag's column ALWAYS renders regardless of
         summaryColumn.showGoalDeltaColumn - when Goal/Delta is off,
         only its own column/cells are omitted; Tag is unaffected and
         keeps showing. Value never uses a colspan trick in "right"
         mode anymore (that was a stacked-mode-specific technique to
         begin with).
       - Background and font colour always mirror Value's cell exactly
         (same CF-driven states, same no-goal grey-out), bold by
         default, 4px padding (deliberately tighter than the standard
         rowPaddingH used elsewhere, to stay minimal without colliding
         with neighbouring columns).
       - The header's merged "Summary" label now spans 3 columns
         (Value+Tag+Goal/Delta) when Goal/Delta is showing, or 2
         (Value+Tag) when it's off - previously always 2.
     "stacked" mode is completely unaffected - Tag still renders above
     Value in one shared cell, exactly as before this version.

v1.26.0.0 changes from v1.25.0.0:

  1. FIXED: confirmed bug - the v1.25.0.0 per-row Tag width fix computed
     the correct narrower width for each row's Tag but the browser was
     silently IGNORING it. Root cause: flex children default to
     min-width:auto, which floors a flex item at its own content's
     natural size and overrides any explicit width set on it (in CSS or
     JS) once that width would go narrower than the content needs. The
     Tag span never had min-width:0 set, so the JS-computed shrink width
     from v1.25.0.0 was correct in the math but never actually took
     effect - the Tag stayed at its natural size regardless, overflowed
     its box, and got hard-clipped by the outer container instead of
     hitting its own text-overflow:ellipsis (which only fires when the
     box itself is genuinely narrower than the content).
       Fix: min-width:0 added to .value-tag-part, .value-number-block,
     and .value-digits-part - the three Cell A elements that receive an
     explicit JS-computed width under the shrink cascade.
       Also added preemptively (same root cause, not yet reported for
     this specific case but identical mechanism): .goaldelta-goal-part
     and .goaldelta-delta-part, the Goal/Delta oneLine sub-columns from
     v1.21.0.0, which get the same kind of explicit JS-computed width
     under shrink pressure and were equally exposed to this bug even
     though it hadn't yet surfaced as a reported symptom there.

v1.25.0.0 changes from v1.24.0.0:

  1. FIXED: confirmed bug - Cell A's Tag (left/right tagPosition modes)
     was still cutting off specifically on rows with a K/M numeric
     suffix, even after the v1.23.0.0 ellipsis fix. Root cause: the
     shrink-to-fit math scaled only the digits-box uniformly across all
     rows, then relied on CSS flex-shrink for the Tag - but a row's
     prefix ("$") and suffix ("K"/"M") never shrink and aren't uniform
     across rows (some rows have a suffix, some don't), so at the SAME
     shared column width, a suffix-row's number-block rendered wider
     than a no-suffix row's, silently stealing extra room from that
     row's Tag specifically - CSS flex-shrink had no way to account for
     this per-row asymmetry.
       Fix: prefix and suffix are now ALWAYS rendered as their own
     classed spans (.value-prefix-part / .value-suffix-part, even when
     empty), so the auto-fit block can measure each row's own prefix/
     suffix width individually. The Tag's width is now set EXPLICITLY
     in JS, per row, as: (shrunk column width) - (this row's own prefix
     width) - (the globally-aligned digits-box width) - (this row's own
     suffix width) - (tagValueGap) - rather than left to CSS flex-shrink
     to guess at. A row with a K/M suffix now correctly gets a narrower
     (more-ellipsized) Tag than a no-suffix row at the same column
     width, instead of both being treated identically. The natural
     (un-shrunk) width calculation was also corrected to use this same
     per-row accounting - taking the max, across every row, of that
     row's own (prefix + aligned-digits + suffix + gap + tag) - instead
     of re-measuring the whole number-block as one combined blob, which
     couldn't distinguish "shrinkable" from "fixed" pieces within it.
     Only engages when the Value column actually shrinks under real
     width pressure - the natural/no-shrink case is unaffected, still
     handled by the existing flex layout with no explicit Tag width.

v1.24.0.0 changes from v1.23.0.0:

  1. FIXED: trend chart month letters (J...D) clipping at the first and
     last position. Root cause: the plotting margin was only 3px each
     side, and with ctx.textAlign="center" the letter is centered ON
     that x position - so half its width extended past the canvas edge
     at both ends. Fixed by widening the margin to 6px each side
     (applies to both the plotted line/points and the letters together,
     so everything stays aligned - the usable plotting width just gets
     very slightly narrower).

  2. NEW: chartStyle.monthLetterFontSize (plain fixed number, default 8)
     - REPLACES the old dynamic Math.max(7, plotW/18) auto-scaling
     formula entirely. No auto mode, no toggle - a straightforward
     manual control, per explicit request.

  3. CHANGED (defaults only, confirmed against the person's own current
     format-pane screenshots): kpiRowHeaders.fontSize 26 -> 20;
     kpiRowHeaders.wrapText true -> false; monthlyValues.bold false ->
     true; chartStyle.goalLineThickness 1 -> 2; summaryColumn.
     goalDeltaLayout "stacked" -> "oneLine". Existing reports that never
     touched these five properties will pick up the new defaults on
     upgrade; anyone who explicitly set their own values keeps them
     unaffected. Every other property visible in the reference
     screenshots (monthlyValues.fontSize, kpiRowHeaders.fontFamily/bold/
     alignment, summaryColumn.valueFontSize/goalDeltaFontSize/
     tagPosition/tagValueGap/tagFontSize, and every chartStyle property
     other than goalLineThickness) already matched the current shipped
     defaults and needed no change.

v1.23.0.0 changes from v1.22.0.0:

  1. FIXED: confirmed bug - Cell A's Tag (v1.22.0.0's left/right digit-
     alignment layout) had flex-shrink:0 on BOTH the number-block and the
     Tag span, so under real width pressure (shrink-to-fit cascade
     engaged) neither was allowed to compress - whatever didn't fit was
     hard-clipped by the cell's overflow:hidden with NO ellipsis marker
     at all (confirmed: Tag text like "YTD" clipping mid-letter with no
     "..."). Fix: Tag span changed to flex-shrink:1, so it now compresses
     under pressure and hits its own existing ellipsis cleanly, matching
     how every other space-constrained element in this visual already
     degrades. The number-block itself remains flex-shrink:0, since its
     digits-box already has its own separate proportional-shrink handling
     from v1.22.0.0.

  2. CHANGED: fmt()'s "auto" decimals branch only - values >= 100M now
     render with 1 decimal instead of 2 (e.g. "146.1M" instead of
     "146.09M"), specifically to control the rendered width of very
     large numbers. Values >= 1M and < 100M are unchanged at 2 decimals;
     >= 1K unchanged at 1 decimal; everything below 1K unchanged. Scope
     is deliberately narrow: "custom" mode (an explicit per-row decimal
     count) is untouched and still respects whatever was explicitly set,
     even above 100M; fmtStandard() (a separate, deliberately flat/non-
     negotiable decimals mode) is untouched; the hover popup's own
     number formatting (popupDecimals()/fmtSwing(), full-precision with
     commas, a different display surface entirely) is untouched.

v1.22.0.0 changes from v1.21.0.0:

  1. NEW: per-row "show actual value" toggle (object
     "rowLevelSummaryDisplay", property "kpiNshowActual", 25 slots,
     default TRUE - no visual change on upgrade). Lives alongside the
     existing showGoal/showDelta toggles. Suppresses DISPLAY only - the
     underlying Summary Actual number keeps driving Summary CF colouring
     and the Delta calculation exactly as before; only the visible text
     in Cell A is blanked when off.

  2. FIXED: Cell A (Summary column's Value + Tag) alignment in
     tagPosition "left" and "right" modes ONLY - "stacked" mode is
     unaffected, unchanged. Previously the whole value+tag unit was
     centered as one flowing block, so both the number's last digit AND
     the Tag's position drifted per-row depending on how wide that row's
     own number happened to be (the exact same class of problem fixed
     for Goal/Delta in v1.21.0.0, now applied to Cell A). Fixed via:
       - Every formatted value is split into an optional "$" prefix, the
         pure numeric core (digits/decimal/minus - the part that
         actually needs to align), and a trailing suffix (K/M from
         fmt()'s abbreviation, and/or "%" from applyUnit). The core sits
         in a globally-measured, fixed-width, right-aligned box (the
         widest core found ANYWHERE in the Summary column) so every
         row's last digit lines up at the same x. Prefix/suffix sit
         immediately outside that box, unaffected by the alignment.
       - The Tag is pinned flush to the OPPOSITE edge from the number
         block (right edge in "right" mode, left edge in "left" mode)
         via a flex layout with justify-content:space-between plus the
         existing summaryColumn.tagValueGap as a guaranteed minimum
         separation - reused rather than replaced with a new hardcoded
         constant, so the existing property stays meaningful. A row with
         no Tag at all keeps its number in exactly the same aligned
         position - the number never shifts toward where a Tag would
         have sat, per explicit requirement.
       - The natural width used for Cell A's auto-fit sizing is now
         computed as a genuine two-stage measurement (measure the widest
         numeric core first, apply it, THEN measure the combined
         number-block+Tag) rather than a single naive whole-cell pass -
         avoids undercounting in the same way the Goal/Delta fix needed
         to in v1.21.0.0. If Cell A ever shrinks under the existing
         shrink-to-fit cascade, the digits box shrinks proportionally
         along with it, same technique as the Goal/Delta sub-parts.

v1.21.0.0 changes from v1.20.0.0:

  1. FIXED: Goal/Delta text alignment in oneLine mode
     (summaryColumn.goalDeltaLayout = "oneLine" ONLY - stacked mode is
     unaffected, unchanged). Previously the whole "Goal X  Delta Y"
     string was centered as one flowing block per row, so "Goal" and
     "Delta" both started at a different x-position on every row,
     depending on how wide that row's own numbers happened to be (e.g.
     "0.21" vs "416.9K" vs "133.16M"). Fixed by splitting Cell B into two
     left-aligned sub-columns - a Goal sub-column and a Delta
     sub-column - each sized globally to the widest "Goal ..." and
     widest "Delta ..." text found ANYWHERE in the matrix (not per-row),
     so "Goal" now starts at the same x on every row, and "Delta" starts
     at a second consistent x right after it. Flush against Cell B's own
     left edge using the existing rowPaddingH (same padding already
     applied to every other cell type, including monthly columns) rather
     than a new/separate padding value. Gap between the two sub-columns
     is a fixed 10px - deliberately not a format-pane property, per
     explicit request to keep it narrow and not expose it as a setting.
     If the outer Goal/Delta column shrinks under the existing
     shrink-to-fit cascade, both sub-columns shrink proportionally by
     the same factor so they still fit; if the column grows to absorb
     surplus width, both sub-columns stay at their natural widths
     unchanged and the extra space simply appears as blank space to the
     right of the Delta text - the gap itself never stretches.

v1.20.0.0 changes from v1.19.0.0:

  1. NEW: per-row Trend chart visibility toggle (object "rowLevelBehavior",
     property "kpiNshowChart", 25 slots, default TRUE - no visual change
     on upgrade). Lives alongside the existing per-row Behaviour toggles
     (popup polarity, summary mode, disable CF). When switched off for a
     given row, that row's Trend chart cell renders a plain grey
     background (#f2f2f2 - the same fixed shade used elsewhere for the
     no-goal state and alternate-row shading) with NO canvas element at
     all - not a hidden or blank canvas, the cell simply doesn't contain
     one. Only relevant when the global layout.showTrendChart is itself
     on; otherwise inert, same as every other Trend-chart-specific
     setting.

v1.19.0.0 changes from v1.18.0.0:

  1. FIXED: confirmed bug - the table element had width:100% alongside
     table-layout:fixed. Whenever the sum of computed column widths was
     less than the visual's actual box width, the browser proportionally
     STRETCHED every column (including Monthly, which should never move)
     to fill the leftover space - the root cause of Monthly columns
     visibly growing when the visual was widened. Fix: the table's real
     width is now set in JS to the EXACT sum of every computed column
     width, never a percentage - removing any leftover space for the
     browser to redistribute on its own. The measurement pass itself was
     also corrected to remove width:100% during table-layout:auto
     measurement too, since that same forced-width was inflating the
     "natural" measurements being taken, not just the final applied ones.

  2. NEW: surplus-width growth. When the visual is wider than the natural
     total (Label + Monthly*12 + Value + Chart, all at their natural/
     fixed sizes), the Summary column's Goal/Delta cell is now the ONE
     AND ONLY column that absorbs 100% of that leftover space, uncapped.
     Label, Monthly, Value, and Trend chart always stay pinned to their
     own natural or configured width regardless of how wide the visual
     is - only Goal/Delta grows. If the Summary column is off entirely,
     or just its Goal/Delta cell is off (showGoalDeltaColumn=false,
     Value becomes colspan=2), nothing absorbs the surplus - the table
     simply sits at its natural width with blank space to its right, by
     design (confirmed explicitly rather than assumed).

  3. CHANGED (defaults only, no new properties): trend chart defaults
     bumped for visibility, matched against a sibling visual's already-
     proven values using the same underlying drawSparkline() logic:
     layout.chartColumnWidth 90 -> 180, chartStyle.actualLineThickness
     1.5 -> 2, chartStyle.dataPointSize 2 -> 3, chartStyle.fillArea
     false -> true. Existing reports that never touched these four
     properties will pick up the new, more-visible defaults on upgrade;
     anyone who explicitly set their own values keeps them unaffected.

  4. BREAKING: "Section row height" (sectionHeaders.sectionRowHeight)
     REMOVED entirely. Section header row height is now purely a
     function of its content plus sectionPaddingV (v1.16.0.0) - same
     "no manual number, no floor-only confusion" philosophy as KPI rows.
     Root cause of the original complaint: CSS height on a table row is
     always a MINIMUM, never a hard size - a manual number smaller than
     the natural content need visibly did nothing, which read as "the
     control doesn't work." Removing it avoids that confusion entirely
     rather than documenting the floor-only caveat.

  5. BREAKING: "Row height" (layout.rowHeight) REMOVED entirely. KPI row
     height is now ALWAYS auto-equalized (every row unconditionally
     forced to match the tallest row's real rendered height) - there is
     no manual override left to skip that equalization. This also FIXES
     a confirmed bug: under the old manual mode, equalization was
     skipped entirely, so a goal-row (Cell B needs two lines, "Goal"/
     "Delta" stacked) and a no-goal-row (Cell B blank since v1.16.0.0)
     could end up at genuinely different heights, since the manual
     number is only ever a floor and nothing forced the taller row's
     real height onto the shorter one. rowPaddingV remains the one
     lever for influencing row height - raising it grows every row's
     natural content, and the (now-unconditional) equalize pass still
     keeps them all equal afterward.

  6. FIXED: confirmed bug - the hover popup's "flip above the cell"
     positioning (used when docking below would overflow the visual's
     visible viewport) computed its position as a subtraction
     (cellRect.top - tipH - 6), which could go negative whenever the
     popup was taller than the actual space available above the clicked
     row - clamped to 4px in that case, which could land the popup
     directly on top of the very row it was meant to clear. Confirmed
     happening on rows near the bottom of the matrix, where the popup
     (whose height grew from a 44px default font, doubled from the
     original 22px baseline in an earlier version) didn't have enough
     room above to avoid the clamp. Fix: instead of a calculated offset,
     the flip-above position now anchors to a real DOM boundary - the
     row immediately above the clicked one, docking the popup's BOTTOM
     edge flush against THAT row's own top edge (small gap). This makes
     it geometrically impossible for the popup to intrude into the
     clicked row (or the row above it) regardless of how tall the popup
     is. If there's no row above at all (the clicked row is the very
     first one), the column header row's own top edge is used as the
     fallback boundary instead.

v1.18.0.0 changes from v1.17.0.0:

  1. BREAKING: all manual column-width controls REMOVED (Option B, full
     commit, per conversation record). Removed properties: layout ->
     labelColumnWidth, periodColumnWidth, autoFitColumns; summaryColumn
     -> valueColumnWidth, goalDeltaColumnWidth. Any existing report with
     customized values on these five properties will have them silently
     dropped on upgrade - there is no manual sizing mode left to fall
     back to, and no toggle to turn auto-fit off. All drag-to-resize
     handles and the addResizeHandle() mechanism have been deleted from
     the code entirely.

  2. CHANGED: the KPI Label column is now fully protected in the
     auto-fit + shrink-to-fit calculation - it is NEVER part of the
     shrink group and NEVER wraps to a second line, regardless of how
     tight the visual gets. Only Value, Goal/Delta, and (as a last
     resort) the monthly columns shrink under pressure now - Label
     always renders at its full natural content width. Known
     consequence (accepted, flagged): if Label's natural width plus
     every other column already at its floor still doesn't fit the
     visual's box, there is no automatic escape - a horizontal
     scrollbar can reappear as the unavoidable physical fallback, and
     the only real fix at that point is widening the visual itself.

  3. FIXED: Goal and Delta text in the Summary column's Cell B is now
     centered (text-align:center) in BOTH the stacked and one-line
     layouts. Previously left-aligned by default, which left visible
     empty space on the right of shorter values inside a column sized
     to fit the widest content.

  4. NEW: "Site Name" data role - an unnumbered well shown at the very
     top of the Fields pane (above "(Well 1) Period Name"), for a
     single scalar text value shown in the previously-empty corner cell
     above the KPI Label column and to the left of the first period
     header. Bound as a plain text measure (typically
     SELECTEDVALUE('Site'[Name]) against a report-level Site slicer) -
     the matrix updates automatically whenever that slicer selection
     changes, since it's a live measure binding, not a static property.
     If multiple sites are selected (SELECTEDVALUE naturally returns
     BLANK() in that case) or nothing is bound at all, the corner cell
     renders empty - no error state, no fallback text. New styling
     properties added to the existing "Column headers" card:
     siteNameFontSize (default 14px), siteNameBold (default true),
     siteNameColor (default black), siteNameAlignment (default left) -
     kept independent of the existing fontSize/bold/color/alignment
     properties already used for the monthly period headers, since a
     site name may warrant different styling than "JAN-26" etc.

v1.17.0.0 changes from v1.16.0.0:

  1. CHANGED (autoFitColumns behaviour): monthly column width is now
     measured from the HEADER LABEL ONLY ("JAN-26" etc, .th-month cells)
     instead of the max of header + every monthly value in that column.
     This keeps monthly columns small and predictable regardless of how
     wide the underlying numbers get. Tradeoff (accepted, flagged): a
     monthly value wider than its header will now ellipsis-truncate
     inside its cell - it no longer stretches the column to fit.

  2. NEW: shrink-to-fit pass, folded into the existing "autoFitColumns"
     toggle (no new property - turning it off still rolls back
     everything from both this version and v1.16.0.0 in one step).
     Goal: never need a horizontal scrollbar under normal circumstances.
       - If Label + Value + Goal/Delta (natural) + Monthly*12 + Trend
         chart (if shown) already fits the visual's real available
         width, nothing shrinks - identical to v1.16.0.0's plain auto-fit.
       - If not: Label, Value, and Goal/Delta shrink PROPORTIONALLY
         together (one shared scale factor, so their relative sizes to
         each other are preserved) down to a 24px floor each. Monthly
         columns stay at their fixed header-based width through this
         stage - they do not shrink yet.
       - Only if 24px floors on all three of Label/Value/Goal-Delta
         still don't fit the visual (an extreme narrow-visual case) does
         the fixed monthly width itself shrink too - uniformly across
         all 12 columns, down to a 20px floor. This is the one deliberate
         exception to "monthly stays fixed", added specifically so a
         scrollbar is never needed even in a tightly-sized visual.
       - Font sizes are never touched at any stage, in either the normal
         or the extreme case - all of the squeeze is absorbed by column
         width and, where unavoidable, ellipsis truncation.
       - Available width is measured live from the visual's actual
         rendered box (this.target.clientWidth, minus the container's
         20px total horizontal padding) - this already excludes any
         vertical scrollbar's own width, so a tall matrix with many rows
         doesn't throw off the horizontal fit math.
     Known absolute limit (not expected to occur in normal report
     sizing): if the visual box is narrower than the sum of every column
     at its respective floor (24px x3 + 20px x12 + chart width), no
     amount of shrinking can eliminate the scrollbar - at that point
     every column is already at its floor and a scrollbar is the only
     physically possible fallback.

v1.16.0.0 changes from v1.15.0.0:

  1. NEW: "Section row padding" (object "sectionHeaders", property
     "sectionPaddingV", default 5px, no visual change on upgrade). Single
     symmetric top/bottom control for section header rows - horizontal
     padding stays hardcoded at 8px, unaffected. sectionRowHeight remains
     a separate, independently-managed fixed property - it does NOT
     auto-expand to fit whatever padding is set; increasing padding
     without also increasing sectionRowHeight will squeeze the available
     space for the section label before anything visibly clips.

  2. CHANGED: Summary column no-goal state no longer shows "NA" text.
     Both Cell A and Cell B now grey out to #f2f2f2 (the same fixed
     shade used for alternate-row shading) whenever a row is in the
     no-goal state (rowLevelNoGoal toggle, or the Goal measure is
     genuinely blank) - applied unconditionally, regardless of that
     row's own alternating shade or the alternateRowShading toggle.
     Cell A still shows its real Summary Actual value on the grey
     background (that data exists - only the Goal is missing). Cell B
     is fully blank - no text at all, since Goal/Delta genuinely don't
     exist for that row. BREAKING (cosmetic): any existing report with
     no-goal rows will visually change on upgrade - "NA" on white
     becomes blank on grey. No settings change is needed to get the new
     appearance; it applies automatically to any row already in the
     no-goal state.

  3. FIXED: Prior Month / Sum YTD / Average YTD now anchor to the real
     calendar prior month (today's month minus one, e.g. viewed in July
     2026 the anchor is June 2026) instead of the old behaviour, which
     silently walked backward through a row's own data to find whatever
     month it last reported and mislabeled that as "Prior Month" -
     confirmed bug, root-caused this version (a KPI that stopped
     reporting after March was showing March's value under a "Prior
     Month" label months later). Period columns are parsed as MMM-YY
     (always Jan-Dec of whichever year the report's Year slicer has
     selected) to find the column matching the real calendar prior
     month.
       - Prior Month: reads exactly that one column. Blank there is
         blank; NA is now treated identically to blank (no more "NA"
         text for this derived mode - both simply mean "no value").
       - Sum YTD: sums Jan (column 0) through the calendar prior-month
         column, inclusive - no longer the whole bound array. A blank
         month contributes 0 (mathematically a no-op for a sum -
         missing data is a data/user problem, not something the code
         should mask). NA is excluded exactly like blank.
       - Average YTD: same Jan-through-prior-month range, but blank and
         NA months are excluded from BOTH the numerator and the
         denominator - a 3-month range with one blank averages over 2
         real months, not 3.
       - If the calculated prior-month column doesn't exist at all in
         the bound period array (e.g. the Year slicer is set to a year
         that doesn't contain "today minus one month") - all three modes
         render blank for that row's Summary column, no fallback.
       - "custom" mode (legacy Wells 5-7 path) is UNCHANGED this version
         - it has an equivalent staleness issue in its own sumIdx lookup
           but was left alone, since Wells 5-7 are expected to be
           removed in a future version regardless (see Part K/L in the
           conversation record).

  4. NEW: "Auto-fit column widths" (object "layout", property
     "autoFitColumns", default TRUE this version). When ON, every
     column - KPI label, all 12 monthly columns, Summary Value, Summary
     Goal/Delta - is measured against its actual rendered content and
     resized on every render (data refresh, filter change, format pane
     edit - not a one-time fit). All 12 monthly columns are deliberately
     forced to ONE shared width (the max measurement across every month,
     every row, and the header labels) - they can never differ from
     each other. Label, Value, and Goal/Delta each get their own
     independent auto-fit width.
       - Manual width properties (labelColumnWidth, periodColumnWidth,
         summaryColumn.valueColumnWidth, summaryColumn.goalDeltaColumnWidth)
         are NEVER read or overwritten while this is ON - they sit
         untouched in the background. Turning autoFitColumns back OFF
         instantly restores whatever was manually set before, with zero
         data loss and no re-dragging required - this was a deliberate
         design requirement so the auto-fit trial can be rolled back on
         its own without affecting any of the other changes in this
         version.
       - All drag-to-resize handles (Label, Value, Goal/Delta column
         boundaries) are hidden entirely while autoFitColumns is ON - a
         manual drag would just be overwritten by the next render's
         auto-fit pass anyway.
       - Known interaction (flagged, not a bug): Power BI's own outer
         visual resize handles (on the report canvas) still work as
         normal, but narrowing the whole visual box does NOT shrink
         auto-fit's computed column widths - they're fixed pixel values,
         and the container uses overflow:auto, so a horizontal scrollbar
         appears instead of the content compressing to fit. If auto-fit
         computes a total width wider than however the visual is sized
         on the canvas, the fix is to widen the visual box (or turn
         autoFitColumns off and set widths manually), not to shrink it.
       - Trend chart column (chartColumnWidth) is NOT covered by this
         toggle - it has no existing drag handle and wasn't part of the
         four widths under discussion.
     BREAKING (cosmetic, expected): since this defaults to ON, any
     existing report's columns will very likely resize on upgrade to
     match their real content instead of whatever was previously
     manually set - by design, since the point of shipping this ON is
     to actually try it. The prior manual widths are fully preserved
     underneath and return immediately if autoFitColumns is switched
     back to OFF.

v1.15.0.0 changes from v1.14.0.0:

  1. NEW: global "Tag position" toggle (object "summaryColumn", property
     "tagPosition", enumeration "stacked" (default) / "left" / "right").
     Global only, same reasoning as goalDeltaLayout (v1.14.0.0) — row
     height consistency is a whole-matrix concern.
       - "stacked" (default): unchanged from all prior versions — Tag on
         its own line above the Value, existing reports render
         identically after upgrade.
       - "left": Tag renders to the left of Value, vertically centered
         (not baseline-aligned), separated by tagValueGap.
       - "right": Tag renders to the right of Value, same alignment/gap
         rule.
       - tagFontSize is NOT altered by this toggle in any mode — only
         the tag's position changes, never its size. No default change
         to tagFontSize this version.
       - This same toggle now ALSO governs the summary column's
         showGoalDeltaColumn=false (colspan=2) rendering path, replacing
         that path's previously-hardcoded "always inline, baseline,
         6px gap" behaviour with the same tagPosition-driven layout used
         everywhere else — one control instead of two independent ones.

  2. NEW: global numeric property "Tag/value gap" (object "summaryColumn",
     property "tagValueGap", default 8px). Only takes effect in
     tagPosition "left"/"right" modes — no effect on "stacked". Format
     pane numeric entry (typed, not drag) — no drag handle exists for
     this property; the existing valueColumnWidth drag handle on the
     Summary column boundary is unrelated and unchanged.

  BREAKING (flagged deliberately, confirmed acceptable): any existing
  report using showGoalDeltaColumn=false together with a non-empty
  per-row Summary Tag will visually change on upgrade — previously that
  state force-rendered Tag inline beside Value regardless of any
  setting; it now defaults to tagPosition="stacked" (Tag above Value)
  like every other state, which restores the taller two-line Cell A in
  that specific combination unless tagPosition is explicitly set to
  "left" or "right" post-upgrade. This was a deliberate choice (option 1
  of two discussed) in favour of one consistent global default over
  preserving the old state-specific hardcoded behaviour. All other
  combinations (showGoalDeltaColumn=true, or no Tag set) are unaffected
  and render identically to v1.14.0.0.

v1.14.0.0 changes from v1.13.0.0:

  1. NEW: global "Goal/Delta layout" toggle (object "summaryColumn",
     property "goalDeltaLayout", enumeration "stacked" (default) /
     "oneLine"). Global only, not per-row — one setting drives Cell B's
     internal layout for every row in the matrix, deliberately, since the
     problem being solved (inconsistent row heights when some rows'
     Goal/Delta content is taller than the rest of that row) is a
     whole-matrix concern, not a per-row one.
       - "stacked" (default): unchanged from v1.13.0.0 and earlier —
         Goal on its own line, Delta on its own line below it, existing
         reports render identically after upgrade.
       - "oneLine": Goal and Delta render side by side on a single line
         inside Cell B ("Goal 0.21  Delta -0.15"), same bold/colour
         rules as stacked mode (Delta value black-bold when favourable,
         #c0342f bold when unfavourable) — only the line arrangement
         changes. No abbreviation, no dropped labels.
       - Font size: still driven by the existing goalDeltaFontSize
         (default 20px) in both modes — no separate size property, no
         auto-shrink. If "Goal 0.21  Delta -0.15" doesn't fit within
         goalDeltaColumnWidth at that font size, it ellipses rather than
         wrapping or shrinking; width is managed via the existing
         drag-to-resize handle on that column, same as today.
       - NA / No-Goal state (rowLevelNoGoal, or Goal genuinely blank):
         completely unaffected by this toggle — still renders as a
         single centered "NA" in both layout modes.
       - Colour/contrast rule (shared Cell A/B background, forced
         black-bold-on-green / white-bold-on-red when a CF colour
         applies): unaffected by this toggle — identical in both modes.
     BREAKING: none. Additive property, defaults to "stacked" which is
     byte-for-byte the v1.13.0.0 rendering — no existing report's
     Summary column changes appearance on upgrade unless the toggle is
     switched to "oneLine".

v1.13.0.0 changes from v1.12.0.0:

  1. BREAKING - extended from 10 to 25 full-control KPI slots, to match a
     23-KPI real report with headroom to grow. This touches FOUR things
     together, deliberately kept in sync so the same positional-alignment
     gap diagnosed for "no CF"/"no goal" placeholder rows can't reopen at
     a higher row count:
       - Wells 2/3/4 data cap (dataViewMappings conditions): 20 -> 25.
       - Row level control - Decimals: kpi1-10 -> kpi1-25 (30 -> 75 props).
       - Row level control - Summary display: kpi1-10 -> kpi1-25
         (50 -> 125 props).
       - Row level control - Behaviour: kpi1-10 -> kpi1-25 (30 -> 75 props).
       - Section headers: s1-10 -> s1-25 (44 -> 104 props).
     BREAKING: any report with customized values on rows 1-10 for these
     five objects is UNAFFECTED (same object keys, same kpi1-10/s1-10
     property names, values carry forward normally) - this is additive,
     not a rename. Only rows 11-25 / sections 11-25 are new and start at
     defaults, since they didn't exist before.
     Known trade-off (flagged, not solved this version): Decimals,
     Summary display, and Behaviour are now significantly longer to
     scroll - Summary display alone is 125 flat properties in one card.
     This is the direct cost of full per-row control at this scale under
     the current capabilities.json + enumerateObjectInstances() format
     pane approach - a future Formatting Model migration (see the
     migration requirements discussed in the conversation record) could
     restructure this into 25 collapsible per-KPI sub-groups instead of
     one long list, but that's a separate, larger piece of work not
     attempted here.

  2. NEW: "Developer: show KPI numbers" toggle (object "layout", property
     "showKpiNumbers", default false). When on, prefixes each row's label
     with its exact format-pane slot number ("1. ", "2. ", etc.) at the
     same font size/weight/colour as the label itself - no separate
     styling control, this is a development aid only. The number shown
     is guaranteed to match the "KPI N" numbering in the Row level
     control cards 1:1, so binding/alignment mistakes (like the Wells
     2/3/4 positional-shift issue from v1.12) can be visually
     cross-checked against the format pane while building a matrix.

v1.12.0.0 changes from v1.11.1.0:

  1. NEW: per-row "disable conditional formatting" toggle (object
     "rowLevelBehavior", property "kpiXdisableCF", default false -
     colouring stays on for every row unless explicitly switched off).
     When on, Well 4's CF code is ignored entirely for that row's
     monthly cells (treated as null, same as a genuinely blank Well 4) -
     no background/font colouring applied regardless of what Well 4
     actually returns. For reference/diagnostic rows that reuse another
     row's CF measure (or any row you simply don't want painted) while
     still loading the full Wells 2/3/4 suite as usual.

  2. RENAMED: "Row level control - Behavior (polarity / summary mode)"
     is now "Row level control - Behaviour" (no parenthetical). Object
     key unchanged (rowLevelBehavior) - only the display name changed,
     so existing kpiXpopupPolarity/kpiXsummaryMode values are NOT reset
     by this rename alone (see item 4 for what IS reset this version).

  3. Wells 5/6/7 (summaryValues, summaryGoalValues, summaryCfValues)
     TEMPORARILY REMOVED from the field pane - this is a trial of the
     v1.11.0.0 JS-derived Summary approach (Prior Month / Sum YTD /
     Average YTD) as the primary path going forward. IMPORTANT: the
     underlying code for the "custom" Wells 5-7 path (summaries/
     summaryGoals/summaryCfs arrays, customSummaryIdx positional
     mapping, the whole isCustom branch) is UNCHANGED and NOT deleted -
     it's simply unreachable because the dataView can no longer carry
     those three roles. Re-enabling in a future version is a small,
     safe change (re-add the 3 dataRoles + their dataViewMappings
     entries) - nothing needs to be rebuilt from scratch.
       - Default kpiXsummaryMode flipped from "custom" to "priorMonth"
         (see rowCtrl() and the rowLevelBehavior enumerateObjectInstances
         case) specifically BECAUSE of this removal - with Wells 5-7
         gone from the field pane, any row left on "custom" (the old
         default) would show a silently blank Summary column, since
         there's nothing left to feed it. "priorMonth" ensures an
         untouched row still shows something meaningful (last reported
         month) rather than a blank that looks like a bug.
       - Any KPI that genuinely needs Custom mode (composite/ratio,
         Part K COPQ-style) cannot be built in this version - Wells 5-7
         simply aren't available to bind. Wait for Wells 5-7 to be
         re-enabled, or use a separate report page/visual instance on
         an earlier version for those specific KPIs in the meantime.

  4. Row padding MOVED from "KPI row headers" (object "kpiRowHeaders",
     properties "paddingV"/"paddingH") to "Layout" (object "layout",
     properties "rowPaddingV"/"rowPaddingH" - renamed in the process).
     BREAKING: existing reports with a custom row-header padding value
     from v1.10.1.0/v1.11.x will have that value RESET to the default
     (6/8) on upgrade - re-apply under Layout if it was customized.
       - More importantly, this padding is now APPLIED UNIFORMLY to
         ALL FOUR cell types in a row: KPI row header, monthly value
         cells, Summary Value cell, and Summary Goal/Delta cell. Before
         this version, only the row header had a controllable padding;
         monthly cells had none at all (relying on browser default with
         border-collapse:collapse, effectively near-zero), and both
         Summary cells had a hardcoded, unexposed padding:4px 6px. This
         was the root cause of rows looking inconsistent even though
         the existing auto-equalize-to-tallest-row logic was already
         forcing every row to the same total height - the WHITESPACE
         inside that shared height was distributed differently per row
         depending on which cell type happened to be tallest. One
         shared control now drives all four consistently.
       - VISIBLE CHANGE on upgrade even without touching the new
         control: monthly and Summary cells will show a few pixels of
         padding they didn't have before (or lose the hardcoded 4/6 in
         the Summary cells' case), since they now share the same 6/8
         default as the row header. The header itself is visually
         unchanged (same default it always had).

v1.11.1.0 changes from v1.11.0.0:

  1. NEW: global "Show Goal/Delta column" toggle (object "summaryColumn",
     property "showGoalDeltaColumn", default true - existing reports keep
     today's exact two-cell layout unless this is deliberately switched
     off). Applies to the WHOLE matrix, not per-row - deliberately
     simpler than a per-row auto-collapse, since every row in a given
     instance then uses the identical layout with no mixed-row colspan
     edge cases to reason about.
       - ON (default): unchanged. Two Summary cells per row exactly as
         before - Value/Tag cell, and Goal/Delta cell (or NA when no
         goal). Per-row Show Goal / Show Delta / No goal all behave
         exactly as they do today.
       - OFF: every row's Goal/Delta cell is removed and Cell A gets
         colspan="2", visually spanning both column tracks with no
         seam - the underlying col-value/col-goaldelta <col> tracks
         (and their drag-resize handles) are untouched, this only
         changes what's rendered on top of them. The Summary header
         label needed no change - it was already colspan="2" over the
         column tracks, not over individual row cells.
       - The Summary tag moves from stacked-above-value to inline
         beside the value (value + tag centered together as one unit,
         small left padding on the tag) ONLY while the column is off -
         this is what actually shrinks the row's minimum height, since
         Cell A drops from two stacked lines to one. The existing
         auto-equalize-to-tallest-row logic (Row height = 0) picks
         this up automatically, no changes needed there.
       - Per-row Show Goal / Show Delta / No goal settings are NEVER
         modified or lost while the column is off - they simply have
         nothing to act on. Flipping the toggle back on restores
         them immediately exactly as they were left.
       - The existing per-row "No goal" NA-display logic is UNCHANGED
         and only relevant while the column is on, per explicit
         decision - it was deliberately NOT folded into this toggle.
     Known limitation (documented, not fixed in this version): Show
     Goal/Delta and No goal remain fully visible and editable in the
     format pane even while this global toggle is off - they do not
     visually grey out to indicate they're currently inert. True
     conditional greying needs Power BI's newer Formatting Model API
     (getFormattingModel(), via the already-present but unused
     powerbi-visuals-utils-formattingmodel dependency) rather than the
     current capabilities.json + enumerateObjectInstances() approach,
     which has no concept of one property disabling another. Flagged
     as a candidate for a future dedicated Formatting Model migration
     (which would also resolve the "Format Pane" deprecation warning
     already showing in every pbiviz build log) rather than folded into
     this change.

v1.11.0.0 changes from v1.10.1.0 (MAJOR - format pane property names changed,
see breaking-change note below):

  1. NEW: per-row "Summary mode" control (object "rowLevelBehavior",
     property "kpiXsummaryMode"). Four options:
       - "custom" (default) - legacy behaviour, Wells 5/6/7 DAX authored
         per-row exactly as before. Required for composite/ratio KPIs
         (Part K COPQ-style) where the finished monthly ratio in Wells
         2/3 can't be un-baked back into raw numerator/denominator.
       - "priorMonth" - Summary Actual/Goal = last REPORTED (non-blank)
         month's value, read straight from this row's own Wells 2/3
         arrays. No Wells 5/6/7 DAX needed for this row at all.
       - "sumYtd" - Summary Actual/Goal = sum of all reported months in
         Wells 2/3 for this row.
       - "avgYtd" - Summary Actual/Goal = average of all reported months
         in Wells 2/3 for this row.
     Summary Delta is unchanged (Actual - Goal) regardless of mode.
     Summary CF (favourable/unfavourable colouring), for the three new
     modes, is derived from the SAME polarity mechanism the hover-popup
     swing colour already uses (manual per-row override, else
     auto-detected from the row's own Well 2/Well 4 history) - not from
     a separate CF measure, since the derived modes don't have one.
     New helpers: deriveSummaryFromArrays(), lastReportedIndex().

  2. FIXED (real root cause of the "TRIR Summary shows January" bug):
     Wells 5/6/7 (summaryValues, summaryGoalValues, summaryCfValues)
     were bound in the SAME categorical dataViewMapping, grouped by the
     same "period" category axis as the monthly wells - so DAX was being
     evaluated once PER PERIOD, never once as a true ungrouped total.
     The visual then hardcoded values[0] for all three reads, which is
     always the first category (January) regardless of which measure
     was bound. This affected EVERY KPI using the Summary column, not
     just TRIR - it was fully masked for KPIs whose Goal happens to be
     flat every month. Fix: read from the last REPORTED (non-blank)
     period's index instead of a hardcoded 0. Root cause confirmed via
     a throwaway DIAG measure and side-by-side card tests proving the
     DAX itself was correct in every context tested - the bug was
     entirely in this indexing, not in any measure.

  3. Wells 5/6/7 are now genuinely OPTIONAL per row (only "custom"-mode
     rows need to bind them). Because Power BI compacts bound measures
     into a plain positional array with no gaps, a new counter
     (customSummaryIdx) maps the k-th "custom"-mode row (in top-to-bottom
     matrix order) to the k-th entry in the Wells 5/6/7 arrays. Convention:
     bind Custom-mode rows' Wells 5/6/7 measures in the SAME top-to-bottom
     order those rows appear in the matrix - they do NOT need to be
     contiguous, just not reordered relative to each other.

  4. BREAKING CHANGE - row-level format pane consolidated from 8 cards
     down to 3, to cut down on pane sprawl now that a 9th control
     (Summary mode) was being added:
       - "Row level control - Decimals" (was 3 separate cards: Decimals
         mode, Custom decimals, Summary decimals)
       - "Row level control - Summary display" (was 4 separate cards:
         Summary tag, Value unit, No goal, Show Goal/Delta)
       - "Row level control - Behavior" (was Popup polarity, now also
         carries the new Summary mode control)
     Object names changed as part of this consolidation. Any report
     that already has per-row values set for Decimals mode, Custom
     decimals, Summary decimals, Summary tag, Value unit, No goal, Show
     Goal/Delta, or Popup polarity will have those reset to their
     defaults on upgrade to v1.11.0.0 - they are NOT auto-migrated.
     Re-apply per-row settings after upgrading if a report already has
     them customized.

  5. Row-header padding property (paddingV/paddingH under "kpiRowHeaders")
     from v1.10.1.0 carries forward unchanged - object name unchanged,
     no reset for that one.

v1.10.1.0 changes from v1.10.0.0:
  1. KPI row header padding exposed to the format pane. Previously
     hardcoded to "padding:6px 8px" with no control - now two numeric
     properties under KPI row headers:
       - Vertical padding (px)   -> object "kpiRowHeaders", "paddingV" (default 6)
       - Horizontal padding (px) -> object "kpiRowHeaders", "paddingH" (default 8)
     Defaults preserve the exact prior look; this was the next lever
     needed to shrink row height further when Summary column and Trend
     chart are both off (KPI row header is the tallest cell in that
     config, and font size + this padding were the only inputs).
  2. Fixed: hover popup Swing colour could contradict itself against the
     row's actual month-over-month direction. Root cause - the monthly
     CF code (Well 4) answers "is this month's actual currently meeting
     goal", which is a different question from "did the Prior->New
     movement itself improve". The old logic treated CF as authoritative
     for Swing colour whenever present, so a KPI that was genuinely
     improving but still behind target could never show a green Swing.
     Fix: Swing colour is now decided ONLY by polarity (More is More /
     Less is More), never by CF directly.
       - Manual per-row "Popup polarity" override is unchanged - if set,
         it always wins.
       - The default setting ("cf") no longer means "trust the CF code
         directly". It now means auto-detect the row's true polarity
         from its own history: scan every pair of reported months where
         the CF code flips between favourable/unfavourable and the
         actual also moved, and infer whether a higher actual lines up
         with favourable (-> More is More) or a lower actual does
         (-> Less is More). No clear signal in the row's history (e.g.
         it never scores differently, or the actual never moves when CF
         flips) -> falls back to neutral grey, same as before.
       - New helper: detectRowPolarity(actualVals, cfVals).
       - Arrow direction (up/down) is unchanged - it still reflects the
         literal numeric movement of the value, independent of polarity;
         only the colour judgement changes.

v1.10.0.0 changes from v1.9.0.0:
  1. Goal/Delta cell (Cell B only - Value/Tag cell Cell A is UNCHANGED,
     keeps its existing CF-driven coloured background) standardized to
     an always-white background (#ffffff), overriding even the
     alternating row-shading tint, for readability:
       - "Goal"/"Delta" labels: always black, bold
       - Goal value: always black (not bold)
       - NA text (no-goal state): always black
       - Delta value: black bold if favourable (Summary CF = 2), a
         dedicated #c0342f bold if unfavourable (Summary CF = 0) -
         deliberately NOT conditionalFormatting.negativeColor, which is
         a background colour (would be invisible as text on white)
     Alignment (centered Value+Tag from v1.6) is unchanged.
  2. Hover popup Swing colour: DELTA_GREEN strengthened from a muted
     olive (#2f5a0d) to a vivid, more visible green (#16A34A).

v1.9.0.0 changes from v1.8.0.0:
  1. Fixed trend chart not filling its column width. Root cause: the
     table uses table-layout:fixed + width:100%, which proportionally
     stretches all columns to fill the visual's full width when the
     colgroup total is less than that width - but a <canvas>'s drawing
     buffer is a fixed pixel size set at creation, so it doesn't stretch
     with its column like a <div> would, leaving dead space to its
     right. Fix: canvas no longer gets a fixed width attribute; after
     DOM insertion, each canvas's actual rendered clientWidth is
     measured and canvas.width is set to match BEFORE drawSparkline()
     runs, so the chart always fills however wide the column really
     rendered, not just the chartColumnWidth format-pane number.
  2. chartStyle.positiveLineColor default changed from green (#92D050)
     to BLACK (#000000). The "good" segment (CF code 2, polarity-aware
     via the row's CF DAX - "more is more" already baked in there) now
     renders black instead of green. negativeLineColor (red, CF code 0)
     is unchanged.

v1.8.0.0 changes from v1.7.0.0 — Trend chart column added:
  - NEW global toggle layout.showTrendChart (default OFF - visual is
    byte-for-byte unchanged unless switched on).
  - NEW layout.chartColumnWidth (default 90px).
  - NEW "Trend chart" format card (chartStyle), ported directly from the
    KPI Matrix + Trend source: showGoalLine, positiveLineColor,
    negativeLineColor, actualLineThickness, actualLineSmooth,
    goalLineColor, goalLineThickness, goalLineStyle, showDataPoints,
    dataPointSize, fillArea, showReportedMonthsOnly.
  - Ported drawSparkline() function verbatim (only change: source's
    `ctrl.noGoalMode` renamed to `ctrl.noGoal` to match this visual's
    RowCtrl field) - mini inline chart only, no click behaviour, no
    popup-on-click.
  - Well 3 (Monthly Goals) - previously parsed but unused, parity-only -
    now genuinely drives the chart's goal-line overlay when the toggle
    is on.
  - Trend column added to colgroup/header/totalCols/section-header
    colspan, all gated behind showTrendChart so nothing shifts when off.
  - Canvas per row drawn AFTER DOM insertion (needs real rendering
    context), BEFORE the row-height auto-equalize pass, so the chart's
    height is correctly included in that measurement.

IMPORTANT CORRECTION (documented for the record): an earlier design
pass in this session proposed click-to-navigate via Power BI's
Bookmarks API (`host.bookmarksManager`). That API does NOT exist on
the custom-visuals IVisualHost - confirmed by directly inspecting the
installed powerbi-visuals-api@~5.3.0 type definitions, which list only:
createSelectionIdBuilder, createSelectionManager, colorPalette,
persistProperties, applyJsonFilter, tooltipService, telemetry,
authenticationService, locale, hostCapabilities, launchUrl,
fetchMoreData, openModalDialog, instanceId, refreshHostData,
createLocalizationManager, storageService. bookmarksManager belongs to
the separate Power BI EMBEDDED JavaScript SDK (powerbi-client), used
for embedding reports in external web apps - NOT to code running
inside a custom visual. There is currently no public API for a custom
visual to enumerate report pages, apply a bookmark, or navigate within
the same report (confirmed via an open, still-unresolved GitHub issue
on microsoft/PowerBI-visuals-tools). The only real host capability in
this space is `host.launchUrl(url)`, which opens an external URL in a
NEW browser tab - not an in-place page switch. Given this, click
navigation was dropped entirely; the Trend column has no click
behaviour of any kind. If Microsoft adds a public navigation API in
the future, this is the natural place to revisit it.

v1.7.0.0 changes from v1.6.0.0:
  1. Hover popup: font size default doubled (22px -> 44px), and label
     text (Prior/New/Swing) now shares the SAME size as the value text
     - previously label was ~42% of value size, mismatched.
  2. Hover popup no longer only docks below the cell. It now checks
     against the visual's VISIBLE viewport (this.target's bounding
     rect, not just the scrollable container) and flips ABOVE the cell
     if docking below would overflow - keeps the popup fully visible
     while the triggering row stays visible too.
  3. NEW: per-row "Popup polarity" control (rowLevelPopupPolarity:
     kpi1popupPolarity...kpi10popupPolarity - "Use CF colour" (default) /
     "More is More" / "Less is More"). The monthly CF code remains
     authoritative for Swing's colour when present; this is a FALLBACK
     used only when that cell's CF value is genuinely blank, so rows
     without reliable monthly CF data don't default to flat grey.
  4. Resize handle for the Value column moved from an internal offset
     inside the merged "Summary" header (which visually clashed with
     the header text) to the December/Summary boundary - same function
     (drags summaryColumn.valueColumnWidth), cleaner position. The grey
     indicator line added in v1.6 was removed from ALL handles per
     explicit request - they're invisible hit areas again, relying on
     cursor:col-resize + sitting on already-visible natural boundaries
     for discoverability instead of a synthetic line.
  - Tooltip base padding/min-width increased (14px 18px / 260px) to
    comfortably fit the doubled font size.

v1.6.0.0 changes from v1.5.0.0:
  1. Container now has matching 10px padding on BOTH left and right
     (previously right-only).
  2. Summary column's Tag+Value block is now horizontally CENTERED
     (was left-aligned) - global behaviour, no toggle.
  3. Hover popup overhaul:
     - New global "Hover popup" format pane card with one control:
       Font size (default 22px, matches Monthly values default).
     - All popup text (Prior/New/Swing) is now bold and sized from this
       control - previously hardcoded at 9-11px, unreadable.
     - Prior/New now use popupDecimals() + fmtPopupNumber(): same
       decimal count the row's monthly cell would use (respecting
       decimalsMode/decimalsMonthly), WITHOUT K/M abbreviation, WITH
       comma thousand-separators (e.g. "1,823,387" not
       "1823387.4999999998"). Fixes the raw-float display bug.
     - Swing now shows an up/down arrow (▲/▼) ahead of the value,
       direction from the raw sign of the difference - independent of
       the CF-driven red/green colour, which is unchanged.
     - Monthly cell data attributes gained data-decmode/data-decmonthly
       so the popup can resolve the correct per-row decimal count
       client-side at hover time.
  4. Resize handles: widened hit area from 6px to 10px, added a subtle
     always-visible 2px indicator line (darkens further on hover) so
     the Value/Goal-Delta boundary handle and others are actually
     discoverable - previously fully invisible with no affordance.
  5. Row heights now default to AUTO-EQUALIZE: every KPI row measures
     its natural content height after render, takes the max across all
     rows, then applies that height to every row so they're all equal
     by default. layout.rowHeight is a manual override (>0 = fixed
     height for all rows instead of auto); default is 0 (auto). KPI
     rows are tagged with class="kpi-row" for this measurement pass.

v1.5.0.0 changes from v1.4.0.0:
  1. Section headers now have a per-section BACKGROUND colour
     (s1bgColor...s10bgColor, default white each) alongside the existing
     per-section text colour - previously only text colour existed.
  2. Container gets 10px right-hand padding so the table never butts
     directly against the visual's edge. Goal/Delta and Value text now
     has overflow:hidden + text-overflow:ellipsis as a safety net so
     content can never visually bleed past its own cell boundary.
  3. Restored a normal border between the Value and Goal/Delta cells
     (previously suppressed for the "seamless" look) - border-collapse
     merges Value's right edge and Goal/Delta's left edge into a single
     line, not a double one.
  4. Fixed a bug where the Value number lost its bold weight in the
     no-goal state - bold is now intrinsic to the value text always,
     independent of whether a CF colour is applied.
  5. Combined summaryColumn.goalFontSize + deltaFontSize into ONE
     property (goalDeltaFontSize, default 20px). The no-goal "NA" text
     now uses this same property instead of a hardcoded 12px.
  6. (Discussion only, no code change) - confirmed the Summary column
     has no automatic link to monthly Actual/NA state; propagating "this
     month is NA therefore Summary is NA" must be handled in the Summary
     DAX measures themselves.
  7. NEW: drag-to-resize with 3 handles - KPI row header (label) column,
     Value column, and Goal/Delta column. Each handle drags the
     corresponding <col> element live during mousemove, then on mouseup
     calls host.persistProperties() to write the final width into the
     SAME property the manual numeric format-pane control edits
     (layout.labelColumnWidth, summaryColumn.valueColumnWidth,
     summaryColumn.goalDeltaColumnWidth) - dragging and typing a number
     always stay in sync since they're the same underlying property.
     Requires storing options.host (IVisualHost) in the constructor.
  - layout.summaryColumnWidth REMOVED (superseded by the two independent
    valueColumnWidth / goalDeltaColumnWidth properties, needed for the
    two columns to be independently drag-resizable).

v1.4.0.0 changes from v1.3.0.0:
  - Summary column restructured into TWO real <td> cells (Cell A: Tag +
    Actual value, Cell B: Goal above Delta) instead of one cell with an
    internal flex/grid split. The seam between them has NO border on
    either side (Cell A: border-right:none, Cell B: border-left:none) so
    it reads as one solid block while being two independent cells.
  - Backgrounds ALWAYS match between Cell A and Cell B - single shared
    colour computed once per row, applied to both.
  - Contrast rule: when a CF colour IS applied, text is forced BLACK BOLD
    on green / WHITE BOLD on red, uniformly across both cells (this is
    why matching backgrounds matter - the rule only makes sense if both
    cells share the same colour).
  - New per-row "No Goal" toggle (rowLevelNoGoal: kpi1noGoal...
    kpi10noGoal, default false) in Row Level Control. When ON, OR when
    the Goal measure is genuinely blank for that row, BOTH cells drop to
    a plain/uncoloured background: Cell A shows the plain value with no
    forced colour/bold, Cell B shows a single centered "NA" instead of
    stacked Goal/Delta lines.
  - conditionalFormatting.negativeFontColor default changed from black
    to WHITE (#FFFFFF) to match the new contrast rule out of the box.
  - Removed summaryColumn.goalColor and summaryColumn.deltaBold - these
    per-element colour/bold overrides are superseded by the shared
    contrast rule (both cells now always take the same forced colour).
  - colgroup/header updated: Summary header cell now spans 2 columns
    (colspan=2), with independent widths for the Value cell
    (valueColumnWidth) and the Goal/Delta cell (remaining width from
    summaryColumnWidth).

v1.3.0.0 changes from v1.2.0.0:
  - KPI row headers default to 26px, Arial, bold (was 12px).
  - Summary column Tag+Value block is now a FIXED-WIDTH first column
    (CSS grid, default 75px, "Value column width" property) rather than
    a flex row sized to content. This anchors Goal/Delta to the same
    left edge on every row regardless of how wide the number is (e.g.
    "923.0K" vs "0.13" no longer push Goal/Delta to different
    x-positions down the matrix).
  - Section headers: height and font (size/family/bold) are now GLOBAL
    settings (sectionRowHeight default 28px, sectionFontSize/
    sectionFontFamily/sectionBold apply to every section header row).
    Colour is now PER-SECTION (s1color...s10color, default #D64550 each,
    individually overridable) instead of one global sectionColor.

v1.2.0.0 changes from v1.1.0.0 (THE FORMAT PANE FIX):
  - Added the missing public enumerateObjectInstances() method. In the
    classic (capabilities.json objects) format pane model, this method is
    REQUIRED for the "Visual" tab to appear at all — objects defined in
    capabilities.json alone are not enough. Power BI calls it once per
    object name and the visual must return current property values with
    defaults; without it the Visual tab is suppressed entirely and only
    "General" shows. This was the root cause of the missing format
    controls in v1.0/v1.1 testing.
  - Added lastDataView field (stored each update()) so the pane shows
    current values, not just defaults.
  - Added the style/visual.less import to visual.ts (matches the proven
    source's import pattern).
  - NOTE: the pbiviz build-time notice "Format Pane — please update the
    visual" refers to the NEW Format Pane API (getFormattingModel) and is
    also emitted for the proven working visuals — it is advisory and does
    not affect the classic pane working.


v1.1.0.0 changes from v1.0.0.0:
  - Wells realigned to the EXACT old standard (Card + Trend / Matrix +
    Trend) numbering so the same global measure sets map identically
    across all three visuals:
      W1 Period Name, W2 Monthly Actuals, W3 Monthly Goals,
      W4 Monthly Conditional Formatting, W5 Summary Actuals,
      W6 Summary Goals, W7 Summary Conditional Formatting.
  - Summary Delta is NOT a well (removed) - computed internally as
    (Summary Actual - Summary Goal), exact same logic/formatting as the
    proven source's fmtDelta(), coloured entirely by the Summary CF code
    (2=DELTA_GREEN #2f5a0d, 0=negative font colour, else DELTA_NEUTRAL
    #9a9a94) - never by the raw sign of the difference.
  - Monthly hover popup's Swing line colour now driven by the CURRENT
    month's own CF code (Well 4), same 2/0/else convention as Delta -
    no per-row polarity/arrowMode setting needed anywhere in this visual.
  - Well 3 (Monthly Goals) is parsed but intentionally unused in
    rendering - present purely so existing global Goal measures map the
    same way across all three visuols in the family.
  - Monthly value cells and Summary column main value both default to
    22px font size (new "Monthly values" format pane card + existing
    Summary column card). Goal/Delta stay at their smaller defaults.
  - Font family properties use the dropdown-picker schema type
    ("formatting": {"fontFamily": true}) rather than a free-text box, per
    explicit request for full dropdown control.
  - pbiviz.json cleaned to match the proven visuals' minimal structure
    exactly (externalJS: [], no redundant top-level version/
    stringResources keys) to rule out structural differences as a cause
    of the missing Format-pane "Visual" tab seen in v1.0.0.0 testing.

Build environment: Node.js v22, npm v10, pbiviz tools v7.1.0
Rebuild steps:
  1. cd kpiMatrixGrid
  2. npm install powerbi-visuals-api --save
  3. pbiviz package
  4. Embed icon as base64 in built .pbiviz -> content.iconBase64
     (pbiviz stores it as a path reference only otherwise)

Identity:
  Display name : KPI Matrix Grid by Baztec
  Class        : KPIMatrixGridVisual
  GUID         : kpiMatrixGridVisual2026AABB   (never change — preserves field mappings on reimport)
  Version      : 1.0.0.0

Field wells (categorical dataView — proven pattern from KPI Matrix + Trend):
  Well 1: Period Name             (category)
  Well 2: KPI Actual Values        (measure, up to 20 — one per KPI row)
  Well 3: Conditional Format 0/2/99 (measure, parallel to Well 2)
  Well 4: Summary Values           (measure, parallel — Summary column number)
  Well 5: Summary Goal Values      (measure, parallel — Summary column Goal)
  Well 6: Summary Delta Values     (measure, parallel — Summary column Delta)
  Well 7: Summary Conditional Format (measure, parallel — Summary column colour)

Key design decisions (see src/visual.ts comments for detail):
  - Flat, square-cell conditional formatting everywhere — no pill/rounded
    shape anywhere, monthly or summary.
  - No trend chart, no arrow/chip glyph.
  - Hover popup on monthly cells: anchored bottom-center of the cell,
    docks below (flips above if no room), shows Prior/New/Swing — same
    content pattern as the Card + Trend visual's tooltip, just re-anchored.
  - Summary column: tag (e.g. AVG/MTD) stacked directly above the value
    in normal flow, Goal/Delta to the right, single line, white-space:
    nowrap throughout so it never wraps regardless of row height.
  - Number formatting: fmtStandard() reused from Card + Trend source
    (M:2dp / K:1dp / whole:0dp). Per-row decimalsMode (auto/standard/
    custom) and per-row valueUnit ($ prefix / % suffix / blank) both
    apply uniformly to monthly + summary + goal + delta. Unit sizing is
    NOT independent — it renders at whatever font size the Monthly
    column value font is set to.
  - NA handling: true blank (null/empty) renders as an empty cell.
    A literal non-numeric value in the source data (e.g. "NA") renders
    as the text "NA" — these two cases are deliberately distinguished
    (see parseCell()), unlike the Card + Trend source's toNum() which
    collapses both into null.
  - Row-level control grouped into format-pane cards BY CONTROL TYPE
    (Decimals mode / Custom decimals / Summary decimals / Summary tag /
    Value unit / Show Goal-Delta) rather than by KPI — keeps each card a
    short scannable list across all KPIs instead of one long repeated
    block per KPI.
  - Bold KPI row divider (default on, 2pt, black) drawn under each
    complete KPI row, separate from the standard 1pt gridlines (also
    default on, black).
  - Section headers: s1–s10 position/label pattern, same as Card + Trend.

Known open items / notes for next session:
  - Polarity (More is More / Less is More) is not modelled per-row for
    the hover popup's Swing colour — currently assumes "less is better"
    for all rows. Flag if any KPI needs the opposite polarity.
  - periodColumnWidth may need manual widening per-report when KPIs use
    the $ unit, since "$469.2K" is visually wider than "4.25" — font
    size intentionally stays fixed/consistent rather than auto-shrinking.
