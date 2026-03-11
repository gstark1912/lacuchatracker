import express from "express"
import cors from "cors"
import { config } from "dotenv"
import { google } from "googleapis"
import { readSheet } from "./sheet-reader.js"
import { fileURLToPath } from "url"
import { join, dirname } from "path"

config()

const app = express()
app.use(cors())
app.use(express.json())

// Servir el frontend buildeado en producción
const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, "../ui-app/dist")
app.use(express.static(distPath))

const SPREADSHEET_ID = process.env.SPREADSHEET_ID ?? "1yS82jhnPtaauYiTwSUf6xoJA_SOR0zU2HMe0f79z1pk"
const SHEET_NAME = process.env.SHEET_NAME ?? "1° Plan"

/** Convierte columna 1-based a letra(s): 1→A, 11→K, 27→AA */
function colToLetter(col: number): string {
    let letter = ""
    while (col > 0) {
        const rem = (col - 1) % 26
        letter = String.fromCharCode(65 + rem) + letter
        col = Math.floor((col - 1) / 26)
    }
    return letter
}

function getWriteAuth() {
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (refreshToken && clientId && clientSecret) {
        const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret)
        oAuth2Client.setCredentials({ refresh_token: refreshToken })
        return oAuth2Client
    }

    throw new Error("Faltan GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en las variables de entorno.")
}

app.get("/api/plan", async (_req, res) => {
    const apiKey = process.env.SHEETS_API_KEY
    if (!apiKey) {
        res.status(500).json({ error: "SHEETS_API_KEY not configured" })
        return
    }

    const result = await readSheet({
        source: {
            type: "sheets-api",
            spreadsheetId: SPREADSHEET_ID,
            sheetName: SHEET_NAME,
            auth: { apiKey },
        },
    })

    if (!result.ok) {
        res.status(500).json({ error: result.error })
        return
    }

    res.json(result.data)
})

// PATCH /api/plan/cell  { row: number, column: number, value: string }
app.patch("/api/plan/cell", async (req, res) => {
    const { row, column, value } = req.body as { row: number; column: number; value: string }

    if (!row || !column || value === undefined) {
        res.status(400).json({ error: "row, column and value are required" })
        return
    }

    const a1 = `'${SHEET_NAME}'!${colToLetter(column)}${row}`

    try {
        const auth = getWriteAuth()
        const sheets = google.sheets({ version: "v4", auth: auth as never })

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: a1,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [[value]] },
        })

        res.json({ ok: true, range: a1 })
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        res.status(500).json({ error: msg })
    }
})

// SPA fallback — cualquier ruta no-API devuelve el index.html
app.get("*", (_req, res) => {
    res.sendFile(join(distPath, "index.html"))
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`)
})
