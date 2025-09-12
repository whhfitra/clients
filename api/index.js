const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// File simpan token
const DATA_FILE = path.join(__dirname, "tokens.json");

app.use(express.json());

// Baca data dari file
function loadTokens() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

// Simpan data ke file
function saveTokens(tokens) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tokens, null, 2));
}

// ✅ Register token (belum aktif)
app.post("/register", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  const tokens = loadTokens();
  const exists = tokens.find(t => t.token === token);

  if (exists) {
    return res.json({ message: "Token already registered", active: exists.active });
  }

  tokens.push({
    token,
    active: false,               // default belum aktif
    createdAt: new Date().toISOString(),
    expireAt: null               // belum ada durasi
  });

  saveTokens(tokens);
  res.json({ message: "Token registered", active: false });
});

// ✅ Activate token (dengan durasi bulan atau permanen)
app.post("/activate", (req, res) => {
  const { token, durationMonths, permanent } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  const tokens = loadTokens();
  const found = tokens.find(t => t.token === token);

  if (!found) {
    return res.status(404).json({ error: "Token not found" });
  }

  let expireAt = null;

  if (permanent) {
    expireAt = null; // tidak pernah expired
  } else {
    if (!durationMonths) return res.status(400).json({ error: "durationMonths required unless permanent" });
    expireAt = new Date();
    expireAt.setMonth(expireAt.getMonth() + durationMonths);
    expireAt = expireAt.toISOString();
  }

  found.active = true;
  found.expireAt = expireAt;

  saveTokens(tokens);
  res.json({
    message: permanent ? "Token activated permanently" : "Token activated",
    token: token,
    expireAt: expireAt
  });
});

// ✅ Cek token
app.get("/cek", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token required" });

  const tokens = loadTokens();
  const found = tokens.find(t => t.token === token);

  if (!found) return res.json({ valid: false, reason: "not_found" });
  if (!found.active) return res.json({ valid: false, reason: "inactive" });

  if (found.expireAt === null) {
    return res.json({ valid: true, expireAt: null, permanent: true });
  }

  const now = Date.now();
  const expireAt = new Date(found.expireAt).getTime();

  if (now <= expireAt) {
    return res.json({ valid: true, expireAt: found.expireAt });
  } else {
    return res.json({ valid: false, reason: "expired", expireAt: found.expireAt });
  }
});

// ✅ Deactivate token
app.post("/deactivate", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  const tokens = loadTokens();
  const found = tokens.find(t => t.token === token);

  if (!found) {
    return res.status(404).json({ error: "Token not found" });
  }

  found.active = false;

  saveTokens(tokens);
  res.json({ message: "Token deactivated", token: token });
});

// ✅ Lihat semua token (apa adanya, tanpa masking)
app.get("/client-tokens", (req, res) => {
  const tokens = loadTokens();
  res.json(tokens);
});


// Jalankan server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});