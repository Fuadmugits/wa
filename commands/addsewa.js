const fs = require("fs")

module.exports = async (sock, msg, args) => {
    const from = msg.key.remoteJid

    if (!args[0]) {
        return sock.sendMessage(from, { text: "Contoh: .addbot bot2" })
    }

    const sessionName = args[0]

    const path = `./sessions/${sessionName}`

    if (fs.existsSync(path)) {
        return sock.sendMessage(from, { text: "❌ Session sudah ada" })
    }

    fs.mkdirSync(path)

    require("../index").startBot(sessionName)

    sock.sendMessage(from, {
        text: `✅ Bot ${sessionName} dibuat\nSilakan scan QR di terminal`
    })
}