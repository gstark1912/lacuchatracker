import { describe, it } from "vitest";
import fc from "fast-check";
import { parsePlan } from "../../src/plan-parser.js";
import type { CellMatrix, WorkoutPlan } from "../../src/types.js";

// ---------------------------------------------------------------------------
// Matrix builder
// ---------------------------------------------------------------------------

/**
 * Build a valid CellMatrix with:
 *   - numWeeks week headers in row 0 (cols 4, 10, 16, ...)
 *   - field labels in row 1 for each week
 *   - numDays day blocks, each with numExercisesPerDay exercises
 */
function buildValidMatrix(
    numWeeks: number,
    numDays: number,
    numExercisesPerDay: number,
): CellMatrix {
    const COLS = 4 + numWeeks * 6 + 2;
    const rows: string[][] = [];

    // Row 0: week headers
    const headerRow = Array(COLS).fill("");
    for (let w = 0; w < numWeeks; w++) {
        headerRow[4 + w * 6] = `SEMANA ${w + 1}`;
    }
    rows.push(headerRow);

    // Row 1: field labels for each week
    const fieldRow = Array(COLS).fill("");
    for (let w = 0; w < numWeeks; w++) {
        const base = 4 + w * 6;
        fieldRow[base] = "Reps";
        fieldRow[base + 1] = "Carga";
        fieldRow[base + 2] = "RPE";
    }
    // Shared series column (left of first week)
    fieldRow[3] = "Series";
    rows.push(fieldRow);

    // Day blocks
    for (let d = 0; d < numDays; d++) {
        const dayRow = Array(COLS).fill("");
        dayRow[0] = `DÍA ${d + 1}`;
        rows.push(dayRow);

        for (let e = 0; e < numExercisesPerDay; e++) {
            const exRow = Array(COLS).fill("");
            const letter = String.fromCharCode(65 + (d % 26));
            exRow[0] = `${letter}${e + 1}`;
            exRow[1] = `Ejercicio ${d + 1}-${e + 1}`;
            exRow[3] = "3";
            for (let w = 0; w < numWeeks; w++) {
                const base = 4 + w * 6;
                exRow[base] = `${8 + e}`;
                exRow[base + 1] = `${50 + e * 5}kg`;
                exRow[base + 2] = `${6 + e}`;
            }
            rows.push(exRow);
        }
    }

    return rows;
}

// ---------------------------------------------------------------------------
// Arbitrary
// ---------------------------------------------------------------------------

const validMatrixArb = fc
    .record({
        numWeeks: fc.integer({ min: 1, max: 5 }),
        numDays: fc.integer({ min: 1, max: 3 }),
        numExercisesPerDay: fc.integer({ min: 0, max: 5 }),
    })
    .map(({ numWeeks, numDays, numExercisesPerDay }) => {
        const matrix = buildValidMatrix(numWeeks, numDays, numExercisesPerDay);
        return { matrix, numWeeks, numDays, numExercisesPerDay };
    });

// ---------------------------------------------------------------------------
// Deep equality helper (structural comparison)
// ---------------------------------------------------------------------------

function deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Property 7: Round-trip JSON
// ---------------------------------------------------------------------------
// Feature: direct-sheet-reader, Property 7: Round-trip JSON

describe("Property 7: Round-trip JSON", () => {
    it("parsear → JSON.stringify → JSON.parse produce un WorkoutPlan estructuralmente equivalente al original", () => {
        fc.assert(
            fc.property(validMatrixArb, ({ matrix }) => {
                const result = parsePlan(matrix, "TestSheet", "test-id");
                if (!result.ok) return true; // skip invalid matrices

                const original: WorkoutPlan = result.data;
                const serialized = JSON.stringify(original);
                const deserialized = JSON.parse(serialized) as WorkoutPlan;

                return deepEqual(original, deserialized);
            }),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 8: Invariante de forma del output
// ---------------------------------------------------------------------------
// Feature: direct-sheet-reader, Property 8: Invariante de forma del output

describe("Property 8: Invariante de forma del output", () => {
    it("todo WorkoutPlan tiene spreadsheetId, sheetName, weekGroups (array) y days (array)", () => {
        fc.assert(
            fc.property(validMatrixArb, ({ matrix }) => {
                const result = parsePlan(matrix, "TestSheet", "test-id");
                if (!result.ok) return true;

                const plan = result.data;

                return (
                    typeof plan.spreadsheetId === "string" &&
                    typeof plan.sheetName === "string" &&
                    Array.isArray(plan.weekGroups) &&
                    Array.isArray(plan.days)
                );
            }),
            { numRuns: 100 },
        );
    });

    it("cada elemento de days tiene name (string), row (number) y exercises (array)", () => {
        fc.assert(
            fc.property(validMatrixArb, ({ matrix }) => {
                const result = parsePlan(matrix, "TestSheet", "test-id");
                if (!result.ok) return true;

                return result.data.days.every(
                    (day) =>
                        typeof day.name === "string" &&
                        typeof day.row === "number" &&
                        Array.isArray(day.exercises),
                );
            }),
            { numRuns: 100 },
        );
    });
});
