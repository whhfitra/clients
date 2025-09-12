const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = 3000;

// 🔑 Supabase config
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(express.json());

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

// ✅ Activate token (bulan / permanent)
app.post("/activate", async (req, res) => {
  const { token, durationMonths, permanent } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  let expireAt = null;
  if (!permanent) {
    if (!durationMonths) return res.status(400).json({ error: "durationMonths required unless permanent" });
    const now = new Date();
    now.setMonth(now.getMonth() + durationMonths);
    expireAt = now.toISOString();
  }

  const { data, error } = await supabase
    .from("tokens")
    .update({ active: true, expire_at: expireAt })
    .eq("token", token)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (data.length === 0) return res.status(404).json({ error: "Token not found" });

  res.json({
    message: permanent ? "Token activated permanently" : "Token activated",
    token: token,
    expireAt: expireAt
  });
});

// ✅ Cek token
app.get("/cek", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token required" });

  const { data, error } = await supabase
    .from("tokens")
    .select("*")
    .eq("token", token);

  if (error) return res.status(500).json({ error: error.message });
  if (data.length === 0) return res.json({ valid: false, reason: "not_found" });

  const found = data[0];
  if (!found.active) return res.json({ valid: false, reason: "inactive" });

  if (!found.expire_at) {
    return res.json({ valid: true, expireAt: null, permanent: true });
  }

  const now = Date.now();
  const expireAt = new Date(found.expire_at).getTime();

  if (now <= expireAt) {
    return res.json({ valid: true, expireAt: found.expire_at });
  } else {
    return res.json({ valid: false, reason: "expired", expireAt: found.expire_at });
  }
});

// ✅ Deactivate token
app.post("/deactivate", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  const { data, error } = await supabase
    .from("tokens")
    .update({ active: false })
    .eq("token", token)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (data.length === 0) return res.status(404).json({ error: "Token not found" });

  res.json({ message: "Token deactivated", token: token });
});

// ✅ List semua token
app.get("/client-tokens", async (req, res) => {
  const { data, error } = await supabase.from("tokens").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
