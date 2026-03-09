import { describe, it, expect } from "vitest"
import { parsePlan, detectWeekGroups, tryParseExerciseRow } from "../../src/plan-parser.js"
import type { CellMatrix } from "../../src/types.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a matrix with uniform row width */
function makeMatrix(rows: string[][]): CellMatrix {
    const width = Math.max(...rows.map((r) => r.length))
    return rows.map((r) => {
        const padded = [...r]
        while (padded.length < width) padded.push("")
        return padded
    })
}

// ---------------------------------------------------------------------------
// detectWeekGroups
// ---------------------------------------------------------------------------

describe("detectWeekGroups", () => {
    it("returns empty array for matrix without week labels", () => {
        const matrix = makeMatrix([
            ["", "", "", ""],
            ["DÍA 1", "", "", ""],
            ["A1", "", "Press banca", ""],
        ])
        const groups = detectWeekGroups(matrix)
        expect(groups).toHaveLength(0)
    })

    it("detects SEMANA label and its fields", () => {
        const matrix = makeMatrix([
            ["", "", "", "", "SEMANA 1", "", "", ""],
            ["", "", "", "", "Series", "Reps", "Carga", "RPE"],
        ])
        const groups = detectWeekGroups(matrix)
        expect(groups).toHaveLength(1)
        expect(groups[0].weekLabel).toBe("SEMANA 1")
        expect(groups[0].startColumn).toBe(5)
        expect(groups[0].fields.reps).toBe(6)
        expect(groups[0].fields.carga).toBe(7)
        expect(groups[0].fields.rpe).toBe(8)
    })

    it("each WeekGroup gets its own Series column when Series appears per-week", () => {
        // Series label is to the LEFT of both week labels (shared column, Req 3.5).
        // Series at col index 3 (1-based: 4), SEMANA 1 at col index 4 (startColumn=5),
        // SEMANA 2 at col index 7 (startColumn=8).
        // detectFieldsForWeek now scans left of weekCol for "series",
        // so both weeks find Series at col 4. Propagation also fires since 4 < 5.
        const matrix = makeMatrix([
            ["", "", "", "", "SEMANA 1", "", "", "SEMANA 2", "", "", ""],
            ["", "", "", "Series", "", "Reps", "Carga", "", "Reps", "Carga", "RPE"],
        ])
        const groups = detectWeekGroups(matrix)
        expect(groups).toHaveLength(2)
        // Both groups should share the same Series column (col 4)
        expect(groups[0].fields.series).toBe(4)
        expect(groups[1].fields.series).toBe(4)
    })
})

// ---------------------------------------------------------------------------
// parsePlan — NO_WEEK_GROUPS
// ---------------------------------------------------------------------------

describe("parsePlan", () => {
    it("returns NO_WEEK_GROUPS error when matrix has no week labels", () => {
        const matrix = makeMatrix([
            ["", "", "", ""],
            ["DÍA 1", "", "", ""],
            ["A1", "", "Press banca", ""],
        ])
        const result = parsePlan(matrix, "Hoja1", "spreadsheet-id")
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.code).toBe("NO_WEEK_GROUPS")
        }
    })

    it("ignores exercises that appear before any day block", () => {
        // Week label present, exercise row before any DÍA row
        const matrix = makeMatrix([
            ["", "", "", "", "SEMANA 1", "", "", ""],
            ["", "", "", "", "Series", "Reps", "Carga", "RPE"],
            // Exercise before any day — should be ignored
            ["", "A1", "", "Press banca", "3", "8", "60kg", "8"],
            ["", "DÍA 1", "", "", "", "", "", ""],
            ["", "B1", "", "Sentadilla", "3", "10", "80kg", "7"],
        ])
        const result = parsePlan(matrix, "Hoja1", "id")
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.data.days).toHaveLength(1)
            expect(result.data.days[0].exercises).toHaveLength(1)
            expect(result.data.days[0].exercises[0].code).toBe("B1")
        }
    })

    it("basic fixture: 1 week, 1 day, 2 exercises → correct structure", () => {
        const matrix = makeMatrix([
            ["", "", "", "", "SEMANA 1", "", "", ""],
            ["", "", "", "", "Series", "Reps", "Carga", "RPE"],
            ["", "DÍA 1", "", "", "", "", "", ""],
            ["", "• FULLBODY", "", "", "", "", "", ""],
            ["", "A1", "", "Press banca", "3", "8 x L", "60kg", "8"],
            ["", "A2", "", "Sentadilla", "3", "10", "80kg", "7"],
        ])
        const result = parsePlan(matrix, "Hoja1", "spreadsheet-id")
        expect(result.ok).toBe(true)
        if (!result.ok) return

        const plan = result.data
        expect(plan.spreadsheetId).toBe("spreadsheet-id")
        expect(plan.sheetName).toBe("Hoja1")
        expect(plan.weekGroups).toHaveLength(1)
        expect(plan.weekGroups[0].weekLabel).toBe("SEMANA 1")

        expect(plan.days).toHaveLength(1)
        const day = plan.days[0]
        expect(day.name).toBe("DÍA 1")
        expect(day.subtitle).toBe("• FULLBODY")
        expect(day.exercises).toHaveLength(2)

        const ex1 = day.exercises[0]
        expect(ex1.code).toBe("A1")
        expect(ex1.name).toBe("Press banca")
        expect(ex1.weeks[0].weekLabel).toBe("SEMANA 1")
        expect(ex1.weeks[0].values.reps).toBe("8 x L")
        expect(ex1.weeks[0].values.carga).toBe("60kg")

        const ex2 = day.exercises[1]
        expect(ex2.code).toBe("A2")
        expect(ex2.name).toBe("Sentadilla")
    })
})

// ---------------------------------------------------------------------------
// tryParseExerciseRow — videoUrl capture
// ---------------------------------------------------------------------------

describe("tryParseExerciseRow", () => {
    it("captures videoUrl when there is text between code and name", () => {
        // weekGroups with a single group
        const weekGroups = [
            {
                weekLabel: "SEMANA 1",
                headerRow: 1,
                startColumn: 5,
                fields: { series: 5, reps: 6, carga: 7, rpe: 8 },
            },
        ]
        // The video cell must NOT pass looksLikeExerciseName (which requires length >= 3
        // and not matching column/day/week patterns). A short icon-like value (< 3 chars)
        // will fail the length check, so the parser skips it and finds the name at col+2.
        // row: [empty, code, icon, name, series, reps, carga, rpe]
        const row = ["", "A1", "▶", "Press banca", "3", "8", "60kg", "8"]
        const exercise = tryParseExerciseRow(row, 4, weekGroups)

        expect(exercise).not.toBeNull()
        expect(exercise?.code).toBe("A1")
        expect(exercise?.name).toBe("Press banca")
        expect(exercise?.videoUrl).toBe("▶")
    })

    it("returns null when no exercise code is found", () => {
        const row = ["", "", "Press banca", "", "", "", "", ""]
        const result = tryParseExerciseRow(row, 0, [])
        expect(result).toBeNull()
    })

    it("returns null when no exercise name is found after code", () => {
        const row = ["", "A1", "", "", "", "", "", ""]
        const result = tryParseExerciseRow(row, 0, [])
        expect(result).toBeNull()
    })
})
