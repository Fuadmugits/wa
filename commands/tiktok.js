const axios = require("axios")

module.exports = async (sock, msg, args) => {
    const url = args[0]

    if (!url.includes("tiktok.com")) return

    try {
        await sock.sendMessage(msg.key.remoteJid, {
            text: "⏳ Mengambil TikTok..."
        })

        const res = await axios.get(`https://www.tikwm.com/api/?url=${url}`)

        const video = res.data.data.play
        const audio = res.data.data.music

        await sock.sendMessage(msg.key.remoteJid, {
            video: { url: video },
            caption: "✅ TikTok Video"
        }, { quoted: msg })

        await sock.sendMessage(msg.key.remoteJid, {
            audio: { url: audio },
            mimetype: "audio/mp4"
        }, { quoted: msg })

    } catch (err) {
        sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Gagal download TikTok"
        })
    }
}