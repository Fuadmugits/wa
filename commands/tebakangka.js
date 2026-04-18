const games = {}

module.exports = async (sock, msg) => {
    const from = msg.key.remoteJid

    const number = Math.floor(Math.random() * 10) + 1
    games[from] = number

    await sock.sendMessage(from, {
        text: "🔢 Tebak Angka 1 - 10!\n\nKetik angkanya!"
    })

    setTimeout(() => {
        if (games[from]) {
            sock.sendMessage(from, {
                text: `⏰ Waktu habis!\nJawaban: *${games[from]}*`
            })
            delete games[from]
        }
    }, 30000)
}

module.exports.check = (msg, sock, games) => {
    const from = msg.key.remoteJid
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text

    if (!games[from]) return false

    if (parseInt(text) === games[from]) {
        sock.sendMessage(from, {
            text: `🎉 Benar! Angkanya: *${games[from]}*`
        })
        delete games[from]
    }
}