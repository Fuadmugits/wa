const axios = require("axios")

async function tiktok(url) {
    const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${url}`)
    return res.data.video.noWatermark
}

module.exports = { tiktok }