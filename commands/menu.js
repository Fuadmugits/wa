const fs = require("fs")
const path = require("path")

module.exports = async (sock, msg) => {
    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid
    const pushname = msg.pushName || "User"

    const teks = `
╭━━━〔 *PREMIUM BOT MENU* 〕━━━⬣
┃ 👤 User : ${pushname}
┃ 🤖 Status : Online
┃ ⚡ Mode : Admin Only
╰━━━━━━━━━━━━━━━━━━⬣

📌 *MAIN*
• .ping

📥 *DOWNLOADER*
• .TikTok
• .YouTube
• .Instagram

🛡️ *GROUP*
• .warn @tag
• .unwarn @tag
• .cekwarn @tag

🎮 *GAME*
• .tebakkata
• .tebakangka
• .sambungkata

⚙️ *TOOLS*
• .rvo

🖼️ STICKER
• .sticker
• .wm teks
• .toimg
• .qc teks

╭━━━〔 *NOTE* 〕━━━⬣
┃ Bot hanya untuk admin
╰━━━━━━━━━━━━━━━━⬣
`

    // Ambil gambar dari file lokal images.jpg
    const imgPath = path.join(__dirname, "../images.jpg")
    const imageBuffer = fs.readFileSync(imgPath)

    await sock.sendMessage(from, {
        image: imageBuffer,
        caption: teks,
        footer: "🔥 Bot by kageits",
        buttons: [
            {
                buttonId: ".ping",
                buttonText: { displayText: "⚡ Ping" },
                type: 1
            },
            {
                buttonId: ".owner",
                buttonText: { displayText: "👑 Owner" },
                type: 1
            },
            {
                buttonId: ".menu",
                buttonText: { displayText: "🔄 Refresh" },
                type: 1
            }
        ],
        headerType: 4
    }, { quoted: msg })
}