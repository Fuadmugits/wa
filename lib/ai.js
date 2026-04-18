module.exports = async (sock, msg, args) => {
    const query = args.join(" ")

    if (!query) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "Contoh: .ai halo"
        })
    }

    sock.sendMessage(msg.key.remoteJid, {
        text: "🤖 AI: Saya masih versi basic 😄"
    })
}