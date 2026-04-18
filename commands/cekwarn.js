const fs = require("fs")

const WARN_FILE = "./database/warn.json"

module.exports = async (sock, msg, args) => {
    const from = msg.key.remoteJid
    const isGroup = from.endsWith("@g.us")

    if (!isGroup) {
        return sock.sendMessage(from, {
            text: "❌ Fitur ini hanya untuk grup"
        })
    }

    let db = {}
    if (fs.existsSync(WARN_FILE)) {
        db = JSON.parse(fs.readFileSync(WARN_FILE))
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid

    let target

    // kalau tag orang
    if (mentioned && mentioned.length > 0) {
        target = mentioned[0]
    } else {
        // kalau tidak tag → cek diri sendiri
        target = msg.key.participant || msg.key.remoteJid
    }

    const warnCount = db[from]?.[target] || 0

    await sock.sendMessage(from, {
        text: `📊 Warn @${target.split("@")[0]}: ${warnCount}/4`,
        mentions: [target]
    })
}