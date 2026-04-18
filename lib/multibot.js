const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const qrcode = require("qrcode-terminal")

const sessions = {}

async function startSession(sessionId, handler) {
    const { state, saveCreds } = await useMultiFileAuthState(`sessions/${sessionId}`)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {

        if (qr) {
            console.log(`Scan QR (${sessionId}):`)
            qrcode.generate(qr, { small: true })
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

            console.log(`Bot ${sessionId} reconnect:`, shouldReconnect)

            if (shouldReconnect) startSession(sessionId, handler)
        } else if (connection === "open") {
            console.log(`✅ Bot ${sessionId} Online`)
        }
    })

    // pakai handler dari index.js kamu
    sock.ev.on("messages.upsert", handler)

    sessions[sessionId] = sock
}

function getSessions() {
    return sessions
}

module.exports = {
    startSession,
    getSessions
}