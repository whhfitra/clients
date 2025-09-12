const express = require("express");
const fs = require("fs");
const path = require("path");
const serverless = require("serverless-http");

const app = express();

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

// Routes
app.get("/", (req, res) => {
  res.json({ message: "API jalan 🚀" });
});

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
    active: false,
    createdAt: new Date().toISOString(),
    expireAt: null
  });

  saveTokens(tokens);
  res.json({ message: "Token registered", active: false });
});

app.post("/activate", (req, res) => {
  const { token, durationMonths, permanent } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  const tokens = loadTokens();
  const found = tokens.find(t => t.token === token);

  if (!found) return res.status(404).json({ error: "Token not found" });

  let expireAt = null;
  if (permanent) {
    expireAt = null;
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
    token,
    expireAt
  });
});

// ✅ Export ke Vercel
module.exports = app;
module.exports.handler = serverless(app);
