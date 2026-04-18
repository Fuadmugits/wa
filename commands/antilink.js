let antilink = false

module.exports = async (sock, msg, args) => {
    if (args[0] === "on") {
        antilink = true
        return sock.sendMessage(msg.key.remoteJid, { text: "Antilink ON" })
    } else if (args[0] === "off") {
        antilink = false
        return sock.sendMessage(msg.key.remoteJid, { text: "Antilink OFF" })
    }
}