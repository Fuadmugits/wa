module.exports = async (sock, msg, args) => {
    const fs = require("fs")
    const settings = require("../settings")

    const PREMIUM_FILE = "./database/premium.json"
    const SEWA_FILE = "./database/sewa.json"

    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid

    const isOwner = settings.owner.includes(sender.split("@")[0])

    if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Owner only!" }, { quoted: msg })
    }

    const readJSON = (path) => {
        if (!fs.existsSync(path)) return {}
        return JSON.parse(fs.readFileSync(path))
    }

    let prem = Object.keys(readJSON(PREMIUM_FILE)).length
    let sewa = Object.keys(readJSON(SEWA_FILE)).length

    let teks = `
╔═══ PANEL ADMIN ═══╗
👑 User Premium : ${prem}
🏠 Grup Sewa    : ${sewa}

📌 Command:
.addprem @tag 30
.delprem @tag
.addsewa 30
.delsewa
.cekwaktu
╚═══════════════╝
`

    sock.sendMessage(from, { text: teks }, { quoted: msg })
}