import { readSheetToJson } from "./sheet-reader.js"
import { config } from "dotenv"
import { writeFileSync } from "fs"

config()

const apiKey = process.env.SHEETS_API_KEY
if (!apiKey) {
    console.error("Falta SHEETS_API_KEY en .env")
    process.exit(1)
}

const result = await readSheetToJson({
    source: {
        type: "sheets-api",
        spreadsheetId: "1yS82jhnPtaauYiTwSUf6xoJA_SOR0zU2HMe0f79z1pk",
        sheetName: "1° Plan",
        auth: { apiKey },
    },
})

if (result.ok) {
    writeFileSync("debug-output.json", result.data, "utf-8")
    console.log("Guardado en debug-output.json")
} else {
    console.error("Error:", result.error)
}
