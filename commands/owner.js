module.exports = async (sock, msg) => {
    await sock.sendMessage(msg.key.remoteJid, {
        text: "👑 Owner:\nwa.me/6289616029864"
    }, { quoted: msg })
}