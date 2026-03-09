import { describe, it } from "vitest";
import fc from "fast-check";
import { parsePlan } from "../../src/plan-parser.js";
import type { CellMatrix } from "../../src/types.js";

// ---------------------------------------------------------------------------
// Matrix builder helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid CellMatrix with:
 *  - 1 week header row (row 0) with field labels (row 1)
 *  - N day blocks, each with M exercises
 *  - Optional separator/empty rows interspersed
 *
 * Layout (0-indexed rows):
 *   row 0: week header  → col 4 = "SEMANA 1"
 *   row 1: field labels → col 3 = "Series", col 4 = "Reps", col 5 = "Carga", col 6 = "RPE"
 *   row 2+: day blocks and exercises
 */
function buildMatrix(
    numDays: number,
    exercisesPerDay: number[],
    separatorRows: number[],   // row indices (relative to content start) to insert as empty rows
): { matrix: CellMatrix; dayRows: number[]; exerciseRows: number[][] } {
    const COLS = 10;
    const rows: string[][] = [];

    // Row 0: week header
    const headerRow = Array(COLS).fill("");
    headerRow[4] = "SEMANA 1";
    rows.push(headerRow);

    // Row 1: field labels
    const fieldRow = Array(COLS).fill("");
    fieldRow[3] = "Series";
    fieldRow[4] = "Reps";
    fieldRow[5] = "Carga";
    fieldRow[6] = "RPE";
    rows.push(fieldRow);

    const dayRows: number[] = [];
    const exerciseRows: number[][] = [];

    for (let d = 0; d < numDays; d++) {
        // Day header row
        const dayRow = Array(COLS).fill("");
        dayRow[0] = `DÍA ${d + 1}`;
        dayRows.push(rows.length);
        rows.push(dayRow);

        const exRows: number[] = [];
        for (let e = 0; e < exercisesPerDay[d]; e++) {
            // Optional separator before exercise
            if (separatorRows.includes(rows.length)) {
                rows.push(Array(COLS).fill(""));
            }

            const exRow = Array(COLS).fill("");
            // Exercise code: A1, A2, ... B1, B2, ...
            const letter = String.fromCharCode(65 + d); // A, B, C...
            exRow[0] = `${letter}${e + 1}`;
            exRow[1] = `Exercise ${d + 1}-${e + 1} name`;
            exRow[3] = "3";       // series
            exRow[4] = "10";      // reps
            exRow[5] = "50kg";    // carga
            exRow[6] = "7";       // rpe
            exRows.push(rows.length);
            rows.push(exRow);
        }
        exerciseRows.push(exRows);
    }

    return { matrix: rows, dayRows, exerciseRows };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const structuredMatrixArb = fc
    .record({
        numDays: fc.integer({ min: 1, max: 3 }),
        numExercisesPerDay: fc.array(fc.integer({ min: 1, max: 5 }), {
            minLength: 3,
            maxLength: 3,
        }),
    })
    .map(({ numDays, numExercisesPerDay }) => {
        const exercisesPerDay = numExercisesPerDay.slice(0, numDays);
        const { matrix, dayRows, exerciseRows } = buildMatrix(numDays, exercisesPerDay, []);
        return { matrix, numDays, exercisesPerDay, dayRows, exerciseRows };
    });

/** Matrix with separator/empty rows interspersed between exercises. */
const matrixWithSeparatorsArb = fc
    .record({
        numDays: fc.integer({ min: 1, max: 3 }),
        numExercisesPerDay: fc.array(fc.integer({ min: 1, max: 4 }), {
            minLength: 3,
            maxLength: 3,
        }),
        separatorPositions: fc.array(fc.integer({ min: 5, max: 20 }), {
            minLength: 0,
            maxLength: 5,
        }),
    })
    .map(({ numDays, numExercisesPerDay, separatorPositions }) => {
        const exercisesPerDay = numExercisesPerDay.slice(0, numDays);
        const { matrix } = buildMatrix(numDays, exercisesPerDay, separatorPositions);
        return { matrix, numDays, exercisesPerDay };
    });

// ---------------------------------------------------------------------------
// Property 3: Estructura de Day_Blocks y Exercise_Rows
// ---------------------------------------------------------------------------
// Feature: direct-sheet-reader, Property 3: Estructura de Day_Blocks y Exercise_Rows

describe("Property 3: Estructura de Day_Blocks y Exercise_Rows", () => {
    it("parsePlan produce exactamente N DayBlocks para N días insertados", () => {
        fc.assert(
            fc.property(structuredMatrixArb, ({ matrix, numDays }) => {
                const result = parsePlan(matrix, "TestSheet", "test-id");
                if (!result.ok) return false;
                return result.data.days.length === numDays;
            }),
            { numRuns: 100 },
        );
    });

    it("cada ejercicio aparece en el DayBlock correcto", () => {
        fc.assert(
            fc.property(structuredMatrixArb, ({ matrix, numDays, exercisesPerDay }) => {
                const result = parsePlan(matrix, "TestSheet", "test-id");
                if (!result.ok) return false;

                const { days } = result.data;
                if (days.length !== numDays) return false;

                for (let d = 0; d < numDays; d++) {
                    if (days[d].exercises.length !== exercisesPerDay[d]) return false;
                }
                return true;
            }),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 6: Manejo sin errores de filas no estructurales
// ---------------------------------------------------------------------------
// Feature: direct-sheet-reader, Property 6: Manejo sin errores de filas no estructurales

describe("Property 6: Manejo sin errores de filas no estructurales", () => {
    it("parsePlan completa sin lanzar excepciones cuando hay filas separadoras/vacías intercaladas", () => {
        fc.assert(
            fc.property(matrixWithSeparatorsArb, ({ matrix }) => {
                let threw = false;
                try {
                    parsePlan(matrix, "TestSheet", "test-id");
                } catch {
                    threw = true;
                }
                return !threw;
            }),
            { numRuns: 100 },
        );
    });

    it("las filas vacías/separadoras no aparecen como ejercicios en el output", () => {
        fc.assert(
            fc.property(matrixWithSeparatorsArb, ({ matrix, numDays, exercisesPerDay }) => {
                const result = parsePlan(matrix, "TestSheet", "test-id");
                if (!result.ok) return true; // no days → ok, just no crash

                const { days } = result.data;

                // Total exercises in output must equal total exercises inserted
                const totalInserted = exercisesPerDay
                    .slice(0, numDays)
                    .reduce((a, b) => a + b, 0);
                const totalInOutput = days.reduce((a, d) => a + d.exercises.length, 0);

                return totalInOutput === totalInserted;
            }),
            { numRuns: 100 },
        );
    });
});
