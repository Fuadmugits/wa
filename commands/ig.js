const axios = require("axios")

module.exports = async (sock, msg, args) => {
    const url = args[0]

    if (!url || !url.includes("instagram.com")) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Link Instagram tidak valid"
        })
    }

    try {
        await sock.sendMessage(msg.key.remoteJid, {
            text: "⏳ Mengambil media Instagram..."
        })

        const res = await axios.get(`https://api.siputzx.my.id/api/d/igdl?url=${url}`)

        const data = res.data.data

        for (let media of data) {
            await sock.sendMessage(msg.key.remoteJid, {
                video: { url: media.url }
            }, { quoted: msg })
        }

    } catch (err) {
        console.log(err)
        sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Gagal download Instagram"
        })
    }
}