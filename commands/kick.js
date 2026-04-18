module.exports = async (sock, msg) => {
    const group = msg.key.remoteJid

    const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid

    if (!mentioned) return

    await sock.groupParticipantsUpdate(group, mentioned, "remove")
}