const axios = require("axios")

module.exports = async (sock, msg, args) => {
    const url = args[0]

    if (!url) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "Masukkan link YouTube!"
        })
    }

    try {
        const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${url}`)

        const audio = res.data.data.dl

        await sock.sendMessage(msg.key.remoteJid, {
            audio: { url: audio },
            mimetype: "audio/mp4"
        }, { quoted: msg })

    } catch (err) {
        sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Gagal download audio"
        })
    }
}