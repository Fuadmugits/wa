module.exports = async (sock, msg) => {
    const fs = require("fs")

    const PREMIUM_FILE = "./database/premium.json"

    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid

    let db = fs.existsSync(PREMIUM_FILE)
        ? JSON.parse(fs.readFileSync(PREMIUM_FILE))
        : {}

    if (!db[sender]) {
        return sock.sendMessage(from, { text: "❌ Kamu bukan premium" })
    }

    let sisa = db[sender] - Date.now()
    let hari = Math.floor(sisa / 86400000)

    sock.sendMessage(from, {
        text: `👑 Sisa premium: ${hari} hari`
    })
}