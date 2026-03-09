// CellMatrix
export type CellMatrix = string[][]

// Result type
export type Result<T, E> = { ok: true; data: T } | { ok: false; error: E }

// Auth
export interface ApiKeyAuth { apiKey: string }
export interface OAuthCredentials { keyFile: string; scopes: string[] }

// API options
export interface SheetsApiOptions {
    spreadsheetId: string
    sheetName: string
    auth: ApiKeyAuth | OAuthCredentials
}

// Config
export interface SheetReaderConfig {
    source: {
        type: "sheets-api"
        spreadsheetId: string
        sheetName: string
        auth: ApiKeyAuth | OAuthCredentials
    }
}

// Error
export interface SheetReaderError {
    code: "SHEET_NOT_FOUND" | "AUTH_ERROR" | "SPREADSHEET_NOT_FOUND" | "NO_WEEK_GROUPS" | "UNMAPPABLE_STRUCTURE" | "UNKNOWN"
    message: string
    details?: unknown
}

// WeekFields
export interface WeekFields {
    series?: number
    reps?: number
    carga?: number
    rpe?: number
}

// WeekGroup
export interface WeekGroup {
    weekLabel: string
    headerRow: number
    startColumn: number
    fields: WeekFields
}

// WeekValues
export interface WeekValues {
    weekLabel: string
    values: {
        series: string
        reps: string
        carga: string
        rpe: string
    }
    columns: {
        series: number | null
        reps: number | null
        carga: number | null
        rpe: number | null
    }
}

// ExerciseRow
export interface ExerciseRow {
    row: number
    code: string
    name: string
    videoUrl?: string
    weeks: WeekValues[]
}

// DayBlock
export interface DayBlock {
    name: string
    subtitle?: string
    row: number
    exercises: ExerciseRow[]
}

// WorkoutPlan
export interface WorkoutPlan {
    spreadsheetId: string
    spreadsheetName?: string
    sheetName: string
    weekGroups: WeekGroup[]
    days: DayBlock[]
}
