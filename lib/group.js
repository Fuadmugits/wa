async function getGroupAdmins(sock, jid) {
    const meta = await sock.groupMetadata(jid)
    return meta.participants
        .filter(p => p.admin)
        .map(p => p.id)
}

module.exports = { getGroupAdmins }