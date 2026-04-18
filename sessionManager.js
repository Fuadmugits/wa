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
const path = require("path")

// =====================
// GLOBAL
// =====================
global.settings = global.settings || { prefix: "." }
global.delay = (ms) => new Promise(res => setTimeout(res, ms))

global.readJSON = (file) => {
    try {
        if (!fs.existsSync(file)) return {}
        const data = fs.readFileSync(file, "utf-8")
        return data ? JSON.parse(data) : {}
    } catch { return {} }
}

global.writeJSON = async (file, data) => {
    try {
        await fsPromises.writeFile(file, JSON.stringify(data, null, 2))
    } catch (err) {
        console.log("❌ writeJSON error:", err)
    }
}

// =====================
// SESSION STORE
// sessions[nomor] = { sock, reconnectCount }
// =====================
const sessions = {}

// =====================
// CEK EXPIRED — jalankan tiap 1 menit
// =====================
setInterval(() => {
    const db = global.readJSON("./reseller.json")
    const now = Date.now()

    for (const nomor in db) {
        const user = db[nomor]
        if (user.status !== "active") continue

        const expired = new Date(user.expiredAt).getTime()
        if (now >= expired) {
            console.log(`⏰ Session ${nomor} expired, menghentikan...`)
            db[nomor].status = "expired"
            stopSession(nomor)
        }
    }

    global.writeJSON("./reseller.json", db)
}, 60 * 1000)

// =====================
// START SEMUA SESSION AKTIF
// =====================
async function startAllSessions() {
    const db = global.readJSON("./reseller.json")
    const now = Date.now()

    for (const nomor in db) {
        const user = db[nomor]
        if (user.status !== "active") continue

        const expired = new Date(user.expiredAt).getTime()
        if (now >= expired) {
            db[nomor].status = "expired"
            continue
        }

        await startSession(nomor)
        await global.delay(2000) // jeda antar session supaya tidak flood
    }

    await global.writeJSON("./reseller.json", db)
}

// =====================
// START 1 SESSION
// =====================
async function startSession(nomor) {
    if (sessions[nomor]) {
        console.log(`⚠️ Session ${nomor} sudah berjalan`)
        return
    }

    console.log(`🚀 Memulai session: ${nomor}`)

    const sessionDir = `./sessions/${nomor}`
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false
    })

    sessions[nomor] = { sock, reconnectCount: 0, qr: null }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log(`📌 QR untuk ${nomor}:`)
            qrcode.generate(qr, { small: true })
            // Simpan QR string untuk ditampilkan di dashboard
            sessions[nomor].qr = qr
        }

        if (connection === "open") {
            console.log(`✅ Session ${nomor} connected`)
            if (sessions[nomor]) {
                sessions[nomor].reconnectCount = 0
                sessions[nomor].qr = null
                sessions[nomor].connected = true
            }
        }

        if (connection === "close") {
            if (sessions[nomor]) sessions[nomor].connected = false
            const reason = lastDisconnect?.error?.output?.statusCode

            if (reason === DisconnectReason.loggedOut) {
                console.log(`❌ Session ${nomor} logged out`)
                stopSession(nomor)
                return
            }

            const count = sessions[nomor]?.reconnectCount || 0
            if (count >= 5) {
                console.log(`❌ Session ${nomor} gagal reconnect 5x, berhenti`)
                stopSession(nomor)
                return
            }

            if (sessions[nomor]) sessions[nomor].reconnectCount = count + 1
            const delay = Math.min(5000 * (count + 1), 30000)
            console.log(`♻ Session ${nomor} reconnecting dalam ${delay / 1000}s...`)
            setTimeout(() => {
                delete sessions[nomor]
                startSession(nomor)
            }, delay)
        }
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages?.[0]
            if (!msg) return
            await messageHandler.call(sock, msg, nomor)
        } catch (err) {
            console.log(`ERROR MESSAGE [${nomor}]:`, err)
        }
    })
}

// =====================
// STOP 1 SESSION
// =====================
function stopSession(nomor) {
    if (!sessions[nomor]) return
    try {
        sessions[nomor].sock?.end?.()
        sessions[nomor].sock?.ws?.close?.()
    } catch {}
    delete sessions[nomor]
    console.log(`🛑 Session ${nomor} dihentikan`)
}

// =====================
// MESSAGE HANDLER
// =====================
async function messageHandler(msg, nomor) {
    const sock = this

    if (!msg || !msg.message) return
    if (msg.key?.remoteJid === "status@broadcast") return

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
    const type = Object.keys(msg.message || {})[0]

    // Antispam (hanya di group)
    if (isGroup && !isFromMe && !text.startsWith(prefix)) {
        global.spam = global.spam || {}
        const sender = msg.key.participant || ""
        const spamTypes = ["conversation", "extendedTextMessage", "imageMessage", "videoMessage", "stickerMessage"]

        if (!global.spam[sender]) global.spam[sender] = { count: 0, time: Date.now() }
        const now = Date.now()
        if (now - global.spam[sender].time > 5000) global.spam[sender] = { count: 0, time: now }
        if (spamTypes.includes(type)) { global.spam[sender].count++; global.spam[sender].time = now }

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
    if (!/^[a-zA-Z0-9_-]+$/.test(command)) return

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
        console.log(`❌ COMMAND ERROR [${nomor}]:`, err)
        sock.sendMessage(from, { text: "❌ Error saat menjalankan command" })
    }
}

// =====================
// EXPORT untuk dipakai dashboard
// =====================
module.exports = { startSession, stopSession, startAllSessions, sessions }