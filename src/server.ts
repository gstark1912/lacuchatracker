import express from "express"
import cors from "cors"
import { config } from "dotenv"
import { readSheet } from "./sheet-reader.js"

config()

const app = express()
app.use(cors())
app.use(express.json())

const SPREADSHEET_ID = "1yS82jhnPtaauYiTwSUf6xoJA_SOR0zU2HMe0f79z1pk"
const SHEET_NAME = "1° Plan"

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

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`)
})
