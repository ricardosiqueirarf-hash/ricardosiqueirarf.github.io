import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 10000);

const supabase = createClient(
  process.env.SUPABASE_URL || "http://localhost",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "missing-service-role-key",
  { auth: { persistSession: false } }
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function missingEnv() {
  return ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((key) => !process.env[key]);
}

function requireCrmPassword(req, res, next) {
  const expected = process.env.CRM_ACCESS_PASSWORD || "";
  if (!expected) return next();
  const received = req.header("x-crm-password") || req.query.password || "";
  if (received === expected) return next();
  return res.status(401).json({ ok: false, error: "unauthorized" });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, mode: "read-only-monitor-panel", missingEnv: missingEnv() });
});

app.get("/api/config", requireCrmPassword, (_req, res) => {
  res.json({ ok: true, mode: "read-only", missingEnv: missingEnv(), hasPassword: Boolean(process.env.CRM_ACCESS_PASSWORD) });
});

app.get("/api/conversations", requireCrmPassword, async (_req, res) => {
  const { data, error } = await supabase
    .from("crm_conversations")
    .select("id, wa_id, status, unread_count, last_message_at, updated_at, crm_leads(id, name, phone, source)")
    .order("last_message_at", { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.json({ ok: true, conversations: data || [] });
});

app.get("/api/conversations/:id/messages", requireCrmPassword, async (req, res) => {
  const { data, error } = await supabase
    .from("crm_messages")
    .select("id, direction, sender_handle, body, status, error_text, created_at")
    .eq("conversation_id", req.params.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) return res.status(500).json({ ok: false, error: error.message });

  await supabase
    .from("crm_conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", req.params.id);

  return res.json({ ok: true, messages: data || [] });
});

app.get("/api/leads", requireCrmPassword, async (_req, res) => {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("id, name, phone, source, first_message, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.json({ ok: true, leads: data || [] });
});

app.all("/api/conversations/:id/reply", requireCrmPassword, (_req, res) => {
  return res.status(403).json({ ok: false, error: "CRM em modo monitoramento: envio desativado." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ColorGlass CRM monitor-only panel running on port ${PORT}`);
  const missing = missingEnv();
  if (missing.length) console.warn("Missing env:", missing.join(", "));
});
