module.exports = async (sock, msg, args) => {
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
    let days = parseInt(args[0])

    if (!target || !days) {
        return sock.sendMessage(from, {
            text: "Contoh: .addprem @628xxx 30"
        })
    }

    let db = fs.existsSync(PREMIUM_FILE)
        ? JSON.parse(fs.readFileSync(PREMIUM_FILE))
        : {}

    db[target] = Date.now() + days * 86400000

    fs.writeFileSync(PREMIUM_FILE, JSON.stringify(db, null, 2))

    sock.sendMessage(from, {
        text: `👑 Premium aktif ${days} hari`,
        mentions: [target]
    })
}