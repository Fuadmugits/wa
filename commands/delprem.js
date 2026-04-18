module.exports = async (sock, msg) => {
    const fs = require("fs")
    const settings = require("../settings")

    const PREMIUM_FILE = "./database/premium.json"

    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid

    const isOwner = settings.owner.includes(sender.split("@")[0])

    if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Owner only!" })
    }

    let target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

    let db = fs.existsSync(PREMIUM_FILE)
        ? JSON.parse(fs.readFileSync(PREMIUM_FILE))
        : {}

    delete db[target]

    fs.writeFileSync(PREMIUM_FILE, JSON.stringify(db, null, 2))

    sock.sendMessage(from, {
        text: "🗑️ Premium dihapus",
        mentions: [target]
    })
}