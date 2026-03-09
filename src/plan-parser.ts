import type {
    CellMatrix,
    WeekGroup,
    WeekFields,
    DayBlock,
    ExerciseRow,
    WeekValues,
    WorkoutPlan,
    SheetReaderError,
    Result,
} from "./types.js";

// ---------------------------------------------------------------------------
// Normalization helpers (Task 4.6)
// ---------------------------------------------------------------------------

export function normalize(value: string): string {
    return value.trim().toLowerCase();
}

export function looksLikeExerciseCode(value: string): boolean {
    // Acepta "A1" o "A1." (con punto al final, como aparece en la planilla real)
    return /^[A-Z]\d{1,2}\.?$/i.test(value.trim());
}

function isWeekLabel(value: string): boolean {
    const n = normalize(value);
    return /^semana\s*\d+/.test(n) || /^sem\s*\d+/.test(n);
}

export function looksLikeExerciseName(value: string): boolean {
    const v = value.trim();
    if (v.length < 3) return false;
    if (isWeekLabel(v)) return false;
    if (/^d[ií]a\s*\d+/i.test(v)) return false;
    if (/^(series|reps|carga|rpe)$/i.test(v)) return false;
    if (looksLikeExerciseCode(v)) return false;
    return true;
}

// ---------------------------------------------------------------------------
// Pasada 1 — Week_Group detection (Tasks 3.1–3.5)
// ---------------------------------------------------------------------------

/**
 * Scan [weekRow, weekRow+3] × [weekCol, weekCol+8) for field labels.
 * Also scans left of weekCol for "series" (shared Series column case).
 * Returns 1-based column indices for each found field.
 */
export function detectFieldsForWeek(
    matrix: CellMatrix,
    weekRow: number,
    weekCol: number
): WeekFields {
    const fields: WeekFields = {};
    const rowCount = matrix.length;

    for (let r = weekRow; r <= weekRow + 3 && r < rowCount; r++) {
        const row = matrix[r];
        // Scan right of weekCol for all fields
        for (let c = weekCol; c < weekCol + 8 && c < row.length; c++) {
            const cell = normalize(row[c]);
            if (cell.includes("series")) fields.series = c + 1;
            else if (cell.includes("reps")) fields.reps = c + 1;
            else if (cell.includes("carga")) fields.carga = c + 1;
            else if (cell === "rpe") fields.rpe = c + 1;
        }
        // Also scan left of weekCol for "series" (shared Series column, Req 3.5)
        for (let c = 0; c < weekCol && c < row.length; c++) {
            const cell = normalize(row[c]);
            if (cell.includes("series")) {
                // Only set if not already found to the right
                if (fields.series === undefined) fields.series = c + 1;
            }
        }
    }

    return fields;
}

/**
 * Scan first 20 rows for week-label cells, build WeekGroups,
 * deduplicate, sort, and handle shared Series column.
 */
export function detectWeekGroups(matrix: CellMatrix): WeekGroup[] {
    const scanRows = Math.min(20, matrix.length);
    const raw: WeekGroup[] = [];

    for (let r = 0; r < scanRows; r++) {
        const row = matrix[r];
        for (let c = 0; c < row.length; c++) {
            const cell = row[c].trim();
            if (/^semana\s*\d+/i.test(cell) || /^sem\s*\d+/i.test(cell)) {
                const fields = detectFieldsForWeek(matrix, r, c);
                raw.push({
                    weekLabel: cell.toUpperCase(),
                    headerRow: r + 1,
                    startColumn: c + 1,
                    fields,
                });
            }
        }
    }

    // Task 3.3 — deduplicate by (normalize(label) + "|" + startColumn), sort ASC
    const seen = new Set<string>();
    const deduped: WeekGroup[] = [];
    for (const wg of raw) {
        const key = normalize(wg.weekLabel) + "|" + wg.startColumn;
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(wg);
        }
    }
    deduped.sort((a, b) => a.startColumn - b.startColumn);

    // Task 3.4 — shared Series column: if first group's series col is left of its startColumn,
    // propagate that column to all groups.
    if (deduped.length > 0) {
        const first = deduped[0];
        if (
            first.fields.series !== undefined &&
            first.fields.series < first.startColumn
        ) {
            const sharedSeries = first.fields.series;
            for (const wg of deduped) {
                wg.fields.series = sharedSeries;
            }
        }
    }

    return deduped;
}

// ---------------------------------------------------------------------------
// Pasada 2 — Day_Block and Exercise_Row detection (Tasks 4.1–4.5)
// ---------------------------------------------------------------------------

/**
 * Try to parse a single row as an ExerciseRow.
 * Returns null if the row doesn't look like an exercise.
 *
 * NOTE on videoUrl: The Google Sheets API v4 `values.get` endpoint returns
 * only cell values (FORMATTED_VALUE), not hyperlinks. If the cell between
 * the exercise code and name contains a video icon or hyperlink, its URL
 * is NOT accessible via this endpoint. Therefore videoUrl will always be
 * undefined when data comes from the Sheets API. It is preserved in the
 * interface for future use with `spreadsheets.get` (effectiveFormat) or
 * other sources that do expose hyperlink data.
 */
export function tryParseExerciseRow(
    row: string[],
    rowIndex: number,
    weekGroups: WeekGroup[]
): ExerciseRow | null {
    // Find first cell matching exercise code pattern
    let codeCol = -1;
    for (let c = 0; c < row.length; c++) {
        if (looksLikeExerciseCode(row[c])) {
            codeCol = c;
            break;
        }
    }
    if (codeCol === -1) return null;

    const code = row[codeCol].trim().toUpperCase().replace(/\.$/, "") // quitar punto final si existe

    // Find name in [codeCol+1, codeCol+4)
    let nameCol = -1;
    for (let c = codeCol + 1; c < Math.min(codeCol + 4, row.length); c++) {
        if (looksLikeExerciseName(row[c])) {
            nameCol = c;
            break;
        }
    }
    if (nameCol === -1) return null;

    const name = row[nameCol].trim();

    // videoUrl: column between codeCol and nameCol (if gap exists)
    // As noted above, this will be undefined for Sheets API data.
    let videoUrl: string | undefined;
    if (nameCol > codeCol + 1) {
        const candidate = row[codeCol + 1]?.trim();
        if (candidate && candidate.length > 0) {
            videoUrl = candidate;
        }
    }

    // Collect WeekValues for each WeekGroup
    const weeks: WeekValues[] = weekGroups.map((wg) => {
        const { fields, weekLabel } = wg;

        const getVal = (col: number | undefined): string =>
            col !== undefined ? (row[col - 1] ?? "") : "";

        return {
            weekLabel,
            values: {
                series: getVal(fields.series),
                reps: getVal(fields.reps),
                carga: getVal(fields.carga),
                rpe: getVal(fields.rpe),
            },
            columns: {
                series: fields.series ?? null,
                reps: fields.reps ?? null,
                carga: fields.carga ?? null,
                rpe: fields.rpe ?? null,
            },
        };
    });

    return {
        row: rowIndex + 1,
        code,
        name,
        ...(videoUrl !== undefined ? { videoUrl } : {}),
        weeks,
    };
}

/**
 * Iterate all rows, detect DayBlocks and ExerciseRows.
 */
export function parseDaysAndExercises(
    matrix: CellMatrix,
    weekGroups: WeekGroup[]
): DayBlock[] {
    const days: DayBlock[] = [];
    let currentDay: DayBlock | null = null;

    for (let r = 0; r < matrix.length; r++) {

        const row = matrix[r];

        // Check if this row contains a day header
        const dayCell = row.find((cell) => /^d[ií]a\s*\d+/i.test(cell.trim()));
        if (dayCell) {
            // Extraer subtítulo desde la misma celda mergeada (ej: "DÍA 1• FULLBODY")
            // o desde otra celda de la misma fila que no sea el nombre del día
            let subtitle: string | undefined;
            const mergedCell = row.find((cell) => {
                const t = cell.trim();
                return /^d[ií]a\s*\d+/i.test(t) && t.length > dayCell.trim().length;
            });
            if (mergedCell) {
                // Extraer la parte después del nombre del día
                const after = mergedCell.trim().replace(/^d[ií]a\s*\d+/i, "").trim();
                if (after.length > 0) subtitle = after;
            }

            currentDay = {
                name: dayCell.trim().toUpperCase(),
                row: r + 1,
                exercises: [],
                ...(subtitle ? { subtitle } : {}),
            };
            days.push(currentDay);
            // No hacer continue: la misma fila puede contener el primer ejercicio del día
        }

        // Task 4.5 — ignore exercise rows with no active DayBlock
        if (!currentDay) continue;

        const exercise = tryParseExerciseRow(row, r, weekGroups);
        if (exercise) {
            currentDay.exercises.push(exercise);
        }
    }

    return days;
}

// ---------------------------------------------------------------------------
// Tasks 5.1 & 5.2 — parsePlan entry point
// ---------------------------------------------------------------------------

export function parsePlan(
    matrix: CellMatrix,
    sheetName: string,
    spreadsheetId = ""
): Result<WorkoutPlan, SheetReaderError> {
    try {
        // Pasada 1
        const weekGroups = detectWeekGroups(matrix);

        // Task 3.5 — NO_WEEK_GROUPS error
        if (weekGroups.length === 0) {
            return {
                ok: false,
                error: {
                    code: "NO_WEEK_GROUPS",
                    message:
                        "No se encontró ninguna etiqueta de semana (Semana N / Sem N) en las primeras 20 filas de la planilla.",
                },
            };
        }

        // Pasada 2
        const days = parseDaysAndExercises(matrix, weekGroups);

        // Task 5.2 — UNMAPPABLE_STRUCTURE: no days detected at all
        if (days.length === 0) {
            return {
                ok: false,
                error: {
                    code: "UNMAPPABLE_STRUCTURE",
                    message:
                        "Se detectaron semanas pero no se encontró ningún bloque de día (Día N). La estructura de la planilla no puede mapearse al formato esperado.",
                },
            };
        }

        const plan: WorkoutPlan = {
            spreadsheetId,
            sheetName,
            weekGroups,
            days,
        };

        return { ok: true, data: plan };
    } catch (err) {
        return {
            ok: false,
            error: {
                code: "UNMAPPABLE_STRUCTURE",
                message: "Error inesperado al parsear la planilla.",
                details: err,
            },
        };
    }
}
