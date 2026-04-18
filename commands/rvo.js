const { downloadContentFromMessage } = require("@whiskeysockets/baileys")

module.exports = async (sock, msg) => {

    let quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage

    console.log("DEBUG RAW:", JSON.stringify(quoted, null, 2))

    if (!quoted) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "Reply foto/video sekali lihat dengan .rvo"
        })
    }

    // 🔥 unwrap semua kemungkinan
    const getViewOnce = (m) => {
        if (!m) return null

        // unwrap ephemeral
        if (m.ephemeralMessage) {
            return getViewOnce(m.ephemeralMessage.message)
        }

        // tipe lama
        if (m.viewOnceMessage) {
            return m.viewOnceMessage.message
        }

        if (m.viewOnceMessageV2) {
            return m.viewOnceMessageV2.message
        }

        if (m.viewOnceMessageV2Extension) {
            return m.viewOnceMessageV2Extension.message
        }

        // 🔥 INI KASUS KAMU
        if (m.imageMessage && m.imageMessage.viewOnce) {
            return { imageMessage: m.imageMessage }
        }

        if (m.videoMessage && m.videoMessage.viewOnce) {
            return { videoMessage: m.videoMessage }
        }

        return null
    }

    const media = getViewOnce(quoted)

    if (!media) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Itu bukan view once"
        })
    }

    try {
        const type = Object.keys(media)[0]

        const stream = await downloadContentFromMessage(
            media[type],
            type === "imageMessage" ? "image" : "video"
        )

        let buffer = Buffer.from([])

        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }

        if (type === "imageMessage") {
            await sock.sendMessage(msg.key.remoteJid, {
                image: buffer,
                caption: "✅ RVO berhasil (anti sekali lihat 😎)"
            }, { quoted: msg })

        } else if (type === "videoMessage") {
            await sock.sendMessage(msg.key.remoteJid, {
                video: buffer,
                caption: "✅ RVO berhasil (anti sekali lihat 😎)"
            }, { quoted: msg })
        }

    } catch (err) {
        console.log("ERROR RVO:", err)
        sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Gagal membuka view once (mungkin sudah dibuka / expired)"
        })
    }
}