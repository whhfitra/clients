const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const serverless = require("serverless-http");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const app = express();
app.use(express.json());

// test route
app.get("/", (req, res) => {
  res.json({ message: "API is working 🚀" });
});

// ✅ Register token
app.post("/register", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  const { data, error } = await supabase
    .from("tokens")
    .select("*")
    .eq("token", token);

  if (error) return res.status(500).json({ error: error.message });
  if (data.length > 0) {
    return res.json({ message: "Token already registered", active: data[0].active });
  }

  const { error: insertError } = await supabase
    .from("tokens")
    .insert([{ token, active: false }]);

  if (insertError) return res.status(500).json({ error: insertError.message });

  res.json({ message: "Token registered", active: false });
});

// ... lanjutkan semua route yang kamu punya (activate, cek, deactivate, client-tokens)

module.exports = app;
module.exports.handler = serverless(app);
