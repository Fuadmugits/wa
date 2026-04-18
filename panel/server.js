const express = require("express")
const session = require("express-session")
const bodyParser = require("body-parser")
const fs = require("fs")
const path = require("path")
const { v4: uuidv4 } = require("uuid")

const config = require("./config")

const app = express()
const PORT = 3000

// =====================
// 🔥 DATABASE PATH (AMAN)
// =====================
const DB = {
    premium: path.join(__dirname, "../database/premium.json"),
    sewa: path.join(__dirname, "../database/sewa.json"),
    reseller: path.join(__dirname, "../database/reseller.json"),
    transaksi: path.join(__dirname, "../database/transaksi.json"),
    payment: path.join(__dirname, "../database/payment.json"),
    warn: path.join(__dirname, "../database/warn.json")
}

// =====================
// 🔥 AUTO CREATE DATABASE
// =====================
Object.values(DB).forEach(file => {
    const dir = path.dirname(file)

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }

    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, "{}")
    }
})

// =====================
// 🔧 MIDDLEWARE
// =====================
app.use(bodyParser.urlencoded({ extended: true }))

app.use(session({
    secret: "panel-secret",
    resave: false,
    saveUninitialized: true
}))

// =====================
// 🛠️ UTILS
// =====================
function readJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(file))
    } catch {
        return {}
    }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function isLogin(req, res, next) {
    if (!req.session.user) return res.redirect("/")
    next()
}

// =====================
// 🔐 LOGIN
// =====================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views/login.html"))
})

app.post("/login", (req, res) => {
    const { username, password } = req.body

    if (
        username === config.admin.username &&
        password === config.admin.password
    ) {
        req.session.user = { role: "admin" }
        return res.redirect("/dashboard")
    }

    res.send("❌ Login gagal")
})

// =====================
// 📊 DASHBOARD
// =====================
app.get("/dashboard", isLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "views/dashboard.html"))
})

// =====================
// 💸 CREATE PAYMENT
// =====================
app.post("/buy/premium", isLogin, (req, res) => {
    const { number, days } = req.body

    const harga = {
        7: 5000,
        30: 15000
    }

    const amount = harga[days]

    if (!amount) return res.send("❌ Paket tidak tersedia")

    const id = uuidv4()

    let payment = readJSON(DB.payment)

    payment[id] = {
        type: "premium",
        number,
        days,
        amount,
        status: "pending",
        created: Date.now()
    }

    saveJSON(DB.payment, payment)

    res.redirect(`/invoice/${id}`)
})

// =====================
// 📄 INVOICE
// =====================
app.get("/invoice/:id", isLogin, (req, res) => {
    const payment = readJSON(DB.payment)
    const data = payment[req.params.id]

    if (!data) return res.send("❌ Transaksi tidak ditemukan")

    res.send(`
    <html>
    <head>
    <title>Invoice</title>
    <style>
    body {
        font-family: Arial;
        background:#0f172a;
        color:white;
        text-align:center
    }
    .card {
        background:#1e293b;
        padding:20px;
        margin:50px auto;
        width:320px;
        border-radius:10px;
    }
    </style>
    </head>

    <body>
    <div class="card">
        <h2>💳 Pembayaran Premium</h2>
        <p>ID: ${req.params.id}</p>
        <p>Nomor: ${data.number}</p>
        <p>Total: Rp${data.amount}</p>

        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${req.params.id}" />

        <p>Status: ${data.status}</p>

        <button onclick="location.reload()">🔄 Refresh</button>
    </div>
    </body>
    </html>
    `)
})

// =====================
// 👑 ADD PREMIUM
// =====================
app.post("/addprem", isLogin, (req, res) => {
    const { number, days } = req.body

    let db = readJSON(DB.premium)

    db[number + "@s.whatsapp.net"] =
        Date.now() + days * 86400000

    saveJSON(DB.premium, db)

    res.redirect("/dashboard")
})

// =====================
// 💰 ADD SEWA
// =====================
app.post("/addsewa", isLogin, (req, res) => {
    const { group, days } = req.body

    let db = readJSON(DB.sewa)

    db[group] = Date.now() + days * 86400000

    saveJSON(DB.sewa, db)

    res.redirect("/dashboard")
})

// =====================
// 🤝 RESELLER
// =====================
app.post("/addreseller", isLogin, (req, res) => {
    const { number } = req.body

    let db = readJSON(DB.reseller)
    db[number] = true

    saveJSON(DB.reseller, db)

    res.redirect("/reseller")
})

app.get("/reseller", isLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "views/reseller.html"))
})

// =====================
// 📜 TRANSAKSI
// =====================
app.get("/transaksi", isLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "views/transaksi.html"))
})

app.get("/api/transaksi", isLogin, (req, res) => {
    res.json(readJSON(DB.transaksi))
})

// =====================
// 🤖 AUTO CONFIRM PAYMENT
// =====================
setInterval(() => {
    let payment = readJSON(DB.payment)
    let premium = readJSON(DB.premium)
    let transaksi = readJSON(DB.transaksi)

    for (let id in payment) {
        let trx = payment[id]

        if (trx.status === "pending") {

            // AUTO PAID (10 detik simulasi)
            if (Date.now() - trx.created > 10000) {
                trx.status = "paid"

                if (trx.type === "premium") {
                    premium[trx.number + "@s.whatsapp.net"] =
                        Date.now() + trx.days * 86400000
                }

                // 🔥 LOG TRANSAKSI
                transaksi[id] = {
                    type: trx.type,
                    number: trx.number,
                    amount: trx.amount,
                    status: "paid",
                    time: Date.now()
                }

                console.log("✅ Payment masuk:", id)
            }

            // ❌ EXPIRED (10 menit)
            if (Date.now() - trx.created > 600000) {
                delete payment[id]
            }
        }
    }

    saveJSON(DB.payment, payment)
    saveJSON(DB.premium, premium)
    saveJSON(DB.transaksi, transaksi)

}, 5000)

// =====================
app.listen(PORT, () => {
    console.log("🔥 PANEL BISNIS: http://localhost:" + PORT)
})