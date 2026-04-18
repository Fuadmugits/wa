const games = {}

const words = [
    "kucing", "mobil", "program", "sekolah", "javascript",
    "komputer", "internet", "makanan", "minuman", "robot"
]

module.exports = async (sock, msg) => {
    const from = msg.key.remoteJid

    const word = words[Math.floor(Math.random() * words.length)]
    const hidden = word.replace(/[aiueo]/gi, "_")

    games[from] = word

    await sock.sendMessage(from, {
        text: `🎯 Tebak Kata!\n\n${hidden}\n\nReply dengan jawaban kamu!`
    })

    // timeout 30 detik
    setTimeout(() => {
        if (games[from]) {
            sock.sendMessage(from, {
                text: `⏰ Waktu habis!\nJawaban: *${games[from]}*`
            })
            delete games[from]
        }
    }, 30000)
}

// cek jawaban (dipanggil dari index.js)
module.exports.check = (msg, sock, games) => {
    const from = msg.key.remoteJid
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text

    if (!games[from]) return false

    if (text.toLowerCase() === games[from]) {
        sock.sendMessage(from, {
            text: `🎉 Benar! Jawabannya: *${games[from]}*`
        })
        delete games[from]
    }
}