const { Sticker } = require("wa-sticker-formatter")

async function createSticker(buffer, pack, author) {
    return new Sticker(buffer, {
        pack,
        author,
        type: "full",
        quality: 100
    }).toBuffer()
}

module.exports = { createSticker }