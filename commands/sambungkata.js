const games = {}

module.exports = async (sock, msg) => {
    const from = msg.key.remoteJid

    const start = "kucing"
    games[from] = start

    await sock.sendMessage(from, {
        text: `🔗 Sambung Kata!\n\nMulai dari: *${start}*\n\nKirim kata yang diawali huruf *${start.slice(-1)}*`
    })
}

module.exports.check = (msg, sock, games) => {
    const from = msg.key.remoteJid
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text

    if (!games[from]) return false

    const lastChar = games[from].slice(-1)

    if (text[0].toLowerCase() === lastChar) {
        games[from] = text

        sock.sendMessage(from, {
            text: `✅ Lanjut!\nKata sekarang: *${text}*`
        })
    } else {
        sock.sendMessage(from, {
            text: `❌ Salah! Harus mulai huruf *${lastChar}*`
        })
    }
}