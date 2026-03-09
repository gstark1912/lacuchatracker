import type { SheetReaderConfig, WorkoutPlan, SheetReaderError, Result } from "./types.js"
import { fetchSheet } from "./sheets-api-client.js"
import { parsePlan } from "./plan-parser.js"

export async function readSheet(
    config: SheetReaderConfig
): Promise<Result<WorkoutPlan, SheetReaderError>> {
    const { spreadsheetId, sheetName, auth } = config.source

    const fetchResult = await fetchSheet({ spreadsheetId, sheetName, auth })
    if (!fetchResult.ok) return fetchResult

    return parsePlan(fetchResult.data, sheetName, spreadsheetId)
}

export async function readSheetToJson(
    config: SheetReaderConfig
): Promise<Result<string, SheetReaderError>> {
    const result = await readSheet(config)
    if (!result.ok) return result
    return { ok: true, data: JSON.stringify(result.data, null, 2) }
}
