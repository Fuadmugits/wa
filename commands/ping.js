module.exports = async (sock, msg) => {
    sock.sendMessage(msg.key.remoteJid, { text: "pong 🏓" })
}