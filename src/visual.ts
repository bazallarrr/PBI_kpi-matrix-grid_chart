"use strict";

import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import DataView = powerbi.DataView;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualSettingsModel } from "./settings";

import "./../style/visual.less";

// ---- KPI Matrix Grid by Baztec -------------------------------------------
// Flat, square-cell KPI matrix. No trend chart, no chip/arrow glyph, no
// pill-shaped conditional formatting anywhere. Dedicated parallel wells
// drive monthly + summary cell colour directly (no "Cell elements" fx).
//
// Field wells (categorical dataView - EXACT old standard well numbering,
// shared across Card + Trend / Matrix + Trend / Matrix Grid so the same
// global measure sets map identically everywhere):
//   Well 1: period            (category, Period Name column headers)
//   Well 2: actualValues       (measure, up to 20 - one per KPI row)
//   Well 3: goalValues         (measure, parallel - unused in this grid's
//                               rendering, kept for measure-set parity)
//   Well 4: cfValues           (measure, parallel - 0/2/99)
//   Well 5: summaryValues      (measure, parallel - Summary column number)
//   Well 6: summaryGoalValues  (measure, parallel - Summary column Goal)
//   Well 7: summaryCfValues    (measure, parallel - Summary column colour)
// Summary Delta is NOT a well - computed internally as
// (Summary Actual - Summary Goal), same as the proven source, coloured
// entirely by the Summary CF code (never by the raw sign of the diff).
// ----------------------------------------------------------------------

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function getProp(objects: any, group: string, prop: string, def: any): any {
    try {
        const v = objects && objects[group] && objects[group][prop];
        return (v !== undefined && v !== null) ? v : def;
    } catch { return def; }
}
function getColorProp(objects: any, group: string, prop: string, def: string): string {
    try {
        const v = objects && objects[group] && objects[group][prop];
        return (v && v.solid && v.solid.color) ? v.solid.color : def;
    } catch { return def; }
}

// ---- value parsing: distinguishes true blank from a literal non-numeric
// value (e.g. "NA") in the source data. Collapsing both into null would
// hide the difference - this keeps them apart so the renderer can show
// "" for one and "NA" for the other. ------------------------------------
// v1.29.15.0: added isNone, a THIRD distinct state alongside isNA - some
// DAX measures (the "-1 = None" sentinel convention) return the literal
// text "None" to mean "a real, confirmed result of nothing outstanding",
// a different concept from isNA ("not entered / explicitly NA"). Before
// this change, parseCell bucketed ANY non-numeric text into isNA, so
// "None" was silently mislabeled as "NA" on screen - correct in the DAX,
// wrong in the render. isNone is checked as its own literal match, ahead
// of the generic isNaN(Number(raw)) fallback, so it can never collide
// with a genuine "NA" entry or an actual numeric result.
interface ParsedCell { numeric: number | null; isNA: boolean; isNone: boolean; }
function parseCell(raw: any): ParsedCell {
    if (raw == null || raw === "") return { numeric: null, isNA: false, isNone: false };
    if (raw === "None") return { numeric: null, isNA: false, isNone: true };
    const n = Number(raw);
    if (isNaN(n)) return { numeric: null, isNA: true, isNone: false };
    return { numeric: n, isNA: false, isNone: false };
}

// ---- number formatting ------------------------------------------------
// fmtStandard: flat, non-negotiable scale - M always 2dp, K always 1dp,
// whole numbers always 0dp. No sliding sub-1000 scale, no per-value
// override - avoids "custom decimals on M also forcing decimals on K".
function fmtStandard(value: number): string {
    const a = Math.abs(value);
    if (a >= 1e6) return (value / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return (value / 1e3).toFixed(1) + "K";
    return value.toFixed(0);
}
function fmt(value: number, decimals: number): string {
    const a = Math.abs(value);
    if (decimals >= 0) {
        if (a >= 1e6) return (value / 1e6).toFixed(decimals) + "M";
        if (a >= 1e3) return (value / 1e3).toFixed(decimals) + "K";
        return value.toFixed(decimals);
    }
    // auto (-1)
    // v1.23.0.0: >=100M gets 1 decimal instead of 2, specifically to
    // control the rendered width of very large numbers in monthly/summary
    // cells. >=1M and <100M is unchanged at 2 decimals. Only this "auto"
    // branch is affected - custom mode (explicit per-row decimals, just
    // above) and fmtStandard() (a deliberately flat, non-negotiable mode)
    // are both untouched, as is the hover popup's own formatting
    // (popupDecimals()/fmtSwing()).
    if (a >= 1e8) return (value / 1e6).toFixed(1) + "M";
    if (a >= 1e6) return (value / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return (value / 1e3).toFixed(1) + "K";
    if (a < 10) return value.toFixed(2);
    if (a < 100) return value.toFixed(1);
    return value.toFixed(0);
}
function fmtFull(value: number): string {
    // full, unrounded precision for the hover popup
    return String(value);
}
// Popup-specific: same decimal count the row's monthly cell would use
// (respecting decimalsMode/decimalsMonthly), but WITHOUT K/M abbreviation,
// and with comma thousand-separators for readability.
function popupDecimals(value: number, ctrl: RowCtrl): number {
    if (ctrl.decimalsMode === "custom") return ctrl.decimalsMonthly >= 0 ? ctrl.decimalsMonthly : 0;
    const a = Math.abs(value);
    if (a >= 1e6) return 2;
    if (a >= 1e3) return 1;
    if (ctrl.decimalsMode === "auto") {
        if (a < 10) return 2;
        if (a < 100) return 1;
        return 0;
    }
    return 0; // standard mode, whole numbers under 1000
}
function fmtPopupNumber(value: number, decimals: number): string {
    return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtSwing(value: number): string {
    const sign = value > 0 ? "+" : "";
    const a = Math.abs(value);
    if (a >= 1e6) return sign + (value / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return sign + (value / 1e3).toFixed(1) + "K";
    return sign + value.toFixed(2);
}
function applyUnit(text: string, unit: string): string {
    if (unit === "dollar") return "$" + text;
    if (unit === "percent") return text + "%";
    return text;
}
// v1.22.0.0: splits a formatted display string into its $ prefix (if any),
// the pure numeric core (digits/decimal/minus - what actually needs to
// align across rows), and a trailing suffix (K/M from fmt()'s
// abbreviation, and/or % from applyUnit). Used only for Summary Cell A's
// left/right tagPosition digit-alignment layout - stacked mode doesn't
// need this at all. The core is what gets a globally-fixed width and
// right-aligned; prefix/suffix sit outside that alignment, exactly as
// requested ("$ or % outside the aligned digits").
function splitValueDisplay(text: string): { prefix: string; core: string; suffix: string } {
    let rest = text;
    let prefix = "";
    if (rest.charAt(0) === "$") { prefix = "$"; rest = rest.slice(1); }
    const numMatch = /^-?[\d,]*\.?\d+/.exec(rest);
    if (numMatch) {
        const core = numMatch[0];
        const suffix = rest.slice(core.length);
        return { prefix, core, suffix };
    }
    return { prefix: "", core: rest, suffix: "" };
}
function fmtDelta(value: number, decimals: number): string {
    return (value > 0 ? "+" : "") + fmt(value, decimals);
}
const DELTA_GREEN = "#16A34A";
const DELTA_NEUTRAL = "#9a9a94";

// ---- v1.11.0.0: Summary mode - JS-derived Summary Actual/Goal ----------
// For rows set to Prior Month / Sum YTD / Average YTD, the Summary
// Actual and Summary Goal are computed directly from this row's own
// Wells 2/3 arrays instead of querying separate Wells 5/6 measures.
// This only works for genuinely additive or already-self-cumulative
// monthly values (see conversation record) - composite/ratio KPIs must
// stay on "custom" mode with real Wells 5-7 DAX.
interface DerivedSummary {
    actual: number | null;
    actualIsNA: boolean;
    goal: number | null;
    goalIsNA: boolean;
}
function lastReportedIndex(vals: any[]): number {
    for (let m = vals.length - 1; m >= 0; m--) {
        const pc = parseCell(vals[m]);
        if (pc.numeric != null || pc.isNA || pc.isNone) return m;
    }
    return -1;
}

// v1.16.0.0: Prior Month / Sum YTD / Average YTD now anchor to the actual
// calendar prior month (today's month minus one), NOT to "whichever month
// this row last happened to report" - the old lastReportedIndex-based
// approach silently walked backward through stale data and mislabeled
// whatever it found as "prior month", which was the root cause of a
// confirmed bug (see conversation record: KPI showing March's value under
// a "Prior Month" label in July). Bound period columns are always
// "MMM-YY" for the Year-slicer-selected year (Jan-Dec of that year).
const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function parsePeriodLabel(label: string): { month: number; year: number } | null {
    const m = /^([A-Za-z]{3})-(\d{2})$/.exec((label || "").trim());
    if (!m) return null;
    const monthIdx = MONTH_ABBR.indexOf(m[1].toUpperCase());
    if (monthIdx < 0) return null;
    return { month: monthIdx, year: 2000 + parseInt(m[2], 10) };
}
// Finds the column index whose parsed month+year equals the real calendar
// prior month (computed from the actual render-time date). Returns -1 if
// no bound column matches - e.g. the report's Year slicer is set to a year
// that doesn't contain the current calendar's prior month at all. Callers
// treat -1 as "blank, no fallback" for every derived Summary mode.
function findPriorMonthIndex(periods: string[]): number {
    const now = new Date();
    let month = now.getMonth() - 1;
    let year = now.getFullYear();
    if (month < 0) { month = 11; year -= 1; }
    for (let i = 0; i < periods.length; i++) {
        const p = parsePeriodLabel(periods[i]);
        if (p && p.month === month && p.year === year) return i;
    }
    return -1;
}
function deriveSummaryFromArrays(mode: string, actualVals: any[], goalVals: any[], priorMonthIdx: number): DerivedSummary {
    if (priorMonthIdx < 0) {
        // No bound column matches the real calendar prior month (e.g.
        // viewing a past year via the Year slicer) - blank for every
        // derived mode, no fallback to older/other data.
        return { actual: null, actualIsNA: false, goal: null, goalIsNA: false };
    }
    if (mode === "priorMonth") {
        // Read exactly the calendar prior-month column. Blank there stays
        // blank; NA is treated identically to blank (never shown as "NA"
        // text for these derived modes) - both simply mean "no value".
        const a = parseCell(actualVals[priorMonthIdx]);
        const g = parseCell(goalVals[priorMonthIdx]);
        return { actual: a.numeric, actualIsNA: false, goal: g.numeric, goalIsNA: false };
    }
    // Sum YTD / Average YTD: aggregate Jan (index 0) through the calendar
    // prior-month column, inclusive - never the whole bound array. A blank
    // month contributes 0 to the sum (mathematically a no-op either way -
    // missing data is a user/data problem, not something to mask). An NA
    // month is treated identically to blank: excluded, never counted. For
    // the average, both blank and NA months are excluded from BOTH the
    // numerator and the denominator, so a 3-month range with one blank
    // averages over 2 real months, not 3.
    const sumOrAvg = (vals: any[]): number | null => {
        let sum = 0, count = 0, anyNumeric = false;
        for (let m = 0; m <= priorMonthIdx; m++) {
            const pc = parseCell(vals[m]);
            if (pc.numeric != null) { sum += pc.numeric; count++; anyNumeric = true; }
        }
        if (!anyNumeric) return null;
        return mode === "avgYtd" ? sum / count : sum;
    };
    const a = sumOrAvg(actualVals);
    const g = sumOrAvg(goalVals);
    return { actual: a, actualIsNA: false, goal: g, goalIsNA: false };
}


// The monthly CF code (Well 4) tells you whether THIS month's actual is
// currently meeting goal - it says nothing about whether a month-over-month
// change is a good or bad direction. Those are different questions, so CF
// must never be used directly to colour the Prior->New swing.
// When the row's manual "Popup polarity" control is left on its default
// ("cf"), we infer the row's true polarity once from its own history:
// scan every pair of consecutive reported months where the CF code flips
// between favourable (2) and unfavourable (0) and the actual also moved,
// and see whether a higher actual lines up with "favourable" (More is
// More) or a lower actual does (Less is More). If the row never shows a
// clear signal (e.g. always scores the same, or the actual never moves
// when CF flips), we fall back to neutral, matching prior no-signal
// behaviour.
function detectRowPolarity(actualVals: any[], cfVals: any[]): "moreIsMore" | "lessIsMore" | "neutral" {
    let moreVotes = 0;
    let lessVotes = 0;
    const n = Math.min(actualVals.length, cfVals.length);
    const parsedActual: (number | null)[] = [];
    const parsedCf: (number | null)[] = [];
    for (let i = 0; i < n; i++) {
        parsedActual.push(parseCell(actualVals[i]).numeric);
        parsedCf.push(parseCell(cfVals[i]).numeric);
    }
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const a1 = parsedActual[i], a2 = parsedActual[j];
            const c1 = parsedCf[i], c2 = parsedCf[j];
            if (a1 == null || a2 == null || c1 == null || c2 == null) continue;
            if (a1 === a2) continue;
            // Only draw a signal from a genuine favourable/unfavourable flip.
            const favourable1 = c1 === 2, unfavourable1 = c1 === 0;
            const favourable2 = c2 === 2, unfavourable2 = c2 === 0;
            if (favourable1 && unfavourable2) {
                if (a1 > a2) moreVotes++; else if (a1 < a2) lessVotes++;
            } else if (unfavourable1 && favourable2) {
                if (a2 > a1) moreVotes++; else if (a2 < a1) lessVotes++;
            }
        }
    }
    if (moreVotes === 0 && lessVotes === 0) return "neutral";
    return moreVotes >= lessVotes ? "moreIsMore" : "lessIsMore";
}

// ---- per-row (per-KPI) format pane control -----------------------------
interface RowCtrl {
    decimalsMode: string;
    decimalsMonthly: number;
    decimalsSummary: number;
    summaryTag: string;
    valueUnit: string;
    showGoal: boolean;
    // v1.22.0.0: per-row toggle to blank Cell A's Actual value text.
    // Suppresses DISPLAY only - the underlying Summary Actual number keeps
    // driving Summary CF colouring and the Delta calculation exactly as
    // before; only the visible text in Cell A is blanked.
    showActual: boolean;
    showDelta: boolean;
    noGoal: boolean;
    popupPolarity: string;
    // v1.11.0.0: Summary mode - when not "custom", Wells 5-7 are ignored
    // for this row and the Summary Actual/Goal/CF are derived in JS
    // directly from this row's own Wells 2/3/4 arrays. See
    // deriveSummaryFromArrays().
    summaryMode: string;
    // v1.12.0.0: Wells 5-7 are temporarily hidden from the field pane
    // while this JS-derived approach is being trialled (code kept in
    // place, not deleted - see README). Default flipped from "custom"
    // to "priorMonth" so any row left untouched still shows something
    // instead of a silent blank Summary column now that Wells 5-7 can't
    // be bound at all.
    // v1.12.0.0: per-row conditional formatting disable - suppresses
    // Well 4 background/font colouring for this row's monthly cells
    // regardless of what Well 4 returns. For reference/diagnostic rows
    // that reuse another row's CF measure but shouldn't be painted.
    disableCF: boolean;
    // v1.20.0.0: per-row Trend chart visibility - when false, this row's
    // Trend chart cell renders a plain grey background (#f2f2f2, the same
    // shade used elsewhere for no-goal/alternate-row shading) instead of
    // the sparkline canvas. Only relevant when the global
    // layout.showTrendChart is itself on - otherwise inert.
    showChart: boolean;
}
function rowCtrl(objects: any, k: number): RowCtrl {
    const n = k + 1;
    return {
        // v1.29.7.0: all 13 per-row properties now live under ONE
        // capabilities.json object ("rowLevelControl"), consolidated
        // from the previous three (rowLevelDecimals,
        // rowLevelSummaryDisplay, rowLevelBehavior) - property NAMES are
        // unchanged, only the object they're stored under changed.
        // BREAKING: any report with values already saved under the
        // three old object names will have them reset to default on
        // upgrade, since a saved value is keyed to (object, property)
        // together, not property name alone.
        decimalsMode: getProp(objects, "rowLevelControl", `kpi${n}decimalsMode`, "auto"),
        decimalsMonthly: Number(getProp(objects, "rowLevelControl", `kpi${n}decimalsMonthly`, -1)),
        decimalsSummary: Number(getProp(objects, "rowLevelControl", `kpi${n}decimalsSummary`, -1)),
        summaryTag: getProp(objects, "rowLevelControl", `kpi${n}summaryTag`, ""),
        valueUnit: getProp(objects, "rowLevelControl", `kpi${n}valueUnit`, "none"),
        showGoal: !!getProp(objects, "rowLevelControl", `kpi${n}showGoal`, true),
        showActual: !!getProp(objects, "rowLevelControl", `kpi${n}showActual`, true),
        showDelta: !!getProp(objects, "rowLevelControl", `kpi${n}showDelta`, true),
        noGoal: !!getProp(objects, "rowLevelControl", `kpi${n}noGoal`, false),
        popupPolarity: getProp(objects, "rowLevelControl", `kpi${n}popupPolarity`, "cf"),
        summaryMode: getProp(objects, "rowLevelControl", `kpi${n}summaryMode`, "priorMonth"),
        disableCF: !!getProp(objects, "rowLevelControl", `kpi${n}disableCF`, false),
        showChart: !!getProp(objects, "rowLevelControl", `kpi${n}showChart`, true)
    };
}

// formats a parsed cell for monthly display: "" for blank, "NA" for literal
// non-numeric, else the scaled/unit-wrapped number.
function displayMonthly(cell: ParsedCell, ctrl: RowCtrl): string {
    if (cell.isNone) return "None";
    if (cell.isNA) return "NA";
    if (cell.numeric == null) return "";
    const decimals = ctrl.decimalsMode === "custom" ? ctrl.decimalsMonthly : (ctrl.decimalsMode === "standard" ? -2 : -1);
    const body = decimals === -2 ? fmtStandard(cell.numeric) : fmt(cell.numeric, decimals);
    return applyUnit(body, ctrl.valueUnit);
}
function displaySummary(cell: ParsedCell, ctrl: RowCtrl): string {
    if (cell.isNone) return "None";
    if (cell.isNA) return "NA";
    if (cell.numeric == null) return "";
    const body = fmt(cell.numeric, ctrl.decimalsSummary);
    return applyUnit(body, ctrl.valueUnit);
}

// ---- trend sparkline (ported from KPI Matrix + Trend source, unchanged
// drawing behaviour - noGoalMode renamed to noGoal to match this visual's
// RowCtrl field). Mini chart only - no click/popup behaviour. ------------
function drawSparkline(canvas: HTMLCanvasElement, actuals: (number | null)[],
                       goals: (number | null)[], cfs: (number | null)[], s: any, ctrl: RowCtrl): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const plotW = W - 6 - 6;
    const plotH = H - 4 - 12;
    const present = actuals.map((v, i) => v != null ? i : -1).filter(i => i >= 0);
    const lastReported = present.length > 0 ? present[present.length - 1] : -1;
    const series = s.showReportedMonthsOnly ? actuals.map((v, i) => i <= lastReported ? v : null) : actuals;

    const pool: number[] = [];
    series.forEach(v => { if (v != null) pool.push(v); });
    goals.forEach(v => { if (v != null) pool.push(v); });
    if (pool.length === 0) { ctx.clearRect(0, 0, W, H); return; }

    const min = Math.min(...pool);
    const range = (Math.max(...pool) - min) || 1;
    const n = Math.max(1, actuals.length - 1);
    const X = (i: number) => 6 + i / n * plotW;
    const Y = (v: number) => 4 + plotH - (v - min) / range * plotH * 0.82 - 0.05 * plotH;

    ctx.clearRect(0, 0, W, H);

    const pts = series.map((v, i) => v != null ? i : -1).filter(i => i >= 0);
    if (s.fillArea && pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(X(pts[0]), Y(series[pts[0]] as number));
        for (let e = 1; e < pts.length; e++) {
            const v = series[pts[e]];
            if (v != null) ctx.lineTo(X(pts[e]), Y(v));
        }
        ctx.lineTo(X(pts[pts.length - 1]), H - 12);
        ctx.lineTo(X(pts[0]), H - 12);
        ctx.closePath();
        ctx.fillStyle = "rgba(80,80,80,0.10)";
        ctx.fill();
    }

    if (s.showGoalLine && ctrl.showGoal && !ctrl.noGoal) {
        const dash = s.goalLineStyle === "dashed" ? [3, 2] : s.goalLineStyle === "dotted" ? [1, 2] : [];
        ctx.beginPath();
        ctx.setLineDash(dash);
        ctx.strokeStyle = s.goalLineColor;
        ctx.lineWidth = s.goalLineThickness;
        let started = false;
        for (let e = 0; e < actuals.length; e++) {
            if (goals[e] != null) {
                if (started) ctx.lineTo(X(e), Y(goals[e] as number));
                else { ctx.moveTo(X(e), Y(goals[e] as number)); started = true; }
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    const segColor = (cf: number | null): string =>
        (ctrl.noGoal || !ctrl.showGoal) ? "#000000"
            : (cf == null || cf === 99) ? "#aaaaaa"
            : cf === 2 ? s.positiveLineColor : s.negativeLineColor;

    for (let e = 0; e < actuals.length - 1; e++) {
        const a = series[e], b = series[e + 1];
        if (a == null || b == null) continue;
        const cf = cfs[e + 1] != null ? cfs[e + 1] : cfs[e];
        ctx.beginPath();
        ctx.strokeStyle = segColor(cf);
        ctx.lineWidth = s.actualLineThickness;
        ctx.moveTo(X(e), Y(a));
        ctx.lineTo(X(e + 1), Y(b));
        ctx.stroke();
    }

    if (s.showDataPoints) {
        for (let e = 0; e < actuals.length; e++) {
            const v = series[e];
            if (v == null) continue;
            const isLast = e === lastReported;
            const r = isLast ? s.dataPointSize + 1.5 : s.dataPointSize;
            ctx.beginPath();
            ctx.fillStyle = segColor(cfs[e]);
            ctx.arc(X(e), Y(v), r, 0, 2 * Math.PI);
            ctx.fill();
            if (isLast) {
                ctx.beginPath();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.2;
                ctx.arc(X(e), Y(v), r, 0, 2 * Math.PI);
                ctx.stroke();
            }
        }
    }

    ctx.fillStyle = "#000000";
    // v1.24.0.0: plain fixed font size (chartStyle.monthLetterFontSize,
    // default 8) - replaces the old dynamic plotW/18 auto-scaling formula
    // entirely, per explicit request for a manual control instead of
    // auto-sizing.
    ctx.font = `${s.monthLetterFontSize}px Arial`;
    ctx.textAlign = "center";
    for (let e = 0; e < actuals.length && e < MONTH_LETTERS.length; e++) ctx.fillText(MONTH_LETTERS[e], X(e), H - 2);
}

// ---- section headers (s1-s12) ------------------------------------------
function readSections(objects: any): { position: number; label: string; color: string; bgColor: string }[] {
    const out: { position: number; label: string; color: string; bgColor: string }[] = [];
    for (let i = 1; i <= 12; i++) {
        const pos = Number(getProp(objects, "sectionHeaders", `s${i}pos`, null));
        if (pos != null && !isNaN(pos) && pos >= 1) {
            out.push({
                position: pos,
                label: getProp(objects, "sectionHeaders", `s${i}label`, ""),
                color: getColorProp(objects, "sectionHeaders", `s${i}color`, "#D64550"),
                bgColor: getColorProp(objects, "sectionHeaders", `s${i}bgColor`, "#FFFFFF")
            });
        }
    }
    return out;
}

function esc(s: string): string {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export class KPIMatrixGridVisual implements IVisual {
    private target: HTMLElement;
    private container: HTMLElement;
    private tooltipEl: HTMLElement;
    private lastDataView: DataView | null = null;
    private host: IVisualHost;
    // v1.29.10.0-rendering-events: required for certification (Rendering
    // Events API). Notifies "export to PDF" / "export to PowerPoint"
    // listeners when this visual's render pass has actually finished -
    // without this, exports can capture the visual mid-render or never
    // resolve at all. See Part C / Phase 1 of the certification master
    // prompt.
    private events: IVisualEventService;
    // v1.29.0.0-formattingmodel-poc: new Formatting Model plumbing -
    // currently only backs the "Hover popup" card (see settings.ts for
    // why this can't be done incrementally without hiding the other 12
    // objects' controls - Power BI ignores enumerateObjectInstances()
    // entirely once getFormattingModel() exists on the visual).
    private formattingSettingsService: FormattingSettingsService;
    private settingsModel: VisualSettingsModel;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.formattingSettingsService = new FormattingSettingsService(this.host.createLocalizationManager());
        this.target = options.element;
        this.target.style.cssText = "position:relative;width:100%;height:100%;overflow:auto;";

        this.container = document.createElement("div");
        this.container.style.cssText = "position:relative;padding-left:10px;padding-right:10px;box-sizing:border-box;";
        this.target.appendChild(this.container);

        this.tooltipEl = document.createElement("div");
        this.tooltipEl.style.cssText = "display:none;position:absolute;background:#ffffff;border:0.5px solid #cfcfc8;border-radius:8px;padding:14px 18px;min-width:260px;box-shadow:0 4px 12px rgba(0,0,0,0.15),0 1px 3px rgba(0,0,0,0.1);font-size:10px;font-family:Arial,sans-serif;z-index:99999;white-space:nowrap;text-align:left;pointer-events:none;";
        this.container.appendChild(this.tooltipEl);
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        try {
            this.render(options);
            this.events.renderingFinished(options);
        } catch (error) {
            this.events.renderingFailed(options, String(error));
            throw error;
        }
    }

    // v1.29.10.0-rendering-events: actual render logic, unchanged from
    // the previous update() body - only extracted into its own method so
    // update() itself can wrap it in a single try/catch and guarantee
    // exactly one of renderingFinished/renderingFailed fires per cycle,
    // including on every early-return path below (no data, no measures).
    private render(options: VisualUpdateOptions): void {
        const dv: DataView = options.dataViews && options.dataViews[0];
        this.tooltipEl.style.display = "none";
        while (this.container.firstChild && this.container.firstChild !== this.tooltipEl) {
            this.container.removeChild(this.container.firstChild);
        }
        if (!dv || !dv.categorical) return;
        this.lastDataView = dv;
        // v1.29.0.0-formattingmodel-poc: populates this.settingsModel from
        // the current dataView. This does NOT replace any of the
        // getProp()/getColorProp() calls below, which still read directly
        // from dv.metadata.objects exactly as before - settingsModel only
        // feeds the format pane itself (via getFormattingModel()), not
        // the actual render logic. The two stay deliberately independent
        // during migration so rendering behaviour never depends on which
        // objects have been migrated yet.
        this.settingsModel = this.formattingSettingsService.populateFormattingSettingsModel(VisualSettingsModel, dv);

        const cat = dv.categorical;
        const objects: any = (dv.metadata && dv.metadata.objects) ? dv.metadata.objects : {};

        const periods: string[] = (cat.categories && cat.categories[0] && cat.categories[0].values)
            ? cat.categories[0].values.map(v => String(v == null ? "" : v)) : [];

        const actuals: any[] = [], goals: any[] = [], cfs: any[] = [], summaries: any[] = [],
              summaryGoals: any[] = [], summaryCfs: any[] = [];
        let siteNameCol: any = null;
        if (cat.values) {
            for (const col of cat.values) {
                const roles: any = (col.source && col.source.roles) ? col.source.roles : {};
                if (roles.siteName) siteNameCol = col;
                if (roles.actualValues) actuals.push(col);
                if (roles.goalValues) goals.push(col);
                if (roles.cfValues) cfs.push(col);
                if (roles.summaryValues) summaries.push(col);
                if (roles.summaryGoalValues) summaryGoals.push(col);
                if (roles.summaryCfValues) summaryCfs.push(col);
            }
        }
        // v1.18.0.0: Site Name - an unnumbered, single-value scalar well
        // (not per-row, not per-period) shown in the corner cell above the
        // KPI label column. Bound as a measure inside the same categorical
        // query as everything else, so it's evaluated once per period row
        // just like Wells 2-4 - but since the DAX itself (typically
        // SELECTEDVALUE against a Site slicer) doesn't reference period at
        // all, every entry in its values array should be identical. Reading
        // the first non-null entry is robust to that. A genuinely blank
        // result (e.g. multiple sites selected in the report's slicer,
        // where SELECTEDVALUE naturally returns BLANK()) renders as an
        // empty corner cell, same as when nothing is bound at all.
        const siteNameRaw = (siteNameCol && siteNameCol.values) ? siteNameCol.values.find((v: any) => v != null) : null;
        const siteNameDisplay = siteNameRaw != null ? String(siteNameRaw) : "";
        if (actuals.length === 0) {
            const msg = document.createElement("div");
            msg.style.cssText = "padding:16px;color:#666;font-size:12px;font-family:Arial,sans-serif;";
            msg.textContent = "Add measures to KPI Actual Values to get started.";
            this.container.insertBefore(msg, this.tooltipEl);
            return;
        }

        // ---- global settings ----
        // v1.19.0.0: layout.rowHeight manual override removed entirely -
        // KPI row height is now always auto-equalized (every row forced to
        // match the tallest row's natural content height, unconditionally).
        // Manual mode previously skipped equalization altogether, which was
        // the confirmed root cause of goal-rows and no-goal-rows ending up
        // at different heights: a manual height number is only ever a
        // floor (CSS height on a table row can't shrink below content's
        // natural need), so any row whose content needed more space than
        // the manual number simply grew past it with nothing forcing other
        // rows to match - rowPaddingV is now the only lever for influencing
        // row height, and it always keeps every row equal by construction.
        const showKpiNumbers = !!getProp(objects, "layout", "showKpiNumbers", false);
        // v1.18.0.0: manual column-width controls removed entirely -
        // this visual now always auto-fits + shrinks-to-fit (Option B,
        // full commit, per conversation record). No toggle, no manual
        // fallback path.
        const showSummaryCol = !!getProp(objects, "layout", "showSummaryColumn", true);
        const showTrendChart = !!getProp(objects, "chartStyle", "showTrendChart", false);
        // v1.19.0.0: defaults bumped for visibility (chartColumnWidth
        // 90->180, actualLineThickness 1.5->2, dataPointSize 2->3,
        // fillArea false->true) - matched against a sibling visual's
        // proven-good trend chart, which uses these exact values with the
        // same underlying drawSparkline() logic.
        const chartColumnWidth = Number(getProp(objects, "chartStyle", "chartColumnWidth", 180));
        const chartSettings = {
            showGoalLine: !!getProp(objects, "chartStyle", "showGoalLine", true),
            positiveLineColor: getColorProp(objects, "chartStyle", "positiveLineColor", "#000000"),
            negativeLineColor: getColorProp(objects, "chartStyle", "negativeLineColor", "#D64550"),
            actualLineThickness: Number(getProp(objects, "chartStyle", "actualLineThickness", 2)),
            actualLineSmooth: !!getProp(objects, "chartStyle", "actualLineSmooth", false),
            goalLineColor: getColorProp(objects, "chartStyle", "goalLineColor", "#888888"),
            goalLineThickness: Number(getProp(objects, "chartStyle", "goalLineThickness", 2)),
            goalLineStyle: getProp(objects, "chartStyle", "goalLineStyle", "dashed"),
            showDataPoints: !!getProp(objects, "chartStyle", "showDataPoints", true),
            dataPointSize: Number(getProp(objects, "chartStyle", "dataPointSize", 3)),
            fillArea: !!getProp(objects, "chartStyle", "fillArea", true),
            showReportedMonthsOnly: !!getProp(objects, "chartStyle", "showReportedMonthsOnly", true),
            // v1.24.0.0: replaces the old dynamic plotW/18 auto-scaling
            // formula entirely - plain fixed number, no auto mode.
            monthLetterFontSize: Number(getProp(objects, "chartStyle", "monthLetterFontSize", 8))
        };
        const altShading = !!getProp(objects, "layout", "alternateRowShading", true);

        const monthlyValueFontSize = Number(getProp(objects, "monthlyValues", "fontSize", 22));
        const monthlyValueBold = !!getProp(objects, "monthlyValues", "bold", true);
        const rhFontSize = Number(getProp(objects, "kpiRowHeaders", "fontSize", 20));
        const rhFontFamily = getProp(objects, "kpiRowHeaders", "fontFamily", "Arial");
        const rhBold = !!getProp(objects, "kpiRowHeaders", "bold", true);
        const rhColor = getColorProp(objects, "kpiRowHeaders", "color", "#000000");
        const rhWrap = !!getProp(objects, "kpiRowHeaders", "wrapText", false);
        const rhAlign = getProp(objects, "kpiRowHeaders", "alignment", "left");
        const rowPaddingV = Number(getProp(objects, "layout", "rowPaddingV", 6));
        const rowPaddingH = Number(getProp(objects, "layout", "rowPaddingH", 8));
        // v1.28.0.0: Value cell's own horizontal padding is double the
        // shared rowPaddingH - computed dynamically (not a separate fixed
        // property) so it automatically stays at double whatever
        // rowPaddingH is set to, per explicit request.
        const valuePaddingH = rowPaddingH * 2;

        const chFontSize = Number(getProp(objects, "columnHeaders", "fontSize", 11));
        const chFontFamily = getProp(objects, "columnHeaders", "fontFamily", "Arial");
        const chBold = !!getProp(objects, "columnHeaders", "bold", true);
        const chColor = getColorProp(objects, "columnHeaders", "color", "#000000");
        const chBackground = getColorProp(objects, "columnHeaders", "background", "#ffffff");
        const chAlign = getProp(objects, "columnHeaders", "alignment", "center");
        const siteNameFontSize = Number(getProp(objects, "columnHeaders", "siteNameFontSize", 14));
        const siteNameBold = !!getProp(objects, "columnHeaders", "siteNameBold", true);
        const siteNameColor = getColorProp(objects, "columnHeaders", "siteNameColor", "#000000");
        const siteNameAlignment = getProp(objects, "columnHeaders", "siteNameAlignment", "left");
        // v1.28.0.0: new background colour specifically for the Site Name
        // corner cell - independent of the shared columnHeaders.background
        // used for month headers. Default is "no colour" (transparent) -
        // getColorProp with a null/undefined default returns "" here so we
        // can distinguish "not set" from an actual chosen colour.
        const siteNameBgRaw = getColorProp(objects, "columnHeaders", "siteNameBackground", "");
        const siteNameBackground = siteNameBgRaw || "transparent";

        const headerLabel = getProp(objects, "summaryColumn", "headerLabel", "Summary");
        const headerBold = !!getProp(objects, "summaryColumn", "headerBold", true);
        const showGoalDeltaColumn = !!getProp(objects, "summaryColumn", "showGoalDeltaColumn", true);
        const sumValueFontSize = Number(getProp(objects, "summaryColumn", "valueFontSize", 22));
        const goalDeltaFontSize = Number(getProp(objects, "summaryColumn", "goalDeltaFontSize", 20));
        // v1.21.0.0: fixed narrow gap between the Goal and Delta
        // sub-columns in oneLine mode - deliberately not a format-pane
        // property, per explicit request ("sensible default, keep it
        // narrow"). Does not stretch when the outer column grows to
        // absorb surplus width - any extra space appears to the right of
        // the Delta text instead, consistent with how surplus growth
        // already works elsewhere in this visual.
        const GOAL_DELTA_GAP = 10;
        // Fixed shade used for no-goal state and alternate-row shading -
        // hoisted here (was previously declared per-row) so it's
        // accessible to renderGoalDeltaCell below, defined once outside
        // the row loop.
        const NO_GOAL_GREY = "#f2f2f2";
        const goalDeltaLayout = getProp(objects, "summaryColumn", "goalDeltaLayout", "oneLine");
        const tagPosition = getProp(objects, "summaryColumn", "tagPosition", "stacked");
        // v1.27.0.0: tagValueGap removed entirely - Tag now lives in its
        // own dedicated column (see below), so there's no shared flex row
        // between Tag and Value left for a "gap" to apply to.
        const sumTagFontSize = Number(getProp(objects, "summaryColumn", "tagFontSize", 8));

        const showRowGridlines = !!getProp(objects, "gridLines", "showRowGridlines", true);
        const rowGridColor = getColorProp(objects, "gridLines", "rowGridlineColor", "#000000");
        const rowGridThick = Number(getProp(objects, "gridLines", "rowGridlineThickness", 1));
        const showColGridlines = !!getProp(objects, "gridLines", "showColGridlines", true);
        const showDivider = !!getProp(objects, "gridLines", "showKpiRowDivider", true);
        const dividerThick = Number(getProp(objects, "gridLines", "kpiRowDividerThickness", 2));
        const dividerColor = getColorProp(objects, "gridLines", "kpiRowDividerColor", "#000000");

        const positiveColor = getColorProp(objects, "conditionalFormatting", "positiveColor", "#92D050");
        const negativeColor = getColorProp(objects, "conditionalFormatting", "negativeColor", "#D64550");
        const positiveFontColor = getColorProp(objects, "conditionalFormatting", "positiveFontColor", "#000000");
        const negativeFontColor = getColorProp(objects, "conditionalFormatting", "negativeFontColor", "#FFFFFF");

        const sections = readSections(objects);
        // v1.19.0.0: sectionRowHeight removed entirely - section row height
        // is now purely a function of content + sectionPaddingV, same
        // philosophy as KPI rows (no manual number that acts as a
        // confusing floor-only override).
        const sectionFontSize = Number(getProp(objects, "sectionHeaders", "sectionFontSize", 12));
        const sectionFontFamily = getProp(objects, "sectionHeaders", "sectionFontFamily", "Arial");
        const sectionBold = !!getProp(objects, "sectionHeaders", "sectionBold", true);
        const sectionPaddingV = Number(getProp(objects, "sectionHeaders", "sectionPaddingV", 5));

        const cellBorder = (showRowGridlines || showColGridlines) ? `${rowGridThick}px solid ${rowGridColor}` : "none";

        const cfBg = (cfVal: number | null): string | null => {
            if (cfVal == null || cfVal === 99) return null;
            if (cfVal === 2) return positiveColor;
            if (cfVal === 0) return negativeColor;
            return null;
        };
        const cfFont = (cfVal: number | null): string => {
            if (cfVal === 2) return positiveFontColor;
            if (cfVal === 0) return negativeFontColor;
            return "#000000";
        };

        // ---- build table ----
        // Initial colgroup widths below are placeholders only - the
        // auto-fit + shrink-to-fit pass (right after this HTML is inserted
        // into the DOM) measures real content and overwrites every one of
        // these before the render is visible. No manual width control
        // exists anymore (Option B, full commit - see conversation record).
        // v1.27.0.0: Tag now gets its own dedicated column when
        // tagPosition="right" - always present regardless of
        // showGoalDeltaColumn (a persistent third participant, not merged
        // into Value via colspan the way stacked mode still does). Track
        // count for the Summary region: stacked mode is always 2
        // (Value+GoalDelta, unchanged); right mode is 3 when Goal/Delta is
        // showing (Value+Tag+GoalDelta), 2 when it's off (Value+Tag only -
        // GoalDelta's column/cells are omitted entirely in that case,
        // there's no colspan trick needed since Tag already occupies its
        // own slot regardless).
        const summaryColCount = !showSummaryCol ? 0 : (tagPosition !== "stacked" ? (showGoalDeltaColumn ? 3 : 2) : 2);
        const totalCols = periods.length + summaryColCount + (showTrendChart ? 1 : 0);
        // Initial "width:100%" below is an inert placeholder - the auto-fit
        // block (right after this HTML is inserted into the DOM) always
        // overwrites both table-layout and width explicitly before any
        // paint happens. The table's REAL width is always set in JS to the
        // exact sum of computed column widths, never a percentage - see
        // that block for why (this was the root cause of a confirmed bug:
        // width:100% + table-layout:fixed proportionally stretched every
        // column, including Monthly, whenever the visual was widened).
        const table = document.createElement("table");
        table.style.cssText = "width:100%;border-collapse:collapse;font-family:Arial,sans-serif;table-layout:fixed;";

        const colgroup = document.createElement("colgroup");
        const colLabel = document.createElement("col");
        colLabel.className = "col-label";
        colLabel.style.width = "220px";
        colgroup.appendChild(colLabel);
        for (let p = 0; p < periods.length; p++) {
            const colMonth = document.createElement("col");
            colMonth.className = "col-month";
            colMonth.style.width = "46px";
            colgroup.appendChild(colMonth);
        }
        if (showSummaryCol) {
            const colValue = document.createElement("col");
            colValue.className = "col-value";
            colValue.style.width = "75px";
            colgroup.appendChild(colValue);
            if (tagPosition !== "stacked") {
                const colTag = document.createElement("col");
                colTag.className = "col-tag";
                colTag.style.width = "40px";
                colgroup.appendChild(colTag);
            }
            if (tagPosition === "stacked" || showGoalDeltaColumn) {
                const colGoalDelta = document.createElement("col");
                colGoalDelta.className = "col-goaldelta";
                colGoalDelta.style.width = "90px";
                colgroup.appendChild(colGoalDelta);
            }
        }
        if (showTrendChart) {
            const colTrend = document.createElement("col");
            colTrend.style.width = `${chartColumnWidth}px`;
            colgroup.appendChild(colTrend);
        }
        table.appendChild(colgroup);

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        const thLabel = document.createElement("th");
        thLabel.className = "th-label";
        thLabel.style.cssText = `position:relative;border:${cellBorder};background:${siteNameBackground};color:${siteNameColor};font-size:${siteNameFontSize}px;font-weight:${siteNameBold ? "bold" : "normal"};text-align:${siteNameAlignment};padding:5px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
        thLabel.textContent = siteNameDisplay;
        headerRow.appendChild(thLabel);

        for (const p of periods) {
            const thMonth = document.createElement("th");
            thMonth.className = "th-month";
            thMonth.style.cssText = `border:${cellBorder};background:${chBackground};color:${chColor};font-size:${chFontSize}px;font-family:${chFontFamily};font-weight:${chBold ? "bold" : "normal"};text-align:${chAlign};padding:5px 1px;`;
            thMonth.textContent = p.toUpperCase();
            headerRow.appendChild(thMonth);
        }

        if (showSummaryCol) {
            const thSummary = document.createElement("th");
            thSummary.className = "th-summary";
            thSummary.colSpan = summaryColCount;
            thSummary.style.cssText = `position:relative;border:${cellBorder};background:${chBackground};color:${chColor};font-size:${chFontSize}px;font-family:${chFontFamily};font-weight:${headerBold ? "bold" : "normal"};padding:5px 6px;`;
            thSummary.textContent = headerLabel;
            headerRow.appendChild(thSummary);
        }

        if (showTrendChart) {
            const thTrend = document.createElement("th");
            thTrend.style.cssText = `border:${cellBorder};background:${chBackground};color:${chColor};font-size:${chFontSize}px;font-family:${chFontFamily};font-weight:${chBold ? "bold" : "normal"};padding:5px 6px;`;
            thTrend.textContent = "Trend";
            headerRow.appendChild(thTrend);
        }

        thead.appendChild(headerRow);
        table.appendChild(thead);
        // ---- end Region 1 (table skeleton) - DOM-API built, no innerHTML ----
        // v1.29.12.0: Region 2/3/5 (KPI row rendering, Summary column,
        // Trend chart) converted together in one pass, per explicit
        // decision - they all produce sibling cells within the same <tr>,
        // so they can't be cleanly separated into independent innerHTML-free
        // checkpoints the way the table skeleton could. Section header rows
        // (originally its own Region 4) were folded in too, for the same
        // structural reason: once <tbody> itself stops being string-built,
        // every row appended into it - KPI row or section header - has to
        // be a real DOM node, or the html-string bridge doesn't actually
        // go away. v1.29.13.0: the hover popup (last remaining innerHTML
        // site) is now also converted - see the "hover popup" block below.
        // As of this version, the visual builds its entire rendering
        // pipeline with real DOM APIs; no innerHTML use remains anywhere
        // in visual.ts.

        // v1.15.0.0/v1.22.0.0/v1.27.0.0: Value-cell layout helper.
        //   - stacked: unchanged - tag above value, both centered in one
        //     cell, no digit alignment (not requested for this mode).
        //   - right: v1.27.0.0 - Tag no longer renders here at all. It now
        //     lives in its own dedicated column (rendered separately, see
        //     the row loop below), so this function only builds Value's
        //     own number-block: an optional "$" prefix, the pure numeric
        //     core in a globally-fixed-width right-aligned box (so digits
        //     still align down the column), and a trailing suffix
        //     (K/M/%). Centered as a block within Value's own cell, since
        //     there's no longer a Tag on the opposite edge to justify
        //     against - Value's shrink/grow behaviour is now completely
        //     independent of whatever Tag's own column is doing.
        //   "left" removed entirely (dropped from the tagPosition enum).
        const renderTagValue = (tag: string, valueDisplay: string): HTMLElement => {
            if (tagPosition === "stacked") {
                const wrap = document.createElement("div");
                wrap.style.cssText = "text-align:center;line-height:1.05;overflow:hidden;text-overflow:ellipsis;";
                if (tag) {
                    const tagDiv = document.createElement("div");
                    tagDiv.style.cssText = `font-size:${sumTagFontSize}px;font-weight:bold;overflow:hidden;text-overflow:ellipsis;`;
                    tagDiv.textContent = tag;
                    wrap.appendChild(tagDiv);
                }
                const valueDiv = document.createElement("div");
                valueDiv.style.cssText = `font-size:${sumValueFontSize}px;font-weight:bold;overflow:hidden;text-overflow:ellipsis;`;
                valueDiv.textContent = valueDisplay;
                wrap.appendChild(valueDiv);
                return wrap;
            }
            const { prefix, core, suffix } = splitValueDisplay(valueDisplay);
            const block = document.createElement("div");
            block.className = "value-number-block";
            block.style.cssText = `display:flex;align-items:baseline;justify-content:center;flex-shrink:0;min-width:0;font-size:${sumValueFontSize}px;font-weight:bold;overflow:hidden;`;

            const prefixSpan = document.createElement("span");
            prefixSpan.className = "value-prefix-part";
            prefixSpan.style.cssText = "white-space:nowrap;";
            prefixSpan.textContent = prefix;
            block.appendChild(prefixSpan);

            // v1.28.0.0 FIX: white-space:nowrap + text-overflow:ellipsis kept
            // here exactly as before - previously missing here (every other
            // shrinking element in this visual already had both). Without
            // white-space:nowrap, text that didn't fit the shrunk box
            // WRAPPED to a second line instead of overflowing on one - that
            // wrapped line was then silently hidden by the cell's fixed row
            // height and overflow:hidden, with no visible ellipsis or any
            // indication a character had been cut.
            const digitsSpan = document.createElement("span");
            digitsSpan.className = "value-digits-part";
            digitsSpan.style.cssText = "display:inline-block;text-align:right;overflow:hidden;min-width:0;white-space:nowrap;text-overflow:ellipsis;";
            digitsSpan.textContent = core;
            block.appendChild(digitsSpan);

            const suffixSpan = document.createElement("span");
            suffixSpan.className = "value-suffix-part";
            suffixSpan.style.cssText = "white-space:nowrap;";
            suffixSpan.textContent = suffix;
            block.appendChild(suffixSpan);

            return block;
        };

        // v1.27.0.0: extracted so both tagPosition branches (stacked and
        // right) can render Cell B identically without duplicating markup.
        // Goal above Delta (or side-by-side in oneLine mode), or fully
        // blank grey when noGoalActive - unchanged behaviour from prior
        // versions, just no longer inlined per-branch.
        const renderGoalDeltaCell = (goalDisplay: string, deltaDisplay: string, noGoalActive: boolean, sumCfCode: number | null): HTMLTableCellElement => {
            const deltaValueColor = sumCfCode === 2 ? "#000000" : sumCfCode === 0 ? "#c0342f" : "#000000";
            const goalDeltaBg = noGoalActive ? NO_GOAL_GREY : "#ffffff";
            const td = document.createElement("td");
            td.className = "td-goaldelta";
            td.style.cssText = `border:${cellBorder};background:${goalDeltaBg};color:#000000;padding:${rowPaddingV}px ${rowPaddingH}px;white-space:nowrap;overflow:hidden;`;

            const makeLabelValue = (label: string, value: string, bold: boolean, color: string): HTMLElement => {
                const container = document.createElement("span");
                const labelSpan = document.createElement("span");
                labelSpan.style.cssText = "font-weight:bold;color:#000000;";
                labelSpan.textContent = `${label} `;
                container.appendChild(labelSpan);
                const valueSpan = document.createElement("span");
                valueSpan.style.cssText = `${bold ? "font-weight:bold;" : ""}color:${color};`;
                valueSpan.textContent = value;
                container.appendChild(valueSpan);
                return container;
            };

            if (noGoalActive) {
                // no text at all - a blank grey cell.
            } else if (goalDeltaLayout === "oneLine") {
                const row = document.createElement("div");
                row.style.cssText = `display:flex;align-items:center;justify-content:flex-start;font-size:${goalDeltaFontSize}px;overflow:hidden;`;

                const goalPart = document.createElement("div");
                goalPart.className = "goaldelta-goal-part";
                goalPart.style.cssText = "text-align:left;white-space:nowrap;overflow:hidden;flex-shrink:0;min-width:0;";
                if (goalDisplay) goalPart.appendChild(makeLabelValue("Goal", goalDisplay, false, "#000000"));
                row.appendChild(goalPart);

                const gap = document.createElement("div");
                gap.style.cssText = `flex-shrink:0;width:${GOAL_DELTA_GAP}px;`;
                row.appendChild(gap);

                const deltaPart = document.createElement("div");
                deltaPart.className = "goaldelta-delta-part";
                deltaPart.style.cssText = "text-align:left;white-space:nowrap;overflow:hidden;flex-shrink:0;min-width:0;";
                if (deltaDisplay) deltaPart.appendChild(makeLabelValue("Delta", deltaDisplay, true, deltaValueColor));
                row.appendChild(deltaPart);

                td.appendChild(row);
            } else {
                const wrap = document.createElement("div");
                wrap.style.cssText = "text-align:center;line-height:1.3;overflow:hidden;";
                if (goalDisplay) {
                    const goalDiv = document.createElement("div");
                    goalDiv.style.cssText = `font-size:${goalDeltaFontSize}px;overflow:hidden;text-overflow:ellipsis;`;
                    goalDiv.appendChild(makeLabelValue("Goal", goalDisplay, false, "#000000"));
                    wrap.appendChild(goalDiv);
                }
                if (deltaDisplay) {
                    const deltaDiv = document.createElement("div");
                    deltaDiv.style.cssText = `font-size:${goalDeltaFontSize}px;overflow:hidden;text-overflow:ellipsis;`;
                    deltaDiv.appendChild(makeLabelValue("Delta", deltaDisplay, true, deltaValueColor));
                    wrap.appendChild(deltaDiv);
                }
                td.appendChild(wrap);
            }
            return td;
        };

        const chartRows: { rowIdx: number; actuals: (number | null)[]; goals: (number | null)[]; cfs: (number | null)[]; ctrl: RowCtrl }[] = [];
        let cellCounter = 0;
        // v1.11.0.0: Wells 5-7 are now OPTIONAL per row - only rows left
        // on Summary mode "custom" bind them. Power BI compacts bound
        // measures into a plain positional array with no gaps, so we
        // track our own counter that only advances for "custom" rows,
        // and map the k-th such row (in top-to-bottom order) to the k-th
        // entry in summaries/summaryGoals/summaryCfs. Convention: bind
        // Custom-mode rows' Wells 5-7 measures in the SAME top-to-bottom
        // order those rows appear in the matrix (they need not be
        // contiguous - just not reordered relative to each other).
        let customSummaryIdx = 0;
        // v1.16.0.0: calendar prior-month column, shared across every row -
        // computed once since it depends only on the render-time date and
        // the bound period labels, not on any per-row data.
        const priorMonthIdx = findPriorMonthIndex(periods);
        const tbody = document.createElement("tbody");
        for (let r = 0; r < actuals.length; r++) {
            const sec = sections.find(s => s.position === r + 1);
            if (sec) {
                const sectionTr = document.createElement("tr");
                const sectionTd = document.createElement("td");
                sectionTd.colSpan = totalCols + 1;
                sectionTd.style.cssText = `border:${cellBorder};background:${sec.bgColor};color:${sec.color};font-size:${sectionFontSize}px;font-family:${sectionFontFamily};font-weight:${sectionBold ? "bold" : "normal"};padding:${sectionPaddingV}px 8px;`;
                sectionTd.textContent = sec.label;
                sectionTr.appendChild(sectionTd);
                tbody.appendChild(sectionTr);
            }

            const ctrl = rowCtrl(objects, r);
            const rawRowLabel = (actuals[r].source && actuals[r].source.displayName) ? actuals[r].source.displayName : `KPI ${r + 1}`;
            // Developer aid: prefix with this row's exact format-pane slot
            // number (matches "KPI N" in Row level control cards 1:1) so
            // alignment between data bindings and per-row controls can be
            // visually cross-checked during development. Same font as the
            // label itself - no separate styling, kept deliberately simple.
            const rowLabel = showKpiNumbers ? `${r + 1}. ${rawRowLabel}` : rawRowLabel;
            const actualVals: any[] = actuals[r].values || [];
            const cfVals: any[] = cfs[r] ? (cfs[r].values || []) : [];
            const goalVals: any[] = goals[r] ? (goals[r].values || []) : [];
            // Manual override always wins; default ("cf") is resolved via
            // auto-detection from this row's own actual/CF history rather
            // than trusting the current cell's CF code directly.
            const effectivePolarity = (ctrl.popupPolarity === "moreIsMore" || ctrl.popupPolarity === "lessIsMore")
                ? ctrl.popupPolarity
                : detectRowPolarity(actualVals, cfVals);

            const rowBg = altShading && (r % 2 === 1) ? "#f2f2f2" : "#ffffff";
            const rowBorderBottom = showDivider ? `border-bottom:${dividerThick}px solid ${dividerColor};` : "";
            const tr = document.createElement("tr");
            tr.className = "kpi-row";
            tr.style.cssText = `background:${rowBg};${rowBorderBottom}`;

            const rowLabelTd = document.createElement("td");
            rowLabelTd.className = "td-rowlabel";
            rowLabelTd.style.cssText = `border:${cellBorder};padding:${rowPaddingV}px ${rowPaddingH}px;font-size:${rhFontSize}px;font-family:${rhFontFamily};font-weight:${rhBold ? "bold" : "normal"};color:${rhColor};text-align:${rhAlign};white-space:${rhWrap ? "normal" : "nowrap"};`;
            rowLabelTd.textContent = rowLabel;
            tr.appendChild(rowLabelTd);

            for (let m = 0; m < periods.length; m++) {
                const rawActual = actualVals[m];
                const rawCf = cfVals[m];
                const cell = parseCell(rawActual);
                const cfParsed = parseCell(rawCf);
                const cfCode = ctrl.disableCF ? null : cfParsed.numeric;
                const bg = cfBg(cfCode);
                const fontColor = bg ? cfFont(cfCode) : "#000000";
                const display = displayMonthly(cell, ctrl);
                const priorParsed = m > 0 ? parseCell(actualVals[m - 1]) : { numeric: null, isNA: false, isNone: false };
                const showHoverPopup = cell.numeric != null && priorParsed.numeric != null;
                const monthTd = document.createElement("td");
                monthTd.className = showHoverPopup ? "td-monthly mgcell" : "td-monthly";
                if (showHoverPopup) {
                    monthTd.dataset.prior = String(priorParsed.numeric);
                    monthTd.dataset.cur = String(cell.numeric);
                    monthTd.dataset.pl = (periods[m - 1] || "").toUpperCase();
                    monthTd.dataset.cl = (periods[m] || "").toUpperCase();
                    monthTd.dataset.decmode = ctrl.decimalsMode;
                    monthTd.dataset.decmonthly = String(ctrl.decimalsMonthly);
                    monthTd.dataset.polarity = effectivePolarity;
                    cellCounter++;
                }
                monthTd.style.cssText = `border:${cellBorder};padding:${rowPaddingV}px ${rowPaddingH}px;text-align:center;font-size:${monthlyValueFontSize}px;font-weight:${monthlyValueBold ? "bold" : "normal"};${bg ? `background:${bg};` : ""}color:${fontColor};${showHoverPopup ? "cursor:default;" : ""}`;
                monthTd.textContent = display;
                tr.appendChild(monthTd);
            }

            if (showSummaryCol) {
                const isCustom = ctrl.summaryMode === "custom" || !ctrl.summaryMode;
                let sumCell: ParsedCell;
                let goalCell: ParsedCell;
                let sumCfCode: number | null;

                if (isCustom) {
                    // Legacy path: Wells 5/6/7 (summaryValues, summaryGoalValues,
                    // summaryCfValues) are bound in the SAME categorical
                    // mapping, grouped by the same "period" category axis as
                    // the monthly wells - so DAX evaluates them once PER
                    // PERIOD, not once as a true ungrouped total. Reading
                    // values[0] therefore always returned January's own
                    // per-column result, no matter which measure was bound.
                    // Fix: read from the last REPORTED (non-blank) period's
                    // index instead of a hardcoded 0 - this is the index that
                    // corresponds to "last closed month", matching what a
                    // properly-written Summary measure is meant to represent.
                    const periodIdx = lastReportedIndex(actualVals);
                    const sumIdx = periodIdx >= 0 ? periodIdx : 0;
                    // Positional mapping - see customSummaryIdx declaration.
                    const k = customSummaryIdx;
                    sumCell = parseCell(summaries[k] ? summaries[k].values[sumIdx] : null);
                    goalCell = parseCell(summaryGoals[k] ? summaryGoals[k].values[sumIdx] : null);
                    const sumCfParsed = parseCell(summaryCfs[k] ? summaryCfs[k].values[sumIdx] : null);
                    sumCfCode = sumCfParsed.numeric;
                    customSummaryIdx++;
                } else {
                    // v1.11.0.0 derived path: Prior Month / Sum YTD / Average
                    // YTD, computed entirely from this row's own Wells 2/3
                    // arrays - no Wells 5-7 DAX required for this row at all.
                    const derived = deriveSummaryFromArrays(ctrl.summaryMode, actualVals, goalVals, priorMonthIdx);
                    // isNone deliberately hardcoded false here, same as isNA above:
                    // deriveSummaryFromArrays already excludes None (like NA and
                    // blank) from its sums/averages via the numeric-only checks in
                    // sumOrAvg(), so a None month simply renders as blank in the
                    // derived Summary column, never as the literal word "None".
                    sumCell = { numeric: derived.actual, isNA: derived.actualIsNA, isNone: false };
                    goalCell = { numeric: derived.goal, isNA: derived.goalIsNA, isNone: false };
                    // Summary CF is derived from the SAME polarity used for
                    // the hover-popup swing colour (manual override, else
                    // auto-detected from this row's own history) - never
                    // trusted from a separate CF measure, since there isn't
                    // one for these modes.
                    if (sumCell.numeric == null || goalCell.numeric == null) {
                        sumCfCode = 99;
                    } else if (effectivePolarity === "moreIsMore") {
                        sumCfCode = sumCell.numeric >= goalCell.numeric ? 2 : 0;
                    } else if (effectivePolarity === "lessIsMore") {
                        sumCfCode = sumCell.numeric <= goalCell.numeric ? 2 : 0;
                    } else {
                        sumCfCode = 99;
                    }
                }
                // v1.22.0.0: showActual suppresses DISPLAY only - sumCell's
                // underlying numeric value already drove sumCfCode and will
                // still drive Delta below; only the visible text changes.
                const sumDisplay = ctrl.showActual ? displaySummary(sumCell, ctrl) : "";

                // No-goal state: explicit per-row toggle OR the Goal measure
                // is genuinely blank (not NA, not present). v1.16.0.0: both
                // cells now grey out (#f2f2f2, the same fixed shade used for
                // alternate-row shading, applied unconditionally regardless
                // of this row's own alternating shade or the
                // alternateRowShading toggle) with NO "NA" text anywhere.
                // Cell A still shows its real Summary Actual value (that
                // data exists - only the Goal is missing); Cell B is fully
                // blank since Goal/Delta genuinely don't exist for this row.
                const noGoalActive = ctrl.noGoal || goalCell.numeric == null;

                // Backgrounds ALWAYS match between the two cells (except in
                // no-goal state, which forces its own grey on both).
                const sharedBg = noGoalActive ? NO_GOAL_GREY : cfBg(sumCfCode);
                // Contrast rule: black bold on green, white bold on red.
                // Only forced when a CF colour is actually applied - no-goal
                // grey always uses plain black text, no forced contrast.
                const sharedFontColor = noGoalActive ? "#000000" : (sharedBg ? cfFont(sumCfCode) : "#000000");

                const goalDisplay = (!noGoalActive && ctrl.showGoal && goalCell.numeric != null)
                    ? applyUnit(fmt(goalCell.numeric, ctrl.decimalsSummary), ctrl.valueUnit) : "";
                // Delta: same logic as the proven source - raw Summary Actual
                // minus Summary Goal (no polarity flip), coloured entirely by
                // the Summary CF code, never by the sign of the difference.
                const hasDelta = !noGoalActive && ctrl.showDelta && sumCell.numeric != null && goalCell.numeric != null;
                const deltaDisplay = hasDelta ? applyUnit(fmtDelta((sumCell.numeric as number) - (goalCell.numeric as number), ctrl.decimalsSummary), ctrl.valueUnit) : "";

                const cellBgStyle = sharedBg ? `background:${sharedBg};` : "";

                if (tagPosition !== "stacked") {
                    // v1.27.0.0: Tag now lives in its own dedicated
                    // column - Value never uses a colspan trick in this
                    // mode, and Tag renders ALWAYS regardless of
                    // showGoalDeltaColumn (per explicit requirement).
                    // v1.28.0.0: no border between Value and Tag (reads
                    // as one seamless block) - top/bottom/outer borders
                    // stay intact, only the shared inner edge is
                    // suppressed. Value's own horizontal padding is
                    // doubled (2x rowPaddingH) per explicit request - see
                    // the auto-fit block for the matching width-math fix
                    // that properly reserves room for it now.
                    const valueTd = document.createElement("td");
                    valueTd.className = "td-value";
                    valueTd.style.cssText = `border-top:${cellBorder};border-bottom:${cellBorder};border-left:${cellBorder};${cellBgStyle}color:${sharedFontColor};padding:${rowPaddingV}px ${valuePaddingH}px;white-space:nowrap;overflow:hidden;`;
                    valueTd.appendChild(renderTagValue(ctrl.summaryTag, sumDisplay));
                    tr.appendChild(valueTd);
                    // Tag cell: always matches Value's background/font
                    // colour exactly (same CF-driven states, same
                    // no-goal grey-out), centered, bold by default,
                    // minimal 4px padding so it doesn't collide with
                    // neighbouring columns.
                    const tagTd = document.createElement("td");
                    tagTd.className = "td-tag";
                    tagTd.style.cssText = `border-top:${cellBorder};border-bottom:${cellBorder};border-right:${cellBorder};${cellBgStyle}color:${sharedFontColor};padding:4px;text-align:center;font-weight:bold;font-size:${sumTagFontSize}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
                    tagTd.textContent = ctrl.summaryTag;
                    tr.appendChild(tagTd);
                    if (showGoalDeltaColumn) {
                        tr.appendChild(renderGoalDeltaCell(goalDisplay, deltaDisplay, noGoalActive, sumCfCode));
                    }
                    // else: GoalDelta's column/cells are omitted entirely
                    // for this render - no colspan needed since Tag
                    // already occupies its own slot regardless.
                } else if (!showGoalDeltaColumn) {
                    // stacked mode, Goal/Delta off: unchanged from prior
                    // versions - Cell A spans both column tracks
                    // (colspan=2), Tag moves inline beside Value within
                    // that merged cell (this is what shrinks the row's
                    // natural minimum height in this specific state).
                    const valueTd = document.createElement("td");
                    valueTd.className = "td-value";
                    valueTd.colSpan = 2;
                    valueTd.style.cssText = `border:${cellBorder};${cellBgStyle}color:${sharedFontColor};padding:${rowPaddingV}px ${valuePaddingH}px;white-space:nowrap;overflow:hidden;`;
                    valueTd.appendChild(renderTagValue(ctrl.summaryTag, sumDisplay));
                    tr.appendChild(valueTd);
                } else {
                    // stacked mode, Goal/Delta on: unchanged from prior
                    // versions.
                    const valueTd = document.createElement("td");
                    valueTd.className = "td-value";
                    valueTd.style.cssText = `border:${cellBorder};${cellBgStyle}color:${sharedFontColor};padding:${rowPaddingV}px ${valuePaddingH}px;white-space:nowrap;overflow:hidden;`;
                    valueTd.appendChild(renderTagValue(ctrl.summaryTag, sumDisplay));
                    tr.appendChild(valueTd);
                    tr.appendChild(renderGoalDeltaCell(goalDisplay, deltaDisplay, noGoalActive, sumCfCode));
                }
            }
            if (showTrendChart) {
                if (ctrl.showChart) {
                    const chartTd = document.createElement("td");
                    chartTd.style.cssText = `border:${cellBorder};padding:2px;`;
                    const canvas = document.createElement("canvas");
                    canvas.className = "trend-canvas";
                    canvas.dataset.rowidx = String(r);
                    canvas.height = 57;
                    canvas.style.cssText = "display:block;width:100%;";
                    chartTd.appendChild(canvas);
                    tr.appendChild(chartTd);
                    chartRows.push({
                        rowIdx: r,
                        actuals: actualVals.map((v: any) => parseCell(v).numeric),
                        goals: goalVals.map((v: any) => parseCell(v).numeric),
                        cfs: cfVals.map((v: any) => parseCell(v).numeric),
                        ctrl
                    });
                } else {
                    // v1.20.0.0: per-row chart off - plain grey cell, no
                    // canvas at all (not just a hidden/blank one), same
                    // #f2f2f2 shade used for no-goal/alternate-row shading.
                    const chartTd = document.createElement("td");
                    chartTd.style.cssText = `border:${cellBorder};padding:2px;background:#f2f2f2;`;
                    tr.appendChild(chartTd);
                }
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        const tableWrap = document.createElement("div");
        tableWrap.appendChild(table);
        this.container.insertBefore(tableWrap, this.tooltipEl);

        // ---- v1.19.0.0: auto-fit + shrink-to-fit + surplus growth --------
        // No manual width mode exists (Option B, full commit). Every column
        // is measured against its actual rendered content and resized live,
        // every render.
        //   1. KPI Label column NEVER shrinks, NEVER grows beyond its own
        //      natural content width, and NEVER wraps. Not part of any
        //      shrink or growth calculation.
        //   2. Monthly column width is measured from the HEADER LABEL ONLY
        //      ("JAN-26" etc.), never from the numeric values inside - a
        //      monthly value wider than its header will ellipsis. Also
        //      never grows beyond that natural header-based width.
        //   3. Value column always renders at its own natural content
        //      width - never shrinks below it under growth/surplus
        //      conditions, never grows beyond it either.
        //   4. Trend chart column always renders at exactly its configured
        //      chartColumnWidth - a plain manual property, untouched by any
        //      of this, never grows or shrinks.
        //   5. If Label+Monthly*12+Value+Chart (all natural/fixed) +
        //      Goal/Delta (natural) doesn't fit the visual's real available
        //      width, Value and Goal/Delta shrink PROPORTIONALLY together
        //      down to a 24px floor each (Monthly/Label stay fixed). If
        //      still not enough, Monthly itself shrinks too, uniformly,
        //      down to a 20px floor - the one exception to "monthly is
        //      fixed". Label is protected through every stage; if even
        //      that's not enough, widening the visual is the only fix.
        //   6. v1.19.0.0 FIX: the table element itself no longer has
        //      width:100% - it is set to the EXACT sum of every computed
        //      column width instead. Previously, table-layout:fixed with
        //      width:100% would proportionally stretch every column
        //      (including Monthly, which should never move) to fill
        //      whatever extra space existed beyond the computed pixel
        //      widths - the actual root cause of Monthly columns visibly
        //      growing when the visual was widened, reported directly.
        //   7. v1.19.0.0 NEW: if there IS genuine leftover space once every
        //      other column is at its natural/fixed width (i.e. the visual
        //      is wider than the natural total), Goal/Delta is the ONE AND
        //      ONLY column that absorbs it - growing to consume 100% of
        //      the surplus, uncapped. This only happens when the Summary
        //      column AND its Goal/Delta cell are both actually showing
        //      (showSummaryCol && showGoalDeltaColumn) - if either is off,
        //      nothing absorbs surplus; the table simply sits at its
        //      natural width with blank space to its right, by design.
        //   8. Font sizes are never touched at any stage.
        {
            const tableEl = tableWrap.querySelector("table") as HTMLTableElement | null;
            if (tableEl) {
                // Measurement pass: table-layout:auto AND no forced width,
                // so the browser sizes columns purely to their natural
                // content - width:100% during this phase would inflate the
                // very measurements this block relies on.
                tableEl.style.tableLayout = "auto";
                tableEl.style.width = "auto";
                void tableEl.offsetWidth; // force reflow before measuring

                const maxWidth = (selector: string): number => {
                    let max = 0;
                    tableWrap.querySelectorAll(selector).forEach((el: Element) => {
                        max = Math.max(max, (el as HTMLElement).getBoundingClientRect().width);
                    });
                    return max;
                };

                // +2px buffer on each to avoid a subpixel-rounding ellipsis
                // false positive right at the measured boundary.
                const FLEX_FLOOR = 24;
                const MONTH_FLOOR = 20;
                const naturalLabelW = Math.ceil(maxWidth(".td-rowlabel, .th-label")) + 2;
                const naturalMonthW = Math.ceil(maxWidth(".th-month")) + 2;
                // v1.22.0.0: Cell A digit alignment (left/right tagPosition
                // only - stacked keeps the old whole-cell measurement,
                // v1.27.0.0: SIMPLER than before - Tag no longer shares a
                // cell with Value at all (right mode), so Value's natural
                // width is just its own number-block (prefix+aligned-
                // digits+suffix), with no per-row prefix/suffix/tag
                // bookkeeping needed anymore. Still a two-stage
                // measurement (measure the widest numeric core globally,
                // apply it, THEN re-measure the combined number-block) for
                // the same reason as before - doing it in one pass would
                // undercount whenever the row with the widest core isn't
                // the same row as the row with the longest suffix.
                let naturalValueW: number;
                let naturalDigitsPartW = 0;
                if (tagPosition === "stacked") {
                    naturalValueW = Math.ceil(maxWidth(".td-value")) + 2;
                } else {
                    naturalDigitsPartW = Math.ceil(maxWidth(".value-digits-part")) + 2;
                    tableWrap.querySelectorAll(".value-digits-part").forEach((el: Element) => {
                        (el as HTMLElement).style.width = `${naturalDigitsPartW}px`;
                    });
                    void tableEl.offsetWidth; // force reflow before re-measuring
                    // v1.28.0.0 FIX: maxWidth(".value-number-block") only
                    // measures the INNER content - the <td>'s own padding
                    // (now doubled, valuePaddingH) was never being reserved
                    // in the column width at all, meaning padding just
                    // silently ate into space that should have been
                    // available for the digits/suffix - compounding the
                    // truncation problem rather than solving it. Adding
                    // the padding back explicitly here (left+right) is
                    // what makes doubling the padding actually widen the
                    // column to compensate, instead of squeezing content
                    // further.
                    naturalValueW = Math.ceil(maxWidth(".value-number-block")) + (valuePaddingH * 2) + 2;
                }
                // Tag is now its own dedicated column (right mode only) -
                // measured completely independently of Value, since it no
                // longer shares a cell or competes with Value's own
                // prefix/suffix for space. This is what actually fixes the
                // clipping at its root: Tag's width no longer depends on
                // what any other row's number looks like. (.td-tag is
                // measured as the actual <td>, so its own 4px padding is
                // already included correctly - no fix needed here.)
                const naturalTagColW = tagPosition !== "stacked" ? Math.ceil(maxWidth(".td-tag")) + 2 : 0;
                // v1.21.0.0: in oneLine mode, Goal/Delta's natural width is
                // the sum of the two globally-measured sub-columns (widest
                // "Goal ..." anywhere + gap + widest "Delta ..." anywhere) -
                // NOT the generic whole-cell measurement, which could
                // undercount if the row with the widest Goal isn't also the
                // row with the widest Delta. Stacked mode is unaffected -
                // still measured as a whole cell, since it has no
                // sub-column alignment concept at all.
                const naturalGoalPartW = goalDeltaLayout === "oneLine" ? Math.ceil(maxWidth(".goaldelta-goal-part")) + 2 : 0;
                const naturalDeltaPartW = goalDeltaLayout === "oneLine" ? Math.ceil(maxWidth(".goaldelta-delta-part")) + 2 : 0;
                // v1.28.0.0 FIX: same padding-omission bug as Value above -
                // the sub-column sum never included .td-goaldelta's own
                // padding (rowPaddingH, unchanged/not doubled for this
                // cell) either. Added back explicitly here; the "two-line"
                // (stacked-style) branch already measures the whole
                // .td-goaldelta cell directly, so it was never affected.
                const naturalGoalDeltaW = goalDeltaLayout === "oneLine"
                    ? naturalGoalPartW + GOAL_DELTA_GAP + naturalDeltaPartW + (rowPaddingH * 2)
                    : Math.ceil(maxWidth(".td-goaldelta")) + 2;
                const numMonths = periods.length;
                const chartW = showTrendChart ? chartColumnWidth : 0;
                const goalDeltaEligible = showSummaryCol && showGoalDeltaColumn;
                // v1.27.0.0: Tag is a genuine third shrink participant
                // alongside Value and Goal/Delta, only when it exists as
                // its own column (tagPosition="right"). It never grows
                // beyond its natural width (growth/surplus still goes
                // solely to Goal/Delta, per established design) but can
                // shrink under real pressure same as the other two.
                const tagColEligible = tagPosition !== "stacked";
                const flexParticipantCount = 2 + (tagColEligible ? 1 : 0);

                // Real available width for the table - the target element's
                // clientWidth already excludes any vertical scrollbar it's
                // showing, and the container's own left/right padding
                // (10px each, set in the constructor) is subtracted so this
                // matches the table's actual usable box, not the visual's
                // nominal outer size.
                const availableWidth = Math.max(0, this.target.clientWidth - 20);

                const remainingAfterLabel = availableWidth - naturalLabelW;
                const naturalRest = naturalValueW + naturalTagColW + naturalGoalDeltaW + (naturalMonthW * numMonths) + chartW;

                let finalValueW = naturalValueW;
                let finalTagColW = naturalTagColW;
                let finalGoalDeltaW = naturalGoalDeltaW;
                let finalMonthW = naturalMonthW;

                if (remainingAfterLabel > 0 && naturalRest > remainingAfterLabel) {
                    // Shrink path: not enough room at natural sizes.
                    const flexNaturalTotal = naturalValueW + naturalTagColW + naturalGoalDeltaW;
                    const flexFloorTotal = FLEX_FLOOR * flexParticipantCount;
                    const flexBudget = remainingAfterLabel - (naturalMonthW * numMonths) - chartW;

                    if (flexBudget >= flexFloorTotal && flexNaturalTotal > 0) {
                        const scale = Math.min(1, flexBudget / flexNaturalTotal);
                        finalValueW = Math.max(FLEX_FLOOR, Math.floor(naturalValueW * scale));
                        finalTagColW = tagColEligible ? Math.max(FLEX_FLOOR, Math.floor(naturalTagColW * scale)) : 0;
                        finalGoalDeltaW = Math.max(FLEX_FLOOR, Math.floor(naturalGoalDeltaW * scale));
                    } else {
                        finalValueW = FLEX_FLOOR;
                        finalTagColW = tagColEligible ? FLEX_FLOOR : 0;
                        finalGoalDeltaW = FLEX_FLOOR;
                        const remainingForMonths = remainingAfterLabel - flexFloorTotal - chartW;
                        if (numMonths > 0) {
                            finalMonthW = remainingForMonths >= MONTH_FLOOR * numMonths
                                ? Math.floor(remainingForMonths / numMonths)
                                : MONTH_FLOOR;
                        }
                    }
                } else if (remainingAfterLabel <= 0) {
                    finalValueW = FLEX_FLOOR;
                    finalTagColW = tagColEligible ? FLEX_FLOOR : 0;
                    finalGoalDeltaW = FLEX_FLOOR;
                    finalMonthW = MONTH_FLOOR;
                } else if (goalDeltaEligible) {
                    // Growth path: genuine leftover space exists at natural
                    // sizes. Goal/Delta alone absorbs 100% of it, uncapped -
                    // Label/Monthly/Value/Tag/Chart stay exactly at their
                    // natural/fixed widths, untouched.
                    const surplus = remainingAfterLabel - naturalRest;
                    finalGoalDeltaW = naturalGoalDeltaW + surplus;
                }
                // If leftover space exists but Goal/Delta isn't eligible
                // (Summary off, or Goal/Delta cell off) - nothing absorbs
                // it; every column stays at natural width and the table is
                // simply narrower than the available box, by design.

                // v1.21.0.0: final sub-part widths for oneLine mode. If the
                // outer Goal/Delta column shrank (finalGoalDeltaW <
                // naturalGoalDeltaW), both sub-parts shrink by the SAME
                // proportion so they still fit inside the narrower column.
                // If it grew (surplus absorption) or stayed the same, both
                // sub-parts stay at their natural global-max widths
                // unchanged - the gap between them never stretches, and any
                // extra space simply appears as blank space to the right of
                // the Delta sub-column, per explicit requirement.
                let finalGoalPartW = naturalGoalPartW;
                let finalDeltaPartW = naturalDeltaPartW;
                if (goalDeltaLayout === "oneLine" && naturalGoalDeltaW > 0 && finalGoalDeltaW < naturalGoalDeltaW) {
                    const partScale = finalGoalDeltaW / naturalGoalDeltaW;
                    finalGoalPartW = Math.max(10, Math.floor(naturalGoalPartW * partScale));
                    finalDeltaPartW = Math.max(10, Math.floor(naturalDeltaPartW * partScale));
                }

                // v1.22.0.0: if Cell A's Value column shrinks under the
                // same shrink-to-fit cascade, the digits-part box (already
                // forced to naturalDigitsPartW above, for measurement
                // purposes) needs to shrink proportionally too, so it still
                // fits within the narrower column - same technique as the
                // Goal/Delta sub-parts above. v1.27.0.0: Tag no longer
                // needs any per-row budget math at all - it's an
                // independent column now, shrunk directly via
                // finalTagColW from the cascade above.
                let finalDigitsPartW = naturalDigitsPartW;
                if (tagPosition !== "stacked" && naturalValueW > 0 && finalValueW < naturalValueW) {
                    const digitsScale = finalValueW / naturalValueW;
                    finalDigitsPartW = Math.max(10, Math.floor(naturalDigitsPartW * digitsScale));
                }

                const colLabelEl = tableWrap.querySelector(".col-label") as HTMLElement | null;
                const colValueEl = tableWrap.querySelector(".col-value") as HTMLElement | null;
                const colTagEl = tableWrap.querySelector(".col-tag") as HTMLElement | null;
                const colGoalDeltaEl = tableWrap.querySelector(".col-goaldelta") as HTMLElement | null;
                const colMonthEls = tableWrap.querySelectorAll(".col-month");

                if (colLabelEl) colLabelEl.style.width = `${naturalLabelW}px`;
                if (colValueEl) colValueEl.style.width = `${finalValueW}px`;
                if (colTagEl) colTagEl.style.width = `${finalTagColW}px`;
                if (colGoalDeltaEl) colGoalDeltaEl.style.width = `${finalGoalDeltaW}px`;
                colMonthEls.forEach((c: Element) => { (c as HTMLElement).style.width = `${finalMonthW}px`; });

                if (goalDeltaLayout === "oneLine") {
                    tableWrap.querySelectorAll(".goaldelta-goal-part").forEach((el: Element) => {
                        (el as HTMLElement).style.width = `${finalGoalPartW}px`;
                    });
                    tableWrap.querySelectorAll(".goaldelta-delta-part").forEach((el: Element) => {
                        (el as HTMLElement).style.width = `${finalDeltaPartW}px`;
                    });
                }
                if (tagPosition !== "stacked") {
                    tableWrap.querySelectorAll(".value-digits-part").forEach((el: Element) => {
                        (el as HTMLElement).style.width = `${finalDigitsPartW}px`;
                    });
                }

                // Table's real width = exact sum of every computed column -
                // never a percentage, so the browser has no leftover space
                // of its own to redistribute. This is the actual fix for
                // the reported Monthly-column-stretches-on-widen bug.
                const totalTableWidth = naturalLabelW + finalValueW + finalTagColW + finalGoalDeltaW + (finalMonthW * numMonths) + chartW;
                tableEl.style.tableLayout = "fixed";
                tableEl.style.width = `${totalTableWidth}px`;
            }
        }

        // ---- draw trend sparklines (mini chart only, no click behaviour) ---
        if (showTrendChart) {
            const canvases = tableWrap.querySelectorAll(".trend-canvas");
            canvases.forEach((canvasEl: Element) => {
                const canvas = canvasEl as HTMLCanvasElement;
                const idx = Number(canvas.dataset.rowidx);
                const rowData = chartRows.find(c => c.rowIdx === idx);
                if (!rowData) return;
                // Canvas has no fixed CSS width of its own - it fills
                // whatever the chart column's real computed width ends up
                // being (chartColumnWidth, since Trend chart is pinned and
                // never grows/shrinks - see the auto-fit block above). A
                // canvas's drawing buffer doesn't stretch with CSS like a
                // div would, so its width attribute must be set to match
                // the actual rendered width explicitly.
                const renderedWidth = canvas.clientWidth || Math.max(20, chartColumnWidth - 6);
                canvas.width = Math.max(20, renderedWidth);
                drawSparkline(canvas, rowData.actuals, rowData.goals, rowData.cfs, chartSettings, rowData.ctrl);
            });
        }

        // ---- equal row heights: ALWAYS auto-equalized, no manual override
        // exists anymore (v1.19.0.0) - every KPI row is unconditionally
        // forced to match the tallest row's natural content height, every
        // render. rowPaddingV is the only remaining lever for influencing
        // how tall rows are - raising it grows every row's natural content,
        // and this pass still forces them all to match the new tallest.
        {
            const rowEls = tableWrap.querySelectorAll(".kpi-row");
            let maxH = 0;
            rowEls.forEach((r: Element) => { maxH = Math.max(maxH, (r as HTMLElement).offsetHeight); });
            if (maxH > 0) {
                rowEls.forEach((r: Element) => { (r as HTMLElement).style.height = `${maxH}px`; });
            }
        }

        // ---- hover popup: anchored to bottom-center of the monthly cell,
        // no arrow/chip glyph rendered anywhere. Content matches the
        // source's Prior/New/Swing tooltip pattern. ----------------------
        // Default doubled from the original 22px baseline, per explicit
        // request. Label and value now share ONE uniform size - previously
        // the label was ~42% of the value size, which read as mismatched.
        const popupFontSize = Number(getProp(objects, "hoverPopup", "fontSize", 44));
        const cells = tableWrap.querySelectorAll(".mgcell");
        cells.forEach((cellEl: Element) => {
            const cell = cellEl as HTMLElement;
            cell.addEventListener("mouseenter", () => {
                const prior = Number(cell.dataset.prior);
                const cur = Number(cell.dataset.cur);
                const swing = cur - prior;
                // Swing colour reflects ONLY whether the Prior->New movement
                // itself is favourable - the monthly CF code (current
                // absolute position vs. goal) is a different question and
                // must never override this. Polarity here is already
                // resolved server-side: the manual per-row override if set,
                // otherwise auto-detected from the row's own actual/CF
                // history (see detectRowPolarity).
                const polarity = cell.dataset.polarity || "neutral";
                let swingColor: string;
                if (polarity === "moreIsMore") swingColor = swing > 0 ? DELTA_GREEN : swing < 0 ? "#c0342f" : DELTA_NEUTRAL;
                else if (polarity === "lessIsMore") swingColor = swing < 0 ? DELTA_GREEN : swing > 0 ? "#c0342f" : DELTA_NEUTRAL;
                else swingColor = DELTA_NEUTRAL;
                const arrow = swing > 0 ? "\u25B2" : swing < 0 ? "\u25BC" : "";
                const popupCtrl: RowCtrl = {
                    decimalsMode: cell.dataset.decmode || "auto",
                    decimalsMonthly: Number(cell.dataset.decmonthly),
                    decimalsSummary: 0, summaryTag: "", valueUnit: "none",
                    showGoal: false, showActual: true, showDelta: false, noGoal: false, popupPolarity: "cf", summaryMode: "custom", disableCF: false, showChart: true
                };
                const priorTxt = fmtPopupNumber(prior, popupDecimals(prior, popupCtrl));
                const curTxt = fmtPopupNumber(cur, popupDecimals(cur, popupCtrl));
                const swingTxt = `${arrow} ${swing > 0 ? "+" : ""}${fmtPopupNumber(swing, popupDecimals(swing, popupCtrl))}`;
                const makeLine = (label: string, val: string, color?: string): HTMLElement => {
                    const row = document.createElement("div");
                    row.style.cssText = "display:flex;justify-content:space-between;gap:16px;padding:4px 0;";
                    const labelSpan = document.createElement("span");
                    labelSpan.style.cssText = `font-size:${popupFontSize}px;font-weight:bold;color:#8a8a82;`;
                    labelSpan.textContent = label;
                    row.appendChild(labelSpan);
                    const valueSpan = document.createElement("span");
                    valueSpan.style.cssText = `font-size:${popupFontSize}px;font-weight:bold;${color ? `color:${color};` : "color:#1f1f1f;"}`;
                    valueSpan.textContent = val;
                    row.appendChild(valueSpan);
                    return row;
                };
                while (this.tooltipEl.firstChild) {
                    this.tooltipEl.removeChild(this.tooltipEl.firstChild);
                }
                this.tooltipEl.appendChild(makeLine(`Prior (${cell.dataset.pl})`, priorTxt));
                this.tooltipEl.appendChild(makeLine(`New (${cell.dataset.cl})`, curTxt));
                const swingWrap = document.createElement("div");
                swingWrap.style.cssText = "border-top:0.5px solid #ececdf;margin-top:5px;padding-top:6px;";
                swingWrap.appendChild(makeLine("Swing", swingTxt, swingColor));
                this.tooltipEl.appendChild(swingWrap);
                this.tooltipEl.style.display = "block";

                const wrapRect = this.container.getBoundingClientRect();
                const targetRect = this.target.getBoundingClientRect();
                const cellRect = cell.getBoundingClientRect();
                const tipW = this.tooltipEl.offsetWidth;
                const tipH = this.tooltipEl.offsetHeight;
                let left = (cellRect.left - wrapRect.left) + cellRect.width / 2 - tipW / 2;
                left = Math.max(4, Math.min(left, wrapRect.width - tipW - 4));
                this.tooltipEl.style.left = `${left}px`;

                // Flip above the cell if docking below would overflow the
                // visual's visible viewport (not just the scrollable
                // container) - keeps the popup readable without hiding the
                // row that triggered it.
                const wouldOverflowBelow = (cellRect.bottom + tipH + 6) > targetRect.bottom;
                let top: number;
                if (wouldOverflowBelow) {
                    // v1.19.0.0 FIX: previously this computed a position via
                    // cellRect.top - tipH - 6 - a calculated offset that
                    // could go negative (clamped to 4px) whenever the
                    // popup was taller than the space actually available
                    // above the clicked row, landing the popup ON TOP OF
                    // the very row it was meant to clear - confirmed on
                    // rows near the bottom of the matrix.
                    // Fix: anchor to a real DOM boundary instead of a
                    // computed offset - find the row immediately above the
                    // clicked one and dock the popup's BOTTOM edge flush
                    // against THAT row's own top edge (small gap). This
                    // guarantees the clicked row (and the row above it)
                    // both stay fully visible below the popup regardless of
                    // how tall the popup is, since it's anchored to a real
                    // rendered element boundary, not a subtraction that can
                    // go wrong. If there's no row above at all (the clicked
                    // row is the very first one), fall back to the column
                    // header row's own top edge - the next real boundary up.
                    const tr = cell.closest("tr");
                    const rowAboveEl = tr ? (tr.previousElementSibling as HTMLElement | null) : null;
                    const anchorEl = rowAboveEl || (tableWrap.querySelector("thead tr") as HTMLElement | null);
                    const anchorTop = anchorEl ? anchorEl.getBoundingClientRect().top : targetRect.top;
                    top = anchorTop - wrapRect.top - tipH - 6;
                } else {
                    top = cellRect.bottom - wrapRect.top + 6;
                }
                this.tooltipEl.style.top = `${Math.max(4, top)}px`;
            });
            cell.addEventListener("mouseleave", () => {
                this.tooltipEl.style.display = "none";
            });
        });

        // v1.18.0.0: manual drag-to-resize handles removed entirely along
        // with the manual width properties they used to control (Option B,
        // full commit) - column widths are now always auto-fit +
        // shrink-to-fit, with no manual override path. See the auto-fit
        // block above for the full sizing logic.
    }

    // ---- v1.29.3.0-formattingmodel: Formatting Model entry point.
    // ALL 13 objects are now defined in settings.ts (VisualSettingsModel)
    // and populate the format pane through this single method.
    // enumerateObjectInstances() has been removed entirely - it became
    // genuinely dead code the moment this method was introduced (Power
    // BI calls only one or the other for the whole visual, never both),
    // and every object has now been migrated so there was nothing left
    // for it to serve as reference for.
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.settingsModel);
    }

}
