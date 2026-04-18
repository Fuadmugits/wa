const express = require("express")
const fs = require("fs")
const fsPromises = require("fs").promises
const path = require("path")
const QRCode = require("qrcode")
const { startSession, stopSession, startAllSessions, sessions } = require("./sessionManager")

const app = express()
const PORT = 3000

// Password admin dashboard — GANTI INI
const ADMIN_PASSWORD = "password123"

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))

// =====================
// HELPER
// =====================
const readDB = () => {
    try {
        if (!fs.existsSync("./reseller.json")) return {}
        return JSON.parse(fs.readFileSync("./reseller.json", "utf-8"))
    } catch { return {} }
}

const writeDB = async (data) => {
    await fsPromises.writeFile("./reseller.json", JSON.stringify(data, null, 2))
}

// =====================
// AUTH MIDDLEWARE (admin)
// =====================
function auth(req, res, next) {
    const pass = req.headers["x-admin-password"] || req.body?.password
    if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" })
    next()
}

// =====================
// HALAMAN QR PELANGGAN
// Akses: /qr?nomor=628xxx&key=TOKEN_UNIK
// =====================
app.get("/qr", async (req, res) => {
    const { nomor, key } = req.query
    if (!nomor || !key) return res.status(400).send("Parameter tidak lengkap")

    const db = readDB()
    const user = db[nomor]

    if (!user) return res.status(404).send("Nomor tidak terdaftar")
    if (user.accessKey !== key) return res.status(403).send("Akses ditolak")
    if (user.status === "expired") return res.send(pageExpired(user))
    if (user.status === "stopped") return res.send(pageExpired(user))

    const session = sessions[nomor]
    const isConnected = session?.connected || false
    const qrString = session?.qr || null

    let qrImageBase64 = null
    if (qrString) {
        qrImageBase64 = await QRCode.toDataURL(qrString, { width: 280, margin: 2 })
    }

    res.send(pageQR(user, isConnected, qrImageBase64))
})

// =====================
// API: Status untuk pelanggan (polling)
// =====================
app.get("/api/client/status", async (req, res) => {
    const { nomor, key } = req.query
    if (!nomor || !key) return res.status(400).json({ error: "Parameter tidak lengkap" })

    const db = readDB()
    const user = db[nomor]
    if (!user || user.accessKey !== key) return res.status(403).json({ error: "Akses ditolak" })

    const session = sessions[nomor]
    const isConnected = session?.connected || false
    const qrString = session?.qr || null

    let qrImageBase64 = null
    if (qrString) {
        qrImageBase64 = await QRCode.toDataURL(qrString, { width: 280, margin: 2 })
    }

    res.json({
        connected: isConnected,
        status: user.status,
        expiredAt: user.expiredAt,
        hasQR: !!qrString,
        qr: qrImageBase64
    })
})

// =====================
// HTML: Halaman expired
// =====================
function pageExpired(user) {
    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bot Expired</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 2rem; text-align: center; max-width: 340px; width: 90%; }
  .icon { font-size: 48px; margin-bottom: 1rem; }
  h2 { font-size: 18px; font-weight: 600; color: #fff; margin-bottom: 8px; }
  p { font-size: 13px; color: #666; line-height: 1.6; }
  .nama { color: #25d366; font-weight: 600; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">⏰</div>
  <h2>Masa Sewa Habis</h2>
  <p>Halo <span class="nama">${user.nama}</span>, masa sewa bot kamu sudah berakhir.<br><br>Silakan hubungi admin untuk perpanjang.</p>
</div>
</body>
</html>`
}

// =====================
// HTML: Halaman QR pelanggan
// =====================
function pageQR(user, isConnected, qrImageBase64) {
    const exp = new Date(user.expiredAt)
    const now = new Date()
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scan QR Bot</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 2rem; text-align: center; max-width: 380px; width: 100%; }
  .logo { font-size: 32px; margin-bottom: 0.5rem; }
  h1 { font-size: 18px; font-weight: 600; color: #fff; margin-bottom: 4px; }
  .nama { color: #25d366; }
  .info-row { display: flex; justify-content: space-between; background: #111; border-radius: 8px; padding: 10px 14px; margin: 1rem 0; font-size: 12px; }
  .info-label { color: #555; }
  .info-val { color: #ccc; font-weight: 500; }
  .info-val.green { color: #25d366; }
  .info-val.red { color: #e74c3c; }

  /* STATUS BADGE */
  .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 1.5rem; }
  .status-online { background: #0d3320; color: #25d366; }
  .status-offline { background: #3a2200; color: #f39c12; }
  .dot { width: 7px; height: 7px; border-radius: 50%; }
  .dot-green { background: #25d366; }
  .dot-orange { background: #f39c12; }

  /* QR BOX */
  .qr-box { background: #fff; border-radius: 12px; padding: 12px; display: inline-block; margin-bottom: 1rem; }
  .qr-box img { display: block; width: 256px; height: 256px; }
  .qr-hint { font-size: 12px; color: #555; margin-bottom: 1.5rem; line-height: 1.6; }

  /* CONNECTED STATE */
  .connected-box { background: #0d3320; border: 1px solid #1a5c3a; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
  .connected-box .check { font-size: 40px; margin-bottom: 8px; }
  .connected-box p { font-size: 13px; color: #25d366; }

  /* WAITING STATE */
  .waiting-box { padding: 1.5rem; }
  .spinner { width: 36px; height: 36px; border: 3px solid #2a2a2a; border-top-color: #25d366; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .waiting-box p { font-size: 13px; color: #555; }

  .refresh-btn { width: 100%; padding: 10px; background: #25d366; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; font-size: 14px; margin-top: 8px; }
  .refresh-btn:hover { background: #1db954; }
  .expired-warn { font-size: 11px; color: #e74c3c; margin-top: 12px; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">🤖</div>
  <h1>Bot <span class="nama">${user.nama}</span></h1>

  <div class="info-row">
    <span class="info-label">Nomor WA</span>
    <span class="info-val">${user.nomor}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Expired</span>
    <span class="info-val ${diffDays <= 3 ? "red" : "green"}">${exp.toLocaleDateString("id-ID")} (${diffDays} hari lagi)</span>
  </div>

  <div id="status-area">
    ${isConnected
        ? `<div class="status-badge status-online"><span class="dot dot-green"></span>Bot Online</div>
           <div class="connected-box">
             <div class="check">✅</div>
             <p>Bot kamu sudah terhubung dan siap digunakan!</p>
           </div>`
        : qrImageBase64
        ? `<div class="status-badge status-offline"><span class="dot dot-orange"></span>Menunggu Scan</div>
           <div class="qr-box"><img src="${qrImageBase64}" alt="QR Code"></div>
           <p class="qr-hint">Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat<br>lalu scan QR di atas</p>`
        : `<div class="status-badge status-offline"><span class="dot dot-orange"></span>Memuat QR...</div>
           <div class="waiting-box">
             <div class="spinner"></div>
             <p>QR sedang disiapkan, tunggu sebentar...</p>
           </div>`
    }
  </div>

  <button class="refresh-btn" onclick="checkStatus()">↻ Refresh Status</button>
  ${diffDays <= 3 ? `<p class="expired-warn">⚠️ Masa sewa hampir habis! Segera perpanjang ke admin.</p>` : ""}
</div>

<script>
  const nomor = "${user.nomor}"
  const key = "${user.accessKey}"

  async function checkStatus() {
    const btn = document.querySelector(".refresh-btn")
    btn.textContent = "Memuat..."
    btn.disabled = true

    try {
      const res = await fetch("/api/client/status?nomor=" + nomor + "&key=" + key)
      const data = await res.json()

      const area = document.getElementById("status-area")

      if (data.connected) {
        area.innerHTML = \`
          <div class="status-badge status-online"><span class="dot dot-green"></span>Bot Online</div>
          <div class="connected-box">
            <div class="check">✅</div>
            <p>Bot kamu sudah terhubung dan siap digunakan!</p>
          </div>\`
      } else if (data.hasQR && data.qr) {
        area.innerHTML = \`
          <div class="status-badge status-offline"><span class="dot dot-orange"></span>Menunggu Scan</div>
          <div class="qr-box"><img src="\${data.qr}" alt="QR Code" style="width:256px;height:256px;display:block;"></div>
          <p class="qr-hint">Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat<br>lalu scan QR di atas</p>\`
      } else {
        area.innerHTML = \`
          <div class="status-badge status-offline"><span class="dot dot-orange"></span>Memuat QR...</div>
          <div class="waiting-box">
            <div class="spinner"></div>
            <p>QR sedang disiapkan, tunggu sebentar...</p>
          </div>\`
      }
    } catch(e) {}

    btn.textContent = "↻ Refresh Status"
    btn.disabled = false
  }

  // Auto refresh tiap 10 detik
  setInterval(checkStatus, 10000)
</script>
</body>
</html>`
}

// =====================
// API ADMIN
// =====================
app.get("/api/users", auth, (req, res) => {
    const db = readDB()
    const result = {}
    for (const nomor in db) {
        result[nomor] = {
            ...db[nomor],
            sessionActive: !!sessions[nomor],
            connected: sessions[nomor]?.connected || false,
            hasQR: !!sessions[nomor]?.qr
        }
    }
    res.json(result)
})

app.post("/api/users/add", auth, async (req, res) => {
    const { nomor, nama, durasi } = req.body
    if (!nomor || !nama || !durasi) return res.status(400).json({ error: "nomor, nama, durasi wajib diisi" })

    const cleanNomor = nomor.replace(/[^0-9]/g, "")
    const waId = cleanNomor.startsWith("0") ? "62" + cleanNomor.slice(1) : cleanNomor

    const db = readDB()
    if (db[waId] && db[waId].status === "active") return res.status(400).json({ error: "Nomor sudah terdaftar dan aktif" })

    const now = new Date()
    const expiredAt = new Date(now.getTime() + parseInt(durasi) * 24 * 60 * 60 * 1000)

    // Generate access key unik untuk link QR pelanggan
    const accessKey = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

    db[waId] = {
        nama,
        nomor: waId,
        status: "active",
        accessKey,
        createdAt: now.toISOString(),
        expiredAt: expiredAt.toISOString(),
        durasi: parseInt(durasi)
    }

    await writeDB(db)
    await startSession(waId)

    // Link yang dikirim ke pelanggan
    const clientLink = `/qr?nomor=${waId}&key=${accessKey}`

    res.json({
        success: true,
        message: `Pelanggan ${nama} berhasil ditambahkan`,
        expiredAt: expiredAt.toISOString(),
        clientLink
    })
})

app.post("/api/users/extend", auth, async (req, res) => {
    const { nomor, durasi } = req.body
    const db = readDB()
    if (!db[nomor]) return res.status(404).json({ error: "Nomor tidak ditemukan" })

    const now = new Date()
    const currentExpired = new Date(db[nomor].expiredAt)
    const base = currentExpired > now ? currentExpired : now
    const newExpired = new Date(base.getTime() + parseInt(durasi) * 24 * 60 * 60 * 1000)

    db[nomor].expiredAt = newExpired.toISOString()
    db[nomor].status = "active"
    await writeDB(db)

    if (!sessions[nomor]) await startSession(nomor)

    res.json({ success: true, message: `Diperpanjang ${durasi} hari`, expiredAt: newExpired.toISOString() })
})

app.post("/api/users/stop", auth, async (req, res) => {
    const { nomor } = req.body
    const db = readDB()
    if (!db[nomor]) return res.status(404).json({ error: "Nomor tidak ditemukan" })
    stopSession(nomor)
    db[nomor].status = "stopped"
    await writeDB(db)
    res.json({ success: true, message: `Session ${nomor} dihentikan` })
})

app.delete("/api/users/:nomor", auth, async (req, res) => {
    const { nomor } = req.params
    const db = readDB()
    if (!db[nomor]) return res.status(404).json({ error: "Nomor tidak ditemukan" })
    stopSession(nomor)
    delete db[nomor]
    const sessionDir = `./sessions/${nomor}`
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true })
    await writeDB(db)
    res.json({ success: true, message: `Pelanggan ${nomor} dihapus` })
})

app.post("/api/users/restart", auth, async (req, res) => {
    const { nomor } = req.body
    stopSession(nomor)
    await new Promise(r => setTimeout(r, 1000))
    await startSession(nomor)
    res.json({ success: true, message: `Session ${nomor} di-restart` })
})

app.get("/api/status", auth, (req, res) => {
    const db = readDB()
    const total = Object.keys(db).length
    const active = Object.values(db).filter(u => u.status === "active").length
    const expired = Object.values(db).filter(u => u.status === "expired").length
    const connected = Object.values(sessions).filter(s => s.connected).length
    res.json({ total, active, expired, connected })
})

// =====================
// SERVE DASHBOARD ADMIN
// =====================
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"))
})

// =====================
// START
// =====================
app.listen(PORT, async () => {
    console.log(`🌐 Dashboard admin : http://localhost:${PORT}`)
    console.log(`🔑 Password admin  : ${ADMIN_PASSWORD}`)
    console.log(`📱 Contoh link QR  : http://localhost:${PORT}/qr?nomor=628xxx&key=TOKEN`)
    await startAllSessions()
})