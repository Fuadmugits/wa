const fs = require("fs")

const WARN_FILE = "./database/warn.json"

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

    if (!db[from] || !db[from][target]) {
        return sock.sendMessage(from, {
            text: "❌ User tidak punya warn"
        })
    }

    db[from][target] -= 1
    if (db[from][target] <= 0) db[from][target] = 0

    await sock.sendMessage(from, {
        text: `✅ Warn @${target.split("@")[0]} dikurangi (${db[from][target]}/4)`,
        mentions: [target]
    })

    fs.writeFileSync(WARN_FILE, JSON.stringify(db, null, 2))
}