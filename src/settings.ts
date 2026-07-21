"use strict";

import powerbi from "powerbi-visuals-api";
import {
    formattingSettings
} from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsCompositeCard = formattingSettings.CompositeCard;
import FormattingSettingsGroup = formattingSettings.Group;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

// ---------------------------------------------------------------------
// v1.29.3.0-formattingmodel — MIGRATION COMPLETE. All 13 objects now
// have a Card here. enumerateObjectInstances() in visual.ts is now
// genuinely dead code (Power BI never calls it once getFormattingModel()
// exists) and can be removed - see the migration plan's Step 5.
//
// CRITICAL CONSTRAINT, confirmed against the actual installed library
// types: Power BI's runtime treats getFormattingModel() and
// enumerateObjectInstances() as MUTUALLY EXCLUSIVE FOR THE WHOLE VISUAL,
// not per-object. The moment visual.ts implements getFormattingModel(),
// Power BI stops calling enumerateObjectInstances() entirely - for every
// object, not just the ones migrated so far. There is no per-object
// hybrid mode.
//
// That means THIS PARTICULAR BUILD, with only hoverPopup migrated, will
// show ONLY the "Hover popup" card in the format pane - the other 12
// objects' controls will not appear at all, even though their
// capabilities.json declarations and enumerateObjectInstances() cases
// still exist untouched in visual.ts. This is expected and correct for
// a proof-of-concept build, but this build must NOT be treated as a
// production replacement for the real v1.28.x line until every
// remaining object (see the migration plan) has an equivalent Card
// defined here and getFormattingModel() aggregates all of them.
// ---------------------------------------------------------------------

class HoverPopupCardSettings extends FormattingSettingsCard {
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Hover popup font size",
        value: 44
    });

    name: string = "hoverPopup";
    displayName: string = "Hover popup";
    slices: Array<FormattingSettingsSlice> = [this.fontSize];
}

class LayoutCardSettings extends FormattingSettingsCard {
    rowPaddingV = new formattingSettings.NumUpDown({
        name: "rowPaddingV",
        displayName: "Row padding - vertical (px)",
        value: 6
    });
    rowPaddingH = new formattingSettings.NumUpDown({
        name: "rowPaddingH",
        displayName: "Row padding - horizontal (px)",
        value: 8
    });
    showKpiNumbers = new formattingSettings.ToggleSwitch({
        name: "showKpiNumbers",
        displayName: "Developer: show KPI numbers",
        value: false
    });
    showSummaryColumn = new formattingSettings.ToggleSwitch({
        name: "showSummaryColumn",
        displayName: "Show summary column",
        value: true
    });
    alternateRowShading = new formattingSettings.ToggleSwitch({
        name: "alternateRowShading",
        displayName: "Alternate row shading",
        value: true
    });
    showFutureMonths = new formattingSettings.ToggleSwitch({
        name: "showFutureMonths",
        displayName: "Show future months",
        value: true
    });

    name: string = "layout";
    displayName: string = "Layout";
    slices: Array<FormattingSettingsSlice> = [
        this.rowPaddingV,
        this.rowPaddingH,
        this.showKpiNumbers,
        this.showSummaryColumn,
        this.alternateRowShading,
        this.showFutureMonths
    ];
}

class MonthlyValuesCardSettings extends FormattingSettingsCard {
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Monthly values font size",
        value: 22
    });
    bold = new formattingSettings.ToggleSwitch({
        name: "bold",
        displayName: "Bold",
        value: true
    });

    name: string = "monthlyValues";
    displayName: string = "Monthly values";
    slices: Array<FormattingSettingsSlice> = [this.fontSize, this.bold];
}

class ChartStyleCardSettings extends FormattingSettingsCard {
    showTrendChart = new formattingSettings.ToggleSwitch({
        name: "showTrendChart",
        displayName: "Show trend chart column",
        value: false
    });
    chartColumnWidth = new formattingSettings.NumUpDown({
        name: "chartColumnWidth",
        displayName: "Trend chart column width",
        value: 180
    });
    showGoalLine = new formattingSettings.ToggleSwitch({
        name: "showGoalLine",
        displayName: "Show goal line",
        value: true
    });
    positiveLineColor = new formattingSettings.ColorPicker({
        name: "positiveLineColor",
        displayName: "Positive line colour",
        value: { value: "#000000" }
    });
    negativeLineColor = new formattingSettings.ColorPicker({
        name: "negativeLineColor",
        displayName: "Negative line colour",
        value: { value: "#D64550" }
    });
    actualLineThickness = new formattingSettings.NumUpDown({
        name: "actualLineThickness",
        displayName: "Actual line thickness",
        value: 2
    });
    actualLineSmooth = new formattingSettings.ToggleSwitch({
        name: "actualLineSmooth",
        displayName: "Smooth line",
        value: false
    });
    goalLineColor = new formattingSettings.ColorPicker({
        name: "goalLineColor",
        displayName: "Goal line colour",
        value: { value: "#888888" }
    });
    goalLineThickness = new formattingSettings.NumUpDown({
        name: "goalLineThickness",
        displayName: "Goal line thickness",
        value: 2
    });
    // v1.29.4.0: now a genuine capabilities.json enumeration
    // (dashed/dotted/solid) instead of free text - AutoDropdown pulls
    // its item list directly from that declaration, same pattern as
    // every other true enumeration in this project. Render logic in
    // visual.ts (the dash === "dashed"/"dotted" check, falling through
    // to solid otherwise) is unchanged - "solid" as an explicit stored
    // value now hits that same fallthrough correctly.
    goalLineStyle = new formattingSettings.AutoDropdown({
        name: "goalLineStyle",
        displayName: "Goal line style",
        value: "dashed"
    });
    showDataPoints = new formattingSettings.ToggleSwitch({
        name: "showDataPoints",
        displayName: "Show data points",
        value: true
    });
    dataPointSize = new formattingSettings.NumUpDown({
        name: "dataPointSize",
        displayName: "Data point size",
        value: 3
    });
    fillArea = new formattingSettings.ToggleSwitch({
        name: "fillArea",
        displayName: "Fill area",
        value: true
    });
    showReportedMonthsOnly = new formattingSettings.ToggleSwitch({
        name: "showReportedMonthsOnly",
        displayName: "Show reported months only",
        value: true
    });
    monthLetterFontSize = new formattingSettings.NumUpDown({
        name: "monthLetterFontSize",
        displayName: "Month letter font size (chart)",
        value: 8
    });

    name: string = "chartStyle";
    displayName: string = "Trend chart";
    slices: Array<FormattingSettingsSlice> = [
        this.showTrendChart,
        this.chartColumnWidth,
        this.showGoalLine,
        this.positiveLineColor,
        this.negativeLineColor,
        this.actualLineThickness,
        this.actualLineSmooth,
        this.goalLineColor,
        this.goalLineThickness,
        this.goalLineStyle,
        this.showDataPoints,
        this.dataPointSize,
        this.fillArea,
        this.showReportedMonthsOnly,
        this.monthLetterFontSize
    ];
}

class GridLinesCardSettings extends FormattingSettingsCard {
    showRowGridlines = new formattingSettings.ToggleSwitch({
        name: "showRowGridlines",
        displayName: "Show row gridlines",
        value: true
    });
    rowGridlineColor = new formattingSettings.ColorPicker({
        name: "rowGridlineColor",
        displayName: "Row gridline color",
        value: { value: "#000000" }
    });
    rowGridlineThickness = new formattingSettings.NumUpDown({
        name: "rowGridlineThickness",
        displayName: "Row gridline thickness",
        value: 1
    });
    showColGridlines = new formattingSettings.ToggleSwitch({
        name: "showColGridlines",
        displayName: "Show column gridlines",
        value: true
    });
    colGridlineColor = new formattingSettings.ColorPicker({
        name: "colGridlineColor",
        displayName: "Column gridline color",
        value: { value: "#000000" }
    });
    colGridlineThickness = new formattingSettings.NumUpDown({
        name: "colGridlineThickness",
        displayName: "Column gridline thickness",
        value: 1
    });
    showKpiRowDivider = new formattingSettings.ToggleSwitch({
        name: "showKpiRowDivider",
        displayName: "Show bold KPI row divider",
        value: true
    });
    kpiRowDividerThickness = new formattingSettings.NumUpDown({
        name: "kpiRowDividerThickness",
        displayName: "KPI row divider thickness",
        value: 2
    });
    kpiRowDividerColor = new formattingSettings.ColorPicker({
        name: "kpiRowDividerColor",
        displayName: "KPI row divider color",
        value: { value: "#000000" }
    });

    name: string = "gridLines";
    displayName: string = "Grid lines";
    slices: Array<FormattingSettingsSlice> = [
        this.showRowGridlines,
        this.rowGridlineColor,
        this.rowGridlineThickness,
        this.showColGridlines,
        this.colGridlineColor,
        this.colGridlineThickness,
        this.showKpiRowDivider,
        this.kpiRowDividerThickness,
        this.kpiRowDividerColor
    ];
}

class ConditionalFormattingCardSettings extends FormattingSettingsCard {
    positiveColor = new formattingSettings.ColorPicker({
        name: "positiveColor",
        displayName: "Positive color",
        value: { value: "#92D050" }
    });
    negativeColor = new formattingSettings.ColorPicker({
        name: "negativeColor",
        displayName: "Negative color",
        value: { value: "#D64550" }
    });
    positiveFontColor = new formattingSettings.ColorPicker({
        name: "positiveFontColor",
        displayName: "Positive font color",
        value: { value: "#000000" }
    });
    negativeFontColor = new formattingSettings.ColorPicker({
        name: "negativeFontColor",
        displayName: "Negative font color",
        value: { value: "#FFFFFF" }
    });

    name: string = "conditionalFormatting";
    displayName: string = "Conditional formatting";
    slices: Array<FormattingSettingsSlice> = [
        this.positiveColor,
        this.negativeColor,
        this.positiveFontColor,
        this.negativeFontColor
    ];
}

class KpiRowHeadersCardSettings extends FormattingSettingsCard {
    // v1.29.4.0: fontFamily/fontSize/bold consolidated into a single
    // FontControl composite slice - one combined font picker control in
    // the format pane instead of three separate rows. Each sub-part's
    // `name` still matches the exact capabilities.json property name
    // (fontFamily/fontSize/bold) it persists to - FontControl's own
    // `name` ("font") is just an internal UI identifier, not tied to any
    // capabilities property itself.
    font = new formattingSettings.FontControl({
        name: "font",
        displayName: "Row label font",
        fontFamily: new formattingSettings.FontPicker({
            name: "fontFamily",
            value: "Arial"
        }),
        fontSize: new formattingSettings.NumUpDown({
            name: "fontSize",
            value: 20
        }),
        bold: new formattingSettings.ToggleSwitch({
            name: "bold",
            value: true
        })
    });
    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Row label text color",
        value: { value: "#000000" }
    });
    wrapText = new formattingSettings.ToggleSwitch({
        name: "wrapText",
        displayName: "Wrap text",
        value: false
    });
    // AutoDropdown pulls its item list (Left/Center/Right) directly from
    // the "alignment" enumeration already declared in capabilities.json -
    // no need to redeclare the options here, matching the current
    // approach (as opposed to ItemDropdown, which needs the list in code).
    alignment = new formattingSettings.AutoDropdown({
        name: "alignment",
        displayName: "Row label alignment",
        value: "left"
    });

    name: string = "kpiRowHeaders";
    displayName: string = "KPI row headers";
    slices: Array<FormattingSettingsSlice> = [
        this.font,
        this.color,
        this.wrapText,
        this.alignment
    ];
}

class ColumnHeadersCardSettings extends FormattingSettingsCard {
    // v1.29.4.0: fontFamily/fontSize/bold consolidated into a FontControl
    // composite, same as kpiRowHeaders. Site Name's own fontSize/bold
    // stay as SEPARATE slices below (not combined) - there is no
    // siteNameFontFamily property in capabilities.json to pair with
    // them, and FontControl requires a fontFamily sub-part.
    font = new formattingSettings.FontControl({
        name: "font",
        displayName: "Column header font",
        fontFamily: new formattingSettings.FontPicker({
            name: "fontFamily",
            value: "Arial"
        }),
        fontSize: new formattingSettings.NumUpDown({
            name: "fontSize",
            value: 11
        }),
        bold: new formattingSettings.ToggleSwitch({
            name: "bold",
            value: true
        })
    });
    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Column header text color",
        value: { value: "#000000" }
    });
    background = new formattingSettings.ColorPicker({
        name: "background",
        displayName: "Background",
        value: { value: "#ffffff" }
    });
    alignment = new formattingSettings.AutoDropdown({
        name: "alignment",
        displayName: "Column header alignment",
        value: "center"
    });
    siteNameFontSize = new formattingSettings.NumUpDown({
        name: "siteNameFontSize",
        displayName: "Site Name font size",
        value: 14
    });
    siteNameBold = new formattingSettings.ToggleSwitch({
        name: "siteNameBold",
        displayName: "Site Name bold",
        value: true
    });
    siteNameColor = new formattingSettings.ColorPicker({
        name: "siteNameColor",
        displayName: "Site Name text color",
        value: { value: "#000000" }
    });
    siteNameAlignment = new formattingSettings.AutoDropdown({
        name: "siteNameAlignment",
        displayName: "Site Name alignment",
        value: "left"
    });
    // Default "no colour" - matches getColorProp's "" -> transparent
    // fallback in visual.ts. isNoFillItemSupported lets the picker
    // genuinely offer a "no fill" option rather than forcing a hex value.
    siteNameBackground = new formattingSettings.ColorPicker({
        name: "siteNameBackground",
        displayName: "Site Name cell background (default: no colour)",
        value: { value: "" },
        isNoFillItemSupported: true
    });

    name: string = "columnHeaders";
    displayName: string = "Column headers";
    slices: Array<FormattingSettingsSlice> = [
        this.font,
        this.color,
        this.background,
        this.alignment,
        this.siteNameFontSize,
        this.siteNameBold,
        this.siteNameColor,
        this.siteNameAlignment,
        this.siteNameBackground
    ];
}

class SummaryColumnCardSettings extends FormattingSettingsCard {
    headerLabel = new formattingSettings.TextInput({
        name: "headerLabel",
        displayName: "Header label",
        value: "Summary",
        placeholder: "Summary"
    });
    headerBold = new formattingSettings.ToggleSwitch({
        name: "headerBold",
        displayName: "Header bold",
        value: true
    });
    showGoalDeltaColumn = new formattingSettings.ToggleSwitch({
        name: "showGoalDeltaColumn",
        displayName: "Show Goal/Delta column",
        value: true
    });
    valueFontSize = new formattingSettings.NumUpDown({
        name: "valueFontSize",
        displayName: "Value font size",
        value: 22
    });
    goalDeltaFontSize = new formattingSettings.NumUpDown({
        name: "goalDeltaFontSize",
        displayName: "Goal/Delta font size (also used for NA)",
        value: 20
    });
    goalDeltaLayout = new formattingSettings.AutoDropdown({
        name: "goalDeltaLayout",
        displayName: "Goal/Delta layout",
        value: "oneLine"
    });
    tagPosition = new formattingSettings.AutoDropdown({
        name: "tagPosition",
        displayName: "Tag position",
        value: "stacked"
    });
    tagFontSize = new formattingSettings.NumUpDown({
        name: "tagFontSize",
        displayName: "Tag font size",
        value: 8
    });

    name: string = "summaryColumn";
    displayName: string = "Summary column \u2014 global settings";
    slices: Array<FormattingSettingsSlice> = [
        this.headerLabel,
        this.headerBold,
        this.showGoalDeltaColumn,
        this.valueFontSize,
        this.goalDeltaFontSize,
        this.goalDeltaLayout,
        this.tagPosition,
        this.tagFontSize
    ];
}

// ---- the four "big repeating" objects - CompositeCards with one
// collapsible Group per KPI/section, built via loops matching the same
// shape as the old enumerateObjectInstances loops (kpi1..kpi30,
// s1..s12), rather than 30 or 12 hand-written near-identical blocks.
// Using CompositeCard (multiple named Groups) instead of SimpleCard
// (one flat list) also delivers a real UX upgrade as a side effect:
// each KPI/section becomes its own collapsible group in the format
// pane, instead of one very long flat property list - this was already
// flagged as a separate wishlist item before the migration started.

// v1.29.7.0: the three separate Row Level Control cards (Decimals,
// Summary display, Behaviour) are consolidated into ONE card here,
// matching the single "rowLevelControl" capabilities.json object.
// Within each KPI's group, the 13 controls are organized LEFT TO RIGHT
// by which part of the rendered visual they actually affect - not by
// control type (toggle/dropdown) - separated by ReadOnlyText divider
// lines rather than real controls. Three properties (decimalsMode,
// valueUnit, popupPolarity) affect BOTH monthly cells and the Summary
// column - confirmed against the actual render code, not assumed - so
// they sit in their own "Global Settings" block first, ahead of the
// monthly/summary-specific blocks.
//
// v1.29.9.0: ROLLED BACK to this exact v1.29.7.0 structure after a
// v1.29.8.0 attempt moved Global Settings into its own separate
// top-level group - explicitly rejected, reverted back to this. See
// README_BUILD.txt for the rollback note.
class RowLevelControlCardSettings extends FormattingSettingsCompositeCard {
    name: string = "rowLevelControl";
    displayName: string = "Row Level Control";
    groups: Array<FormattingSettingsGroup> = [];

    constructor() {
        super();
        for (let n = 1; n <= 30; n++) {
            const globalHeader = new formattingSettings.ReadOnlyText({
                name: `kpi${n}globalHeader`,
                value: "----- Monthly and Summary Global Settings -----"
            });
            const decimalsMode = new formattingSettings.AutoDropdown({
                name: `kpi${n}decimalsMode`,
                displayName: "Decimals mode",
                value: "auto"
            });
            const valueUnit = new formattingSettings.AutoDropdown({
                name: `kpi${n}valueUnit`,
                displayName: "Value unit",
                value: "none"
            });
            const popupPolarity = new formattingSettings.AutoDropdown({
                name: `kpi${n}popupPolarity`,
                displayName: "Popup polarity",
                value: "cf"
            });

            const monthlyHeader = new formattingSettings.ReadOnlyText({
                name: `kpi${n}monthlyHeader`,
                value: "----- Monthly Value Columns -----"
            });
            const decimalsMonthly = new formattingSettings.NumUpDown({
                name: `kpi${n}decimalsMonthly`,
                displayName: "Custom decimals (monthly)",
                value: -1
            });
            const disableCF = new formattingSettings.ToggleSwitch({
                name: `kpi${n}disableCF`,
                displayName: "Disable conditional formatting",
                value: false
            });

            const col1Header = new formattingSettings.ReadOnlyText({
                name: `kpi${n}col1Header`,
                value: "----- Summary \u2014 Value (Col 1) -----"
            });
            const showActual = new formattingSettings.ToggleSwitch({
                name: `kpi${n}showActual`,
                displayName: "Show actual value",
                value: true
            });
            const summaryMode = new formattingSettings.AutoDropdown({
                name: `kpi${n}summaryMode`,
                displayName: "Summary mode",
                value: "priorMonth"
            });
            const decimalsSummary = new formattingSettings.NumUpDown({
                name: `kpi${n}decimalsSummary`,
                displayName: "Summary decimals",
                value: -1
            });

            const col2Header = new formattingSettings.ReadOnlyText({
                name: `kpi${n}col2Header`,
                value: "----- Summary \u2014 Tag (Col 2) -----"
            });
            const summaryTag = new formattingSettings.TextInput({
                name: `kpi${n}summaryTag`,
                displayName: "Summary tag",
                value: "",
                placeholder: "e.g. YTD"
            });

            const col3Header = new formattingSettings.ReadOnlyText({
                name: `kpi${n}col3Header`,
                value: "----- Summary \u2014 Goal/Delta (Col 3) -----"
            });
            const noGoal = new formattingSettings.ToggleSwitch({
                name: `kpi${n}noGoal`,
                displayName: "No goal",
                value: false
            });
            const showGoal = new formattingSettings.ToggleSwitch({
                name: `kpi${n}showGoal`,
                displayName: "Show goal",
                value: true
            });
            const showDelta = new formattingSettings.ToggleSwitch({
                name: `kpi${n}showDelta`,
                displayName: "Show delta",
                value: true
            });

            const chartHeader = new formattingSettings.ReadOnlyText({
                name: `kpi${n}chartHeader`,
                value: "----- Trend Chart -----"
            });
            const showChart = new formattingSettings.ToggleSwitch({
                name: `kpi${n}showChart`,
                displayName: "Show trend chart",
                value: true
            });

            this.groups.push(new FormattingSettingsGroup({
                name: `kpi${n}Group`,
                displayName: `KPI ${n}`,
                collapsible: true,
                slices: [
                    globalHeader, decimalsMode, valueUnit, popupPolarity,
                    monthlyHeader, decimalsMonthly, disableCF,
                    col1Header, showActual, summaryMode, decimalsSummary,
                    col2Header, summaryTag,
                    col3Header, noGoal, showGoal, showDelta,
                    chartHeader, showChart
                ]
            }));
        }
    }
}

class SectionHeadersCardSettings extends FormattingSettingsCompositeCard {
    name: string = "sectionHeaders";
    displayName: string = "Section headers";
    groups: Array<FormattingSettingsGroup> = [];

    constructor() {
        super();
        // Global settings group first (unchanged from before - 4
        // properties, global not per-section), then one collapsible
        // group per section slot (s1..s12, reduced from 25 in v1.28.0.0).
        const sectionFontSize = new formattingSettings.NumUpDown({
            name: "sectionFontSize",
            displayName: "Section font size (global)",
            value: 12
        });
        const sectionFontFamily = new formattingSettings.FontPicker({
            name: "sectionFontFamily",
            displayName: "Section font family (global)",
            value: "Arial"
        });
        const sectionBold = new formattingSettings.ToggleSwitch({
            name: "sectionBold",
            displayName: "Section bold (global)",
            value: true
        });
        const sectionPaddingV = new formattingSettings.NumUpDown({
            name: "sectionPaddingV",
            displayName: "Section row padding (top/bottom, px)",
            value: 5
        });
        this.groups.push(new FormattingSettingsGroup({
            name: "globalGroup",
            displayName: "Global settings",
            collapsible: true,
            slices: [sectionFontSize, sectionFontFamily, sectionBold, sectionPaddingV]
        }));

        for (let n = 1; n <= 12; n++) {
            const pos = new formattingSettings.NumUpDown({
                name: `s${n}pos`,
                displayName: "Row position",
                // v1.29.3.0: NumUpDown's value type is a plain number,
                // not nullable - 0 is used as the "not positioned"
                // sentinel here, matching readSections()'s existing
                // `pos >= 1` check (0 already fails that check exactly
                // like the old getProp(..., null) default did).
                value: 0
            });
            const label = new formattingSettings.TextInput({
                name: `s${n}label`,
                displayName: "Label",
                value: "",
                placeholder: "e.g. SAFETY"
            });
            const color = new formattingSettings.ColorPicker({
                name: `s${n}color`,
                displayName: "Color",
                value: { value: "#D64550" }
            });
            const bgColor = new formattingSettings.ColorPicker({
                name: `s${n}bgColor`,
                displayName: "Background color",
                value: { value: "#FFFFFF" }
            });
            this.groups.push(new FormattingSettingsGroup({
                name: `s${n}Group`,
                displayName: `Section ${n}`,
                collapsible: true,
                slices: [pos, label, color, bgColor]
            }));
        }
    }
}

export class VisualSettingsModel extends FormattingSettingsModel {
    hoverPopupCard = new HoverPopupCardSettings();
    layoutCard = new LayoutCardSettings();
    monthlyValuesCard = new MonthlyValuesCardSettings();
    chartStyleCard = new ChartStyleCardSettings();
    gridLinesCard = new GridLinesCardSettings();
    conditionalFormattingCard = new ConditionalFormattingCardSettings();
    kpiRowHeadersCard = new KpiRowHeadersCardSettings();
    columnHeadersCard = new ColumnHeadersCardSettings();
    summaryColumnCard = new SummaryColumnCardSettings();
    rowLevelControlCard = new RowLevelControlCardSettings();
    sectionHeadersCard = new SectionHeadersCardSettings();

    // v1.29.7.0: 11 cards total - the three separate Row Level Control
    // cards were consolidated into one (rowLevelControl).
    cards = [
        this.hoverPopupCard,
        this.layoutCard,
        this.monthlyValuesCard,
        this.chartStyleCard,
        this.gridLinesCard,
        this.conditionalFormattingCard,
        this.kpiRowHeadersCard,
        this.columnHeadersCard,
        this.summaryColumnCard,
        this.rowLevelControlCard,
        this.sectionHeadersCard
    ];
}
