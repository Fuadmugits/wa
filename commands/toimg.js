const fs = require("fs")
const path = require("path")
const Jimp = require("jimp")
const { downloadMediaMessage } = require("@whiskeysockets/baileys")

module.exports = async (sock, msg, args) => {
    const from = msg.key.remoteJid

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const quotedType = quoted ? Object.keys(quoted)[0] : null
    const msgType = Object.keys(msg.message || {})[0]

    const isSticker = msgType === "stickerMessage" || quotedType === "stickerMessage"

    if (!isSticker) {
        return sock.sendMessage(from, {
            text: "❌ Reply sticker dengan *.toimg*"
        }, { quoted: msg })
    }

    await sock.sendMessage(from, { text: "⏳ Mengkonversi sticker ke foto..." }, { quoted: msg })

    const sourceMsg = quoted
        ? { message: quoted, key: { ...msg.key } }
        : msg

    const tmpDir = "./tmp"
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

    const tmpId = Date.now()

    try {
        const buffer = await downloadMediaMessage(sourceMsg, "buffer", {})

        const outputPath = path.join(tmpDir, `${tmpId}.png`)

        // Baca webp lalu simpan sebagai png pakai Jimp
        const image = await Jimp.read(buffer)
        await image.writeAsync(outputPath)

        const imageBuffer = fs.readFileSync(outputPath)

        await sock.sendMessage(from, {
            image: imageBuffer,
            caption: "✅ Sticker berhasil dikonversi ke foto!"
        }, { quoted: msg })

        fs.unlinkSync(outputPath)

    } catch (err) {
        console.log("❌ TOIMG ERROR:", err)
        await sock.sendMessage(from, {
            text: "❌ Gagal mengkonversi."
        }, { quoted: msg })
    }
}