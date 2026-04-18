const axios = require("axios")
const { Sticker } = require("wa-sticker-formatter")

module.exports = async (sock, msg, args) => {
    const from = msg.key.remoteJid
    const text = args.join(" ")

    if (!text) {
        return sock.sendMessage(from, {
            text: "❌ Contoh: .qc halo dunia"
        }, { quoted: msg })
    }

    try {
        const res = await axios.post("https://bot.lyo.su/quote/generate", {
            type: "quote",
            format: "png",
            backgroundColor: "#000000",
            width: 512,
            height: 768,
            scale: 2,
            messages: [
                {
                    entities: [],
                    avatar: true,
                    from: {
                        id: 1,
                        name: msg.pushName || "User",
                        photo: {
                            url: "https://telegra.ph/file/3f3c0f4f1c3b3d0c7f4c9.jpg"
                        }
                    },
                    text: text
                }
            ]
        })

        const image = Buffer.from(res.data.result.image, "base64")

        const sticker = new Sticker(image, {
            pack: "Quote 😎",
            author: "Fuad Bot",
            type: "full"
        })

        const buffer = await sticker.toBuffer()

        await sock.sendMessage(from, {
            sticker: buffer
        }, { quoted: msg })

    } catch (err) {
        console.log(err)
        sock.sendMessage(from, {
            text: "❌ Gagal membuat quote"
        }, { quoted: msg })
    }
}