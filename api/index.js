require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Koneksi Supabase (gunakan Service Role Key)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

app.use(express.json());

/* ------------------- Helper Functions ------------------- */
// Ambil token
async function getTokenRow(token) {
  const { data, error } = await supabase
    .from("tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Insert token baru
async function insertToken(token) {
  const { data, error } = await supabase
    .from("tokens")
    .insert([{ token, active: false }])
    .select()
    .single();
  if (error && error.code !== "23505") throw error; // 23505: duplicate
  return data;
}

// Update token
async function updateToken(token, fields) {
  const { data, error } = await supabase
    .from("tokens")
    .update(fields)
    .eq("token", token)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ------------------- ROUTES ------------------- */

// ✅ Register token
app.post("/register", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });

    const existing = await getTokenRow(token);
    if (existing) {
      return res.json({ message: "Token already registered", active: existing.active });
    }
    await insertToken(token);
    res.json({ message: "Token registered", active: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error", detail: err.message });
  }
});

// ✅ Activate token
app.post("/activate", async (req, res) => {
  try {
    const { token, durationMonths, permanent } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });

    const found = await getTokenRow(token);
    if (!found) return res.status(404).json({ error: "Token not found" });

    let expireAt = null;
    if (!permanent) {
      if (!durationMonths || Number(durationMonths) <= 0) {
        return res.status(400).json({ error: "durationMonths required unless permanent" });
      }
      const d = new Date();
      d.setMonth(d.getMonth() + Number(durationMonths));
      expireAt = d.toISOString();
    }

    const updated = await updateToken(token, { active: true, expire_at: expireAt });
    res.json({
      message: permanent ? "Token activated permanently" : "Token activated",
      token,
      expireAt: updated.expire_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error", detail: err.message });
  }
});

// ✅ Cek token
app.get("/cek", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "token required" });

    const found = await getTokenRow(token);
    if (!found) return res.json({ valid: false, reason: "not_found" });
    if (!found.active) return res.json({ valid: false, reason: "inactive" });

    if (found.expire_at === null) {
      return res.json({ valid: true, expireAt: null, permanent: true });
    }

    const now = Date.now();
    const expMs = new Date(found.expire_at).getTime();
    if (Number.isNaN(expMs)) {
      return res.json({ valid: false, reason: "expired", expireAt: found.expire_at });
    }

    res.json(
      now <= expMs
        ? { valid: true, expireAt: found.expire_at }
        : { valid: false, reason: "expired", expireAt: found.expire_at }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error", detail: err.message });
  }
});

// ✅ Deactivate token
app.post("/deactivate", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });

    const found = await getTokenRow(token);
    if (!found) return res.status(404).json({ error: "Token not found" });

    await updateToken(token, { active: false });
    res.json({ message: "Token deactivated", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error", detail: err.message });
  }
});

// ✅ Lihat semua token
app.get("/client-tokens", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error", detail: err.message });
  }
});

/* ------------------- Jalankan Server ------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
