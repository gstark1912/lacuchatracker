import { google } from "googleapis"
import type {
    CellMatrix,
    SheetsApiOptions,
    ApiKeyAuth,
    SheetReaderError,
    Result,
} from "./types.js"

function isApiKeyAuth(auth: SheetsApiOptions["auth"]): auth is ApiKeyAuth {
    return "apiKey" in auth
}

function err(
    code: SheetReaderError["code"],
    message: string,
    details?: unknown
): Result<CellMatrix, SheetReaderError> {
    return { ok: false, error: { code, message, details } }
}

export async function fetchSheet(
    options: SheetsApiOptions
): Promise<Result<CellMatrix, SheetReaderError>> {
    try {
        let authClient: ReturnType<typeof google.auth.fromAPIKey> | InstanceType<typeof google.auth.GoogleAuth>

        if (isApiKeyAuth(options.auth)) {
            authClient = google.auth.fromAPIKey(options.auth.apiKey)
        } else {
            authClient = new google.auth.GoogleAuth({
                keyFile: options.auth.keyFile,
                scopes: options.auth.scopes,
            })
        }

        const sheets = google.sheets({ version: "v4", auth: authClient as never })

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: options.spreadsheetId,
            range: options.sheetName,
            valueRenderOption: "FORMATTED_VALUE",
        })

        const values = response.data.values

        if (!values || values.length === 0) {
            return err(
                "SHEET_NOT_FOUND",
                `Sheet "${options.sheetName}" not found or is empty in spreadsheet "${options.spreadsheetId}".`
            )
        }

        // Normalize: pad short rows so all rows have equal length
        const maxWidth = Math.max(...values.map((row) => row.length))
        const matrix: CellMatrix = values.map((row) => {
            const padded = row.map((cell) => (cell == null ? "" : String(cell)))
            while (padded.length < maxWidth) padded.push("")
            return padded
        })

        return { ok: true, data: matrix }
    } catch (e: unknown) {
        return mapError(e)
    }
}

function mapError(e: unknown): Result<CellMatrix, SheetReaderError> {
    // googleapis errors expose a `code` (HTTP status) and `errors` array
    if (isGaxiosError(e)) {
        const status = e.response?.status ?? e.code

        if (status === 401 || status === 403) {
            return err("AUTH_ERROR", "Authentication failed: invalid or insufficient credentials.")
        }

        if (status === 404) {
            return err(
                "SPREADSHEET_NOT_FOUND",
                "Spreadsheet not found or not accessible with the provided credentials."
            )
        }

        const message = e.message ?? "Unknown API error"
        return err("UNKNOWN", message, e.response?.data)
    }

    const message = e instanceof Error ? e.message : String(e)
    return err("UNKNOWN", message, e)
}

interface GaxiosError {
    response?: { status: number; data?: unknown }
    code?: number
    message?: string
}

function isGaxiosError(e: unknown): e is GaxiosError {
    return typeof e === "object" && e !== null && ("response" in e || "code" in e)
}
