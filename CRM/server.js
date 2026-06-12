import crypto from "node:crypto";
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
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
];

function missingEnv() {
  return requiredEnv.filter((key) => !process.env[key]);
}

const supabase = createClient(
  process.env.SUPABASE_URL || "http://localhost",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "missing-service-role-key",
  { auth: { persistSession: false } }
);

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function normalizePhone(value = "") {
  return String(value).replace(/\D/g, "");
}

function requireCrmPassword(req, res, next) {
  const expected = process.env.CRM_ACCESS_PASSWORD || "";
  if (!expected) return next();

  const received = req.header("x-crm-password") || req.query.password || "";
  if (received === expected) return next();
  return res.status(401).json({ ok: false, error: "unauthorized" });
}

function verifyMetaSignature(req) {
  const appSecret = process.env.WHATSAPP_APP_SECRET || "";
  if (!appSecret) return true;

  const signature = req.header("x-hub-signature-256") || "";
  if (!signature.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(req.rawBody || "")
    .digest("hex");

  const provided = signature.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(provided, "hex");

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function messageBodyFromWhatsApp(message) {
  if (message?.type === "text" && message?.text?.body) return message.text.body;
  if (message?.type === "button" && message?.button?.text) return message.button.text;
  if (message?.type === "interactive") {
    return (
      message?.interactive?.button_reply?.title ||
      message?.interactive?.list_reply?.title ||
      "[resposta interativa recebida]"
    );
  }
  if (message?.image?.caption) return `[imagem] ${message.image.caption}`;
  if (message?.document?.caption) return `[documento] ${message.document.caption}`;
  if (message?.document?.filename) return `[documento] ${message.document.filename}`;
  return `[${message?.type || "mensagem"} recebida]`;
}

function contactName(contacts = [], waId = "") {
  const found = contacts.find((contact) => contact.wa_id === waId) || contacts[0];
  return found?.profile?.name || null;
}

async function ensureLead({ waId, name, firstMessage }) {
  const phone = `+${waId}`;

  const { data: existing, error: lookupError } = await supabase
    .from("crm_leads")
    .select("id, name, phone, wa_id")
    .eq("wa_id", waId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from("crm_leads")
    .insert({
      wa_id: waId,
      name: name || `WhatsApp ${phone}`,
      phone,
      source: "WhatsApp direto",
      first_message: firstMessage.slice(0, 1000),
    })
    .select("id, name, phone, wa_id")
    .single();

  if (error) throw error;
  return data;
}

async function ensureConversation({ leadId, waId }) {
  const { data: existing, error: lookupError } = await supabase
    .from("crm_conversations")
    .select("id, lead_id, wa_id, unread_count")
    .eq("wa_id", waId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from("crm_conversations")
    .insert({
      lead_id: leadId,
      wa_id: waId,
      status: "open",
      unread_count: 0,
      last_message_at: new Date().toISOString(),
    })
    .select("id, lead_id, wa_id, unread_count")
    .single();

  if (error) throw error;
  return data;
}

async function insertInboundMessage({ conversationId, waId, externalMessageId, body, createdAt }) {
  const { data: existing, error: lookupError } = await supabase
    .from("crm_messages")
    .select("id")
    .eq("external_message_id", externalMessageId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing?.id) return { inserted: false };

  const { error } = await supabase.from("crm_messages").insert({
    conversation_id: conversationId,
    external_message_id: externalMessageId,
    direction: "inbound",
    sender_handle: waId,
    body,
    status: "received",
    created_at: createdAt,
  });

  if (error) throw error;
  return { inserted: true };
}

async function processInboundMessage({ message, contacts }) {
  const waId = normalizePhone(message?.from);
  const externalMessageId = message?.id;
  if (!waId || !externalMessageId) return { ok: false, skipped: true };

  const body = messageBodyFromWhatsApp(message).trim().slice(0, 8000);
  const createdAt = message?.timestamp
    ? new Date(Number(message.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const lead = await ensureLead({
    waId,
    name: contactName(contacts, waId),
    firstMessage: body,
  });

  const conversation = await ensureConversation({ leadId: lead.id, waId });
  const inserted = await insertInboundMessage({
    conversationId: conversation.id,
    waId,
    externalMessageId,
    body,
    createdAt,
  });

  if (inserted.inserted) {
    await supabase
      .from("crm_conversations")
      .update({
        last_message_at: createdAt,
        status: "open",
        unread_count: Number(conversation.unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }

  return { ok: true, inserted: inserted.inserted };
}

async function updateMessageStatus(status) {
  const externalMessageId = status?.id;
  if (!externalMessageId) return false;

  const state = ["sent", "delivered", "read", "failed"].includes(status.status)
    ? status.status
    : "queued";

  const errorText = status?.errors?.[0]
    ? status.errors[0]?.error_data?.details || status.errors[0]?.message || status.errors[0]?.title || "failed"
    : null;

  const { error } = await supabase
    .from("crm_messages")
    .update({ status: state, error_text: errorText, updated_at: new Date().toISOString() })
    .eq("external_message_id", externalMessageId);

  if (error) throw error;
  return true;
}

async function sendWhatsAppText({ to, body }) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const error = parsed?.error?.message || text || `HTTP ${response.status}`;
    throw new Error(error);
  }

  return parsed?.messages?.[0]?.id || null;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, missingEnv: missingEnv() });
});

app.get("/api/config", requireCrmPassword, (_req, res) => {
  res.json({ ok: true, missingEnv: missingEnv(), hasPassword: Boolean(process.env.CRM_ACCESS_PASSWORD) });
});

app.get("/api/public/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return res.status(200).send(String(challenge));
  }

  return res.status(403).send("Forbidden");
});

app.post("/api/public/whatsapp/webhook", async (req, res) => {
  if (!verifyMetaSignature(req)) {
    return res.status(401).json({ ok: false, error: "invalid_signature" });
  }

  try {
    let received = 0;
    let statuses = 0;
    let skipped = 0;
    const payload = req.body || {};

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        for (const message of value.messages || []) {
          const result = await processInboundMessage({ message, contacts: value.contacts || [] });
          if (result.inserted) received += 1;
          else skipped += 1;
        }

        for (const status of value.statuses || []) {
          await updateMessageStatus(status);
          statuses += 1;
        }
      }
    }

    return res.json({ ok: true, received, statuses, skipped });
  } catch (error) {
    console.error("whatsapp webhook error", error);
    return res.status(200).json({ ok: false, error: "webhook_processing_failed" });
  }
});

app.get("/api/conversations", requireCrmPassword, async (_req, res) => {
  const { data, error } = await supabase
    .from("crm_conversations")
    .select("id, wa_id, status, unread_count, last_message_at, updated_at, crm_leads(id, name, phone, source)")
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.json({ ok: true, conversations: data || [] });
});

app.get("/api/conversations/:id/messages", requireCrmPassword, async (req, res) => {
  const { data, error } = await supabase
    .from("crm_messages")
    .select("id, direction, sender_handle, body, status, error_text, created_at")
    .eq("conversation_id", req.params.id)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) return res.status(500).json({ ok: false, error: error.message });

  await supabase
    .from("crm_conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", req.params.id);

  return res.json({ ok: true, messages: data || [] });
});

app.post("/api/conversations/:id/reply", requireCrmPassword, async (req, res) => {
  const body = String(req.body?.body || "").trim();
  if (!body) return res.status(400).json({ ok: false, error: "Mensagem vazia" });

  const { data: conversation, error: conversationError } = await supabase
    .from("crm_conversations")
    .select("id, wa_id")
    .eq("id", req.params.id)
    .single();

  if (conversationError) return res.status(404).json({ ok: false, error: conversationError.message });

  try {
    const externalMessageId = await sendWhatsAppText({ to: conversation.wa_id, body });
    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from("crm_messages").insert({
      conversation_id: conversation.id,
      external_message_id: externalMessageId,
      direction: "outbound",
      sender_handle: "agent",
      body,
      status: "sent",
      created_at: now,
    });

    if (insertError) throw insertError;

    await supabase
      .from("crm_conversations")
      .update({ last_message_at: now, updated_at: now })
      .eq("id", conversation.id);

    return res.json({ ok: true, externalMessageId });
  } catch (error) {
    console.error("reply error", error);
    return res.status(500).json({ ok: false, error: error.message || "Erro ao enviar" });
  }
});

app.get("/api/leads", requireCrmPassword, async (_req, res) => {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("id, name, phone, source, first_message, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.json({ ok: true, leads: data || [] });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "server_error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ColorGlass CRM WhatsApp MVP running on port ${PORT}`);
  const missing = missingEnv();
  if (missing.length) console.warn("Missing env:", missing.join(", "));
});
