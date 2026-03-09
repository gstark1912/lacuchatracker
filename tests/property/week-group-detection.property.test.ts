import { describe, it } from "vitest";
import fc from "fast-check";
import { detectWeekGroups } from "../../src/plan-parser.js";
import type { CellMatrix } from "../../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an empty matrix of `rows` × `cols` filled with empty strings. */
function emptyMatrix(rows: number, cols: number): CellMatrix {
    return Array.from({ length: rows }, () => Array(cols).fill(""));
}

/**
 * Insert a week label at (row, col) in a copy of the matrix.
 * Returns the mutated matrix (in-place for simplicity in generators).
 */
function insertLabel(matrix: CellMatrix, row: number, col: number, label: string): void {
    matrix[row][col] = label;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a single week label like "SEMANA 3" or "SEM 2". */
const weekLabelArb = fc.oneof(
    fc.integer({ min: 1, max: 10 }).map((n) => `SEMANA ${n}`),
    fc.integer({ min: 1, max: 10 }).map((n) => `Semana ${n}`),
    fc.integer({ min: 1, max: 10 }).map((n) => `semana ${n}`),
    fc.integer({ min: 1, max: 10 }).map((n) => `SEM ${n}`),
    fc.integer({ min: 1, max: 10 }).map((n) => `Sem ${n}`),
);

/**
 * Generates a matrix (30 rows × 15 cols) with N distinct week labels
 * inserted at unique (row, col) positions within the first 20 rows.
 * Returns the matrix and the list of inserted positions.
 */
const matrixWithWeekLabelsArb = fc
    .record({
        numLabels: fc.integer({ min: 1, max: 5 }),
        labels: fc.array(weekLabelArb, { minLength: 5, maxLength: 5 }),
        positions: fc.uniqueArray(
            fc.record({
                row: fc.integer({ min: 0, max: 19 }),
                col: fc.integer({ min: 0, max: 14 }),
            }),
            { minLength: 5, maxLength: 5, selector: (p) => `${p.row}|${p.col}` },
        ),
    })
    .map(({ numLabels, labels, positions }) => {
        const matrix = emptyMatrix(30, 15);
        const inserted: Array<{ row: number; col: number; label: string }> = [];

        for (let i = 0; i < numLabels; i++) {
            const { row, col } = positions[i];
            const label = labels[i];
            insertLabel(matrix, row, col, label);
            inserted.push({ row, col, label });
        }

        return { matrix, inserted };
    });

/**
 * Generates a matrix where the SAME label appears multiple times in the
 * same column (to test deduplication).
 */
const matrixWithDuplicateLabelsArb = fc
    .record({
        label: weekLabelArb,
        col: fc.integer({ min: 0, max: 10 }),
        rows: fc.uniqueArray(fc.integer({ min: 0, max: 19 }), {
            minLength: 2,
            maxLength: 4,
        }),
    })
    .map(({ label, col, rows }) => {
        const matrix = emptyMatrix(30, 15);
        for (const row of rows) {
            insertLabel(matrix, row, col, label);
        }
        return { matrix, label, col, duplicateCount: rows.length };
    });

// ---------------------------------------------------------------------------
// Property 1: Detección completa de Week_Groups
// ---------------------------------------------------------------------------
// Feature: direct-sheet-reader, Property 1: Detección completa de Week_Groups

describe("Property 1: Detección completa de Week_Groups", () => {
    it("detectWeekGroups detecta exactamente todas las etiquetas insertadas en las primeras 20 filas", () => {
        fc.assert(
            fc.property(matrixWithWeekLabelsArb, ({ matrix, inserted }) => {
                const result = detectWeekGroups(matrix);

                // Compute unique (normalized label, col) combinations from inserted
                const uniqueInserted = new Map<string, { row: number; col: number; label: string }>();
                for (const item of inserted) {
                    const key = item.label.trim().toLowerCase() + "|" + (item.col + 1);
                    // Keep the first occurrence (lowest row) for each unique key
                    if (!uniqueInserted.has(key)) {
                        uniqueInserted.set(key, item);
                    }
                }

                // Every unique (label, col) combination must appear in the result
                for (const [, { col, label }] of uniqueInserted) {
                    const found = result.some(
                        (wg) =>
                            wg.startColumn === col + 1 &&
                            wg.weekLabel.toUpperCase() === label.toUpperCase(),
                    );
                    if (!found) return false;
                }

                // Result must not contain more groups than unique inserted combinations
                return result.length === uniqueInserted.size;
            }),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 2: Deduplicación de Week_Groups
// ---------------------------------------------------------------------------
// Feature: direct-sheet-reader, Property 2: Deduplicación de Week_Groups

describe("Property 2: Deduplicación de Week_Groups", () => {
    it("cuando la misma etiqueta aparece múltiples veces en la misma columna, el resultado tiene exactamente 1 WeekGroup por combinación única (label, columna)", () => {
        fc.assert(
            fc.property(matrixWithDuplicateLabelsArb, ({ matrix, label, col }) => {
                const result = detectWeekGroups(matrix);

                // Count how many WeekGroups match this (label, col) combination
                const matching = result.filter(
                    (wg) =>
                        wg.weekLabel.toUpperCase() === label.toUpperCase() &&
                        wg.startColumn === col + 1,
                );

                return matching.length === 1;
            }),
            { numRuns: 100 },
        );
    });

    it("el resultado no contiene duplicados de ninguna combinación (label, columna)", () => {
        fc.assert(
            fc.property(matrixWithWeekLabelsArb, ({ matrix }) => {
                const result = detectWeekGroups(matrix);

                const keys = result.map(
                    (wg) => `${wg.weekLabel.toUpperCase()}|${wg.startColumn}`,
                );
                const uniqueKeys = new Set(keys);

                return keys.length === uniqueKeys.size;
            }),
            { numRuns: 100 },
        );
    });
});
