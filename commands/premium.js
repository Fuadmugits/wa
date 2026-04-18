module.exports = async (sock, msg) => {
    const from = msg.key.remoteJid

    let teks = `
👑 *PAKET PREMIUM BOT*

💎 7 Hari   : Rp5.000
💎 30 Hari  : Rp15.000
💎 Permanen : Rp30.000

Fitur:
✔ Downloader All Sosmed
✔ Sticker Premium
✔ Anti Limit
✔ Fast Response

📩 Minat? Chat owner!
`

    sock.sendMessage(from, { text: teks }, { quoted: msg })
}