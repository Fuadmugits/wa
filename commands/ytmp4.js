const axios = require("axios")

module.exports = async (sock, msg, args) => {
    const url = args[0]

    if (!url.includes("youtube.com") && !url.includes("youtu.be")) return

    try {
        await sock.sendMessage(msg.key.remoteJid, {
            text: "⏳ Mengambil video YouTube..."
        })

        const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp4?url=${url}`)

        const video = res.data.data.dl

        await sock.sendMessage(msg.key.remoteJid, {
            video: { url: video },
            caption: "✅ YouTube Video"
        }, { quoted: msg })

    } catch (err) {
        sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Gagal download YouTube"
        })
    }
}