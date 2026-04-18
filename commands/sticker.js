const fs = require("fs")
const path = require("path")
const ffmpeg = require("fluent-ffmpeg")
const ffmpegPath = require("ffmpeg-static")
const Jimp = require("jimp")
const { downloadMediaMessage } = require("@whiskeysockets/baileys")

// Pakai ffmpeg dari package ffmpeg-static, tidak perlu install manual
ffmpeg.setFfmpegPath(ffmpegPath)

module.exports = async (sock, msg, args) => {
    const from = msg.key.remoteJid

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const quotedType = quoted ? Object.keys(quoted)[0] : null
    const msgType = Object.keys(msg.message || {})[0]

    const isImage = msgType === "imageMessage" || quotedType === "imageMessage"
    const isVideo = msgType === "videoMessage" || quotedType === "videoMessage"
    const isGif = (msgType === "videoMessage" && msg.message?.videoMessage?.gifPlayback) ||
                  (quotedType === "videoMessage" && quoted?.videoMessage?.gifPlayback)

    if (!isImage && !isVideo && !isGif) {
        return sock.sendMessage(from, {
            text: "❌ Reply foto atau video dengan *.sticker*"
        }, { quoted: msg })
    }

    await sock.sendMessage(from, { text: "⏳ Membuat sticker..." }, { quoted: msg })

    const sourceMsg = quoted
        ? { message: quoted, key: { ...msg.key } }
        : msg

    const tmpDir = "./tmp"
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

    const tmpId = Date.now()

    try {
        const buffer = await downloadMediaMessage(sourceMsg, "buffer", {})

        if (isImage) {
            // Foto → sticker static pakai Jimp
            const outputPath = path.join(tmpDir, `${tmpId}.webp`)

            const image = await Jimp.read(buffer)
            image.resize(512, 512, Jimp.RESIZE_CONTAIN)
            await image.writeAsync(outputPath)

            const stickerBuffer = fs.readFileSync(outputPath)
            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg })
            fs.unlinkSync(outputPath)

        } else {
            // Video/GIF → sticker animasi pakai ffmpeg
            const ext = isGif ? "gif" : "mp4"
            const inputPath = path.join(tmpDir, `${tmpId}.${ext}`)
            const outputPath = path.join(tmpDir, `${tmpId}.webp`)
            fs.writeFileSync(inputPath, buffer)

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions([
                        "-vcodec", "libwebp",
                        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
                        "-loop", "0",
                        "-ss", "00:00:00",
                        "-t", "00:00:05",
                        "-preset", "default",
                        "-an",
                        "-vsync", "0"
                    ])
                    .output(outputPath)
                    .on("end", resolve)
                    .on("error", reject)
                    .run()
            })

            const stickerBuffer = fs.readFileSync(outputPath)
            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg })
            fs.unlinkSync(inputPath)
            fs.unlinkSync(outputPath)
        }

    } catch (err) {
        console.log("❌ STICKER ERROR:", err)
        await sock.sendMessage(from, {
            text: "❌ Gagal membuat sticker."
        }, { quoted: msg })
    }
}