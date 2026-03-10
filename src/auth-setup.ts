/**
 * Script one-time para autenticar con tu cuenta de Google via OAuth2 web flow.
 * Levanta un servidor HTTP en :3001 para capturar el callback, obtiene el
 * refresh_token y lo imprime para que lo guardes como variable de entorno.
 *
 * Uso: node --loader ts-node/esm src/auth-setup.ts
 */
import { google } from "googleapis"
import { readFileSync } from "fs"
import http from "http"

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
const CREDENTIALS_PATH = "./credentials.json"
const REDIRECT_URI = "http://localhost:3001/oauth/callback"

const { client_secret, client_id } = JSON.parse(
    readFileSync(CREDENTIALS_PATH, "utf-8")
).web

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI)

const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // fuerza a que devuelva refresh_token siempre
})

console.log("\nAbrí esta URL en tu navegador:\n")
console.log(authUrl)
console.log("\nEsperando callback en http://localhost:3001/oauth/callback ...\n")

const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith("/oauth/callback")) return

    const code = new URL(req.url, "http://localhost:3001").searchParams.get("code")
    if (!code) {
        res.end("No se recibió código de autorización.")
        return
    }

    try {
        const { tokens } = await oAuth2Client.getToken(code)

        res.end("<h2>✅ Autenticación exitosa. Podés cerrar esta pestaña.</h2>")
        server.close()

        console.log("\n✅ Autenticación exitosa!")
        console.log("\nAgregá esta variable de entorno en Railway (y en tu .env local):\n")
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
        console.log(`GOOGLE_CLIENT_ID=${client_id}`)
        console.log(`GOOGLE_CLIENT_SECRET=${client_secret}`)
        console.log()
    } catch (e) {
        res.end("Error obteniendo token: " + String(e))
        server.close()
    }
})

server.listen(3001)
