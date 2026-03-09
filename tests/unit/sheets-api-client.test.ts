import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock googleapis before importing the module under test
vi.mock("googleapis", () => {
    const mockGet = vi.fn()
    const mockSheets = vi.fn(() => ({
        spreadsheets: {
            values: {
                get: mockGet,
            },
        },
    }))

    return {
        google: {
            auth: {
                fromAPIKey: vi.fn(() => ({})),
                GoogleAuth: vi.fn(() => ({})),
            },
            sheets: mockSheets,
        },
        __mockGet: mockGet,
    }
})

import { fetchSheet } from "../../src/sheets-api-client.js"
import { google } from "googleapis"

// Helper to get the inner mock
function getMockGet() {
    // Access via the sheets mock instance
    const sheetsInstance = (google.sheets as ReturnType<typeof vi.fn>).mock.results[
        (google.sheets as ReturnType<typeof vi.fn>).mock.results.length - 1
    ]?.value
    return sheetsInstance?.spreadsheets?.values?.get as ReturnType<typeof vi.fn>
}

const baseOptions = {
    spreadsheetId: "spreadsheet-id",
    sheetName: "Sheet1",
    auth: { apiKey: "test-key" },
}

describe("fetchSheet", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("maps 401 response to AUTH_ERROR", async () => {
        const sheetsInstance = {
            spreadsheets: { values: { get: vi.fn() } },
        }
            ; (google.sheets as ReturnType<typeof vi.fn>).mockReturnValue(sheetsInstance)
        sheetsInstance.spreadsheets.values.get.mockRejectedValue({
            response: { status: 401 },
            message: "Unauthorized",
        })

        const result = await fetchSheet(baseOptions)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.code).toBe("AUTH_ERROR")
        }
    })

    it("maps 403 response to AUTH_ERROR", async () => {
        const sheetsInstance = {
            spreadsheets: { values: { get: vi.fn() } },
        }
            ; (google.sheets as ReturnType<typeof vi.fn>).mockReturnValue(sheetsInstance)
        sheetsInstance.spreadsheets.values.get.mockRejectedValue({
            response: { status: 403 },
            message: "Forbidden",
        })

        const result = await fetchSheet(baseOptions)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.code).toBe("AUTH_ERROR")
        }
    })

    it("maps 404 response to SPREADSHEET_NOT_FOUND", async () => {
        const sheetsInstance = {
            spreadsheets: { values: { get: vi.fn() } },
        }
            ; (google.sheets as ReturnType<typeof vi.fn>).mockReturnValue(sheetsInstance)
        sheetsInstance.spreadsheets.values.get.mockRejectedValue({
            response: { status: 404 },
            message: "Not Found",
        })

        const result = await fetchSheet(baseOptions)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.code).toBe("SPREADSHEET_NOT_FOUND")
        }
    })

    it("returns SHEET_NOT_FOUND when values response is empty", async () => {
        const sheetsInstance = {
            spreadsheets: { values: { get: vi.fn() } },
        }
            ; (google.sheets as ReturnType<typeof vi.fn>).mockReturnValue(sheetsInstance)
        sheetsInstance.spreadsheets.values.get.mockResolvedValue({
            data: { values: [] },
        })

        const result = await fetchSheet(baseOptions)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.code).toBe("SHEET_NOT_FOUND")
        }
    })

    it("returns SHEET_NOT_FOUND when values is null/undefined", async () => {
        const sheetsInstance = {
            spreadsheets: { values: { get: vi.fn() } },
        }
            ; (google.sheets as ReturnType<typeof vi.fn>).mockReturnValue(sheetsInstance)
        sheetsInstance.spreadsheets.values.get.mockResolvedValue({
            data: { values: null },
        })

        const result = await fetchSheet(baseOptions)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.code).toBe("SHEET_NOT_FOUND")
        }
    })

    it("normalizes short rows by padding with empty strings", async () => {
        const sheetsInstance = {
            spreadsheets: { values: { get: vi.fn() } },
        }
            ; (google.sheets as ReturnType<typeof vi.fn>).mockReturnValue(sheetsInstance)
        // Row 0 has 4 cells, row 1 has 2 cells — should be padded to width 4
        sheetsInstance.spreadsheets.values.get.mockResolvedValue({
            data: {
                values: [
                    ["A", "B", "C", "D"],
                    ["X", "Y"],
                ],
            },
        })

        const result = await fetchSheet(baseOptions)

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.data[0]).toEqual(["A", "B", "C", "D"])
            expect(result.data[1]).toEqual(["X", "Y", "", ""])
        }
    })
})
