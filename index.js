const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs")
const fsPromises = require("fs").promises
const pino = require("pino")
const qrcode = require("qrcode-terminal")
const express = require("express")

// =====================
// EXPRESS (KEEP ALIVE)
// =====================
const app = express()

app.get("/", (req, res) => {
    res.send("Bot WA aktif 🚀")
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log("🌐 Server jalan di port", PORT)
})

// =====================
// WAKTU BOT MULAI — untuk filter pesan lama
// =====================
const BOT_START_TIME = Math.floor(Date.now() / 1000) // dalam detik (unix timestamp)

// =====================
// GLOBAL SAFE INIT
// =====================
global.spam = global.spam || {}
global.gameState = global.gameState || {}
global.settings = global.settings || { prefix: "." }

// =====================
// SESSION PATH FIX (PENTING)
// =====================
const sessionPath = process.env.SESSION_PATH || "./session"

// =====================
// UTILS
// =====================
global.delay = (ms) => new Promise(res => setTimeout(res, ms))

global.readJSON = (file) => {
    try {
        if (!fs.existsSync(file)) return {}
        const data = fs.readFileSync(file, "utf-8")
        return data ? JSON.parse(data) : {}
    } catch {
        return {}
    }
}

global.writeJSON = async (file, data) => {
    try {
        await fsPromises.writeFile(file, JSON.stringify(data, null, 2))
    } catch (err) {
        console.log("❌ writeJSON error:", err)
    }
}

// =====================
// ANTI CRASH
// =====================
process.on("uncaughtException", (err) => {
    console.log("❌ Uncaught Exception:", err)
})

process.on("unhandledRejection", (err) => {
    console.log("❌ Unhandled Rejection:", err)
})

// =====================
// SPAM CLEANUP
// =====================
setInterval(() => {
    const now = Date.now()
    for (const key in global.spam) {
        if (now - global.spam[key].time > 60000) {
            delete global.spam[key]
        }
    }
}, 10 * 60 * 1000)

// =====================
// MESSAGE HANDLER
// =====================
async function messageHandler(msg) {
    const sock = this

    if (!msg || !msg.message) return
    if (msg.key?.remoteJid === "status@broadcast") return

    // =====================
    // FILTER PESAN LAMA
    // Skip pesan yang dikirim sebelum bot aktif
    // =====================
    const msgTimestamp = msg.messageTimestamp
        ? Number(msg.messageTimestamp)
        : 0

    if (msgTimestamp && msgTimestamp < BOT_START_TIME) return

    const prefix = global.settings.prefix
    const isFromMe = msg.key?.fromMe

    const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        ""

    if (isFromMe && !text.startsWith(prefix)) return

    const from = msg.key.remoteJid
    const isGroup = from.endsWith("@g.us")

    const sender = isGroup
        ? msg.key.participant || ""
        : from

    const type = Object.keys(msg.message || {})[0]

    // =====================
    // ANTISPAM — hanya di group, hanya pesan bukan command
    // =====================
    if (isGroup && !isFromMe && !text.startsWith(prefix)) {

        const spamTypes = [
            "conversation",
            "extendedTextMessage",
            "imageMessage",
            "videoMessage",
            "stickerMessage"
        ]

        if (!global.spam[sender]) {
            global.spam[sender] = { count: 0, time: Date.now() }
        }

        const now = Date.now()

        if (now - global.spam[sender].time > 5000) {
            global.spam[sender] = { count: 0, time: now }
        }

        if (spamTypes.includes(type)) {
            global.spam[sender].count++
            global.spam[sender].time = now
        }

        if (global.spam[sender].count >= 5) {
            global.spam[sender].count = 0

            let db = global.readJSON("./warn.json")

            if (!db[from]) db[from] = {}
            if (!db[from][sender]) db[from][sender] = 0

            db[from][sender]++

            await global.writeJSON("./warn.json", db)

            await sock.sendMessage(from, {
                text: `⚠️ @${sender.split("@")[0]} jangan spam`,
                mentions: [sender]
            })
        }
    }

    if (!text.startsWith(prefix)) return

    const args = text.slice(prefix.length).trim().split(/ +/)
    const command = args.shift()?.toLowerCase()

    if (!command) return

    if (!/^[a-zA-Z0-9_-]+$/.test(command)) {
        return sock.sendMessage(from, { text: "❌ Command tidak valid" })
    }

    try {
        const cmdPath = `./commands/${command}.js`

        if (!fs.existsSync(cmdPath)) {
            return sock.sendMessage(from, { text: "❌ Command tidak ditemukan" })
        }

        delete require.cache[require.resolve(cmdPath)]
        const cmd = require(cmdPath)

        if (typeof cmd !== "function") {
            return sock.sendMessage(from, { text: "❌ Format command salah" })
        }

        await cmd(sock, msg, args)

    } catch (err) {
        console.log("❌ COMMAND ERROR:", err)
        sock.sendMessage(from, { text: "❌ Error saat menjalankan command" })
    }
}

// =====================
// RECONNECT CONTROL
// =====================
let reconnectCount = 0
const MAX_RECONNECT = 10
let isRestarting = false

// =====================
// START BOT
// =====================
async function startBot() {

    if (isRestarting) return
    isRestarting = true

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false
    })

    console.log("🔥 BOT STARTING...")

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log("📌 Scan QR:")
            qrcode.generate(qr, { small: true })
        }

        if (connection === "open") {
            console.log("✅ BOT CONNECTED")
            reconnectCount = 0
            isRestarting = false
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode

            if (reason === DisconnectReason.loggedOut) {
                console.log("❌ Logged out. session dihapus.")
                return process.exit(1)
            }

            if (reconnectCount >= MAX_RECONNECT) {
                console.log("❌ Max reconnect tercapai")
                return process.exit(1)
            }

            reconnectCount++

            const delayTime = Math.min(5000 * reconnectCount, 30000)

            console.log(`♻ Reconnect ${reconnectCount}/${MAX_RECONNECT}`)

            setTimeout(() => {
                isRestarting = false
                startBot()
            }, delayTime)
        }
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages?.[0]
        if (!msg) return

        await messageHandler.call(sock, msg)
    })
}

// =====================
// RUN BOT
// =====================
startBot()