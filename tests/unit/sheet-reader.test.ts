import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../src/sheets-api-client.js", () => ({
    fetchSheet: vi.fn(),
}))

import { readSheet, readSheetToJson } from "../../src/sheet-reader.js"
import { fetchSheet } from "../../src/sheets-api-client.js"
import type { CellMatrix, SheetReaderConfig } from "../../src/types.js"

// ---------------------------------------------------------------------------
// Fixture Cell_Matrix
// ---------------------------------------------------------------------------

const fixtureMatrix: CellMatrix = [
    ["", "", "", "", "SEMANA 1", "", "", ""],
    ["", "", "", "", "Series", "Reps", "Carga", "RPE"],
    ["", "DÍA 1", "", "", "", "", "", ""],
    ["", "• FULLBODY", "", "", "", "", "", ""],
    ["", "A1", "", "Press banca", "3", "8 x L", "60kg", "8"],
]

const config: SheetReaderConfig = {
    source: {
        type: "sheets-api",
        spreadsheetId: "test-spreadsheet-id",
        sheetName: "Hoja1",
        auth: { apiKey: "test-key" },
    },
}

describe("readSheet", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("returns a WorkoutPlan with correct structure from fixture matrix", async () => {
        ; (fetchSheet as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: fixtureMatrix,
        })

        const result = await readSheet(config)

        expect(result.ok).toBe(true)
        if (!result.ok) return

        const plan = result.data

        // Top-level fields
        expect(plan.spreadsheetId).toBe("test-spreadsheet-id")
        expect(plan.sheetName).toBe("Hoja1")

        // Week groups
        expect(plan.weekGroups).toHaveLength(1)
        expect(plan.weekGroups[0].weekLabel).toBe("SEMANA 1")
        expect(plan.weekGroups[0].startColumn).toBe(5)

        // Days
        expect(plan.days).toHaveLength(1)
        const day = plan.days[0]
        expect(day.name).toBe("DÍA 1")
        expect(day.subtitle).toBe("• FULLBODY")

        // Exercises
        expect(day.exercises).toHaveLength(1)
        const ex = day.exercises[0]
        expect(ex.code).toBe("A1")
        expect(ex.name).toBe("Press banca")
        expect(ex.row).toBe(5)

        // Week values
        expect(ex.weeks).toHaveLength(1)
        expect(ex.weeks[0].weekLabel).toBe("SEMANA 1")
        expect(ex.weeks[0].values.reps).toBe("8 x L")
        expect(ex.weeks[0].values.carga).toBe("60kg")
        expect(ex.weeks[0].values.rpe).toBe("8")
    })

    it("propagates fetchSheet error without modification", async () => {
        ; (fetchSheet as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            error: { code: "AUTH_ERROR", message: "Unauthorized" },
        })

        const result = await readSheet(config)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.code).toBe("AUTH_ERROR")
        }
    })
})

describe("readSheetToJson", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("returns a valid JSON string with correct structure", async () => {
        ; (fetchSheet as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            data: fixtureMatrix,
        })

        const result = await readSheetToJson(config)

        expect(result.ok).toBe(true)
        if (!result.ok) return

        // Must be valid JSON
        const parsed = JSON.parse(result.data)

        expect(parsed).toHaveProperty("spreadsheetId", "test-spreadsheet-id")
        expect(parsed).toHaveProperty("sheetName", "Hoja1")
        expect(parsed).toHaveProperty("weekGroups")
        expect(parsed).toHaveProperty("days")
        expect(Array.isArray(parsed.weekGroups)).toBe(true)
        expect(Array.isArray(parsed.days)).toBe(true)
        expect(parsed.days[0].exercises[0].code).toBe("A1")
    })

    it("returns error result when fetchSheet fails", async () => {
        ; (fetchSheet as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            error: { code: "SPREADSHEET_NOT_FOUND", message: "Not found" },
        })

        const result = await readSheetToJson(config)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.code).toBe("SPREADSHEET_NOT_FOUND")
        }
    })
})
