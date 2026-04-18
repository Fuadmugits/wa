const fs = require("fs")
const path = require("path")
const ffmpeg = require("fluent-ffmpeg")
const ffmpegPath = require("ffmpeg-static")
const { downloadMediaMessage } = require("@whiskeysockets/baileys")

ffmpeg.setFfmpegPath(ffmpegPath)

module.exports = async (sock, msg, args) => {
    const from = msg.key.remoteJid

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const quotedType = quoted ? Object.keys(quoted)[0] : null
    const msgType = Object.keys(msg.message || {})[0]

    const isSticker = msgType === "stickerMessage" || quotedType === "stickerMessage"

    if (!isSticker) {
        return sock.sendMessage(from, {
            text: "❌ Reply sticker gerak dengan *.tovd*"
        }, { quoted: msg })
    }

    await sock.sendMessage(from, { text: "⏳ Mengkonversi sticker ke video..." }, { quoted: msg })

    const sourceMsg = quoted
        ? { message: quoted, key: { ...msg.key } }
        : msg

    const tmpDir = "./tmp"
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

    const tmpId = Date.now()
    const inputPath = path.join(tmpDir, `${tmpId}.webp`)
    const framesDir = path.join(tmpDir, `frames_${tmpId}`)
    const outputPath = path.join(tmpDir, `${tmpId}.mp4`)

    try {
        const buffer = await downloadMediaMessage(sourceMsg, "buffer", {})
        fs.writeFileSync(inputPath, buffer)

        // Buat folder untuk frame
        if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir)

        // Step 1: Ekstrak semua frame dari webp animasi jadi PNG
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions(["-vsync", "0"])
                .output(path.join(framesDir, "frame_%04d.png"))
                .on("end", resolve)
                .on("error", reject)
                .run()
        })

        // Cek apakah ada frame yang berhasil diekstrak
        const frames = fs.readdirSync(framesDir).filter(f => f.endsWith(".png"))
        if (frames.length === 0) {
            throw new Error("Tidak ada frame yang bisa diekstrak. Mungkin sticker tidak animasi.")
        }

        // Step 2: Gabungkan frame jadi video mp4
        await new Promise((resolve, reject) => {
            ffmpeg(path.join(framesDir, "frame_%04d.png"))
                .inputOptions(["-framerate", "15"])
                .outputOptions([
                    "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=black,format=yuv420p",
                    "-c:v", "libx264",
                    "-movflags", "+faststart",
                    "-r", "15"
                ])
                .output(outputPath)
                .on("end", resolve)
                .on("error", reject)
                .run()
        })

        const videoBuffer = fs.readFileSync(outputPath)

        await sock.sendMessage(from, {
            video: videoBuffer,
            caption: "✅ Sticker berhasil dikonversi ke video!",
            mimetype: "video/mp4"
        }, { quoted: msg })

    } catch (err) {
        console.log("❌ TOVD ERROR:", err)
        await sock.sendMessage(from, {
            text: `❌ Gagal mengkonversi.\n${err.message?.includes("frame") ? "Sticker ini bukan animasi." : "Coba sticker animasi lain."}`
        }, { quoted: msg })

    } finally {
        // Bersihkan semua file temp
        try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath) } catch {}
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) } catch {}
        try {
            if (fs.existsSync(framesDir)) {
                fs.readdirSync(framesDir).forEach(f => fs.unlinkSync(path.join(framesDir, f)))
                fs.rmdirSync(framesDir)
            }
        } catch {}
    }
}