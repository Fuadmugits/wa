const fs = require("fs")

const WARN_FILE = "./database/warn.json"

// pastikan file ada
if (!fs.existsSync("./database")) {
    fs.mkdirSync("./database")
}
if (!fs.existsSync(WARN_FILE)) {
    fs.writeFileSync(WARN_FILE, JSON.stringify({}))
}

module.exports = async (sock, msg, args) => {
    const from = msg.key.remoteJid
    const isGroup = from.endsWith("@g.us")

    if (!isGroup) {
        return sock.sendMessage(from, { text: "❌ Fitur ini hanya untuk grup" })
    }

    const metadata = await sock.groupMetadata(from)
    const participants = metadata.participants

    const sender = msg.key.participant || msg.key.remoteJid
    const isAdmin = participants.find(p => p.id === sender)?.admin

    if (!isAdmin) {
        return sock.sendMessage(from, { text: "❌ Hanya admin yang bisa pakai command ini" })
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid

    if (!mentioned) {
        return sock.sendMessage(from, { text: "❌ Tag orangnya!" })
    }

    const target = mentioned[0]

    let db = JSON.parse(fs.readFileSync(WARN_FILE))

    if (!db[from]) db[from] = {}
    if (!db[from][target]) db[from][target] = 0

    db[from][target] += 1

    let warnCount = db[from][target]

    if (warnCount >= 4) {
        db[from][target] = 0

        await sock.sendMessage(from, {
            text: `🚫 @${target.split("@")[0]} sudah 4x warn!\nSiap-siap kena sanksi 😈`,
            mentions: [target]
        })

        // 🔥 OPSIONAL: auto kick
        // await sock.groupParticipantsUpdate(from, [target], "remove")
    } else {
        await sock.sendMessage(from, {
            text: `⚠️ @${target.split("@")[0]} mendapat warning (${warnCount}/4)`,
            mentions: [target]
        })
    }

    fs.writeFileSync(WARN_FILE, JSON.stringify(db, null, 2))
}