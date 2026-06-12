import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0";

type WhatsappChannel = {
  id: string;
  company_id: string;
  config: Json;
};

type WhatsappContact = {
  wa_id?: string;
  profile?: { name?: string };
};

type WhatsappInboundMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { caption?: string };
  document?: { caption?: string; filename?: string };
  button?: { text?: string };
  interactive?: {
    type?: string;
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
};

type WhatsappStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
};

type WhatsappWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: {
          phone_number_id?: string;
          display_phone_number?: string;
        };
        contacts?: WhatsappContact[];
        messages?: WhatsappInboundMessage[];
        statuses?: WhatsappStatus[];
      };
    }>;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeWhatsappHandle(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  if (!appSecret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const providedHex = signatureHeader.slice("sha256=".length);

  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");
  if (expected.length !== provided.length) return false;
  return nodeTimingSafeEqual(expected, provided);
}

function getConfigString(config: Json, key: string): string | null {
  const record = asRecord(config);
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function resolveWhatsappChannel(phoneNumberId: string): Promise<WhatsappChannel | null> {
  if (phoneNumberId) {
    const { data: exact, error: exactErr } = await supabaseAdmin
      .from("channels")
      .select("id, company_id, config")
      .eq("kind", "whatsapp")
      .eq("status", "active")
      .contains("config", { phone_number_id: phoneNumberId })
      .limit(1)
      .maybeSingle();

    if (exactErr) console.error("[whatsapp-webhook] resolve exact failed", exactErr);
    if (exact) return exact as WhatsappChannel;
  }

  const fallbackCompanyId = process.env.WHATSAPP_DEFAULT_COMPANY_ID ?? "";
  if (fallbackCompanyId) {
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("channels")
      .select("id, company_id, config")
      .eq("company_id", fallbackCompanyId)
      .eq("kind", "whatsapp")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (existingErr) console.error("[whatsapp-webhook] fallback lookup failed", existingErr);
    if (existing) return existing as WhatsappChannel;

    const { data: created, error: createErr } = await supabaseAdmin
      .from("channels")
      .insert({
        company_id: fallbackCompanyId,
        kind: "whatsapp",
        name: "WhatsApp",
        status: "active",
        config: { phone_number_id: phoneNumberId } as Json,
      })
      .select("id, company_id, config")
      .single();

    if (createErr) {
      console.error("[whatsapp-webhook] fallback create channel failed", createErr);
      return null;
    }
    return created as WhatsappChannel;
  }

  const { data: channels, error } = await supabaseAdmin
    .from("channels")
    .select("id, company_id, config")
    .eq("kind", "whatsapp")
    .eq("status", "active")
    .limit(2);

  if (error) {
    console.error("[whatsapp-webhook] single-channel lookup failed", error);
    return null;
  }
  return channels?.length === 1 ? (channels[0] as WhatsappChannel) : null;
}

async function getFirstStageId(companyId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("pipeline_stages")
    .select("id")
    .eq("company_id", companyId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) console.error("[whatsapp-webhook] stage lookup failed", error);
  return data?.id ?? null;
}

async function getWhatsappSourceId(companyId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("lead_sources")
    .select("id")
    .eq("company_id", companyId)
    .eq("slug", "whatsapp-direto")
    .maybeSingle();
  if (error) console.error("[whatsapp-webhook] source lookup failed", error);
  return data?.id ?? null;
}

async function ensureLeadForWhatsappContact(params: {
  companyId: string;
  waId: string;
  displayName: string | null;
  firstMessage: string;
}): Promise<string | null> {
  const phone = `+${params.waId}`;

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingErr) console.error("[whatsapp-webhook] lead lookup failed", existingErr);
  if (existing?.id) return existing.id;

  const stageId = await getFirstStageId(params.companyId);
  if (!stageId) return null;

  const sourceId = await getWhatsappSourceId(params.companyId);
  const name = params.displayName?.trim() || `WhatsApp ${phone}`;

  const { data: lead, error: leadErr } = await supabaseAdmin
    .from("leads")
    .insert({
      company_id: params.companyId,
      stage_id: stageId,
      name,
      phone,
      source: "WhatsApp direto",
      source_id: sourceId,
      status: "open",
      notes: `Criado automaticamente pelo WhatsApp. Primeira mensagem: ${params.firstMessage.slice(0, 500)}`,
    })
    .select("id")
    .single();

  if (leadErr) {
    console.error("[whatsapp-webhook] lead create failed", leadErr);
    return null;
  }

  await supabaseAdmin.from("lead_activities").insert({
    company_id: params.companyId,
    lead_id: lead.id,
    kind: "created",
    payload: {
      source: "whatsapp_webhook",
      phone,
      first_message: params.firstMessage.slice(0, 500),
    } as Json,
  });

  return lead.id;
}

function extractInboundBody(message: WhatsappInboundMessage): string {
  if (message.type === "text" && message.text?.body) return message.text.body;
  if (message.type === "button" && message.button?.text) return message.button.text;
  if (message.type === "interactive") {
    return (
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      "[resposta interativa recebida]"
    );
  }
  if (message.image?.caption) return `[imagem] ${message.image.caption}`;
  if (message.document?.caption) return `[documento] ${message.document.caption}`;
  if (message.document?.filename) return `[documento] ${message.document.filename}`;
  return `[${message.type ?? "mensagem"} recebida — MVP suporta texto no CRM]`;
}

function findContactName(contacts: WhatsappContact[] | undefined, waId: string): string | null {
  const contact = (contacts ?? []).find((c) => c.wa_id === waId) ?? contacts?.[0];
  return contact?.profile?.name?.trim() || null;
}

async function ensureConversation(params: {
  companyId: string;
  channelId: string;
  waId: string;
  displayName: string | null;
  leadId: string | null;
  body: string;
}): Promise<{ conversationId: string; unreadCount: number }> {
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("conversations")
    .select("id, unread_count, status, lead_id")
    .eq("company_id", params.companyId)
    .eq("channel_id", params.channelId)
    .eq("external_thread_id", params.waId)
    .maybeSingle();

  if (existingErr) console.error("[whatsapp-webhook] conversation lookup failed", existingErr);

  if (existing?.id) {
    if (!existing.lead_id && params.leadId) {
      await supabaseAdmin
        .from("conversations")
        .update({ lead_id: params.leadId })
        .eq("id", existing.id)
        .eq("company_id", params.companyId);
    }
    if (existing.status === "closed") {
      await supabaseAdmin
        .from("conversations")
        .update({ status: "open" })
        .eq("id", existing.id)
        .eq("company_id", params.companyId);
    }
    return { conversationId: existing.id, unreadCount: existing.unread_count ?? 0 };
  }

  const { data: created, error: createErr } = await supabaseAdmin
    .from("conversations")
    .insert({
      company_id: params.companyId,
      channel_id: params.channelId,
      external_thread_id: params.waId,
      subject: params.displayName ? `WhatsApp — ${params.displayName}` : `WhatsApp — +${params.waId}`,
      status: "open",
      priority: "normal",
      lead_id: params.leadId,
      unread_count: 0,
      metadata: {
        source: "whatsapp_webhook",
        first_message_preview: params.body.slice(0, 240),
      } as Json,
    })
    .select("id, unread_count")
    .single();

  if (createErr) throw createErr;

  return { conversationId: created.id, unreadCount: created.unread_count ?? 0 };
}

async function ensureContactParticipant(params: {
  companyId: string;
  conversationId: string;
  waId: string;
  displayName: string | null;
}) {
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from("conversation_participants")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("conversation_id", params.conversationId)
    .eq("kind", "contact")
    .eq("contact_handle", params.waId)
    .maybeSingle();

  if (lookupErr) console.error("[whatsapp-webhook] participant lookup failed", lookupErr);
  if (existing?.id) return;

  const { error } = await supabaseAdmin.from("conversation_participants").insert({
    company_id: params.companyId,
    conversation_id: params.conversationId,
    kind: "contact",
    contact_handle: params.waId,
    display_name: params.displayName,
  });

  if (error) console.error("[whatsapp-webhook] participant insert failed", error);
}

async function handleInboundMessage(params: {
  channel: WhatsappChannel;
  contacts?: WhatsappContact[];
  message: WhatsappInboundMessage;
}): Promise<boolean> {
  const externalMessageId = params.message.id ?? "";
  const waId = normalizeWhatsappHandle(params.message.from);
  if (!externalMessageId || !waId) return false;

  const { data: duplicate } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("company_id", params.channel.company_id)
    .eq("external_message_id", externalMessageId)
    .maybeSingle();
  if (duplicate?.id) return false;

  const body = extractInboundBody(params.message).trim().slice(0, 8000);
  if (!body) return false;

  const displayName = findContactName(params.contacts, waId);
  const leadId = await ensureLeadForWhatsappContact({
    companyId: params.channel.company_id,
    waId,
    displayName,
    firstMessage: body,
  });

  const conversation = await ensureConversation({
    companyId: params.channel.company_id,
    channelId: params.channel.id,
    waId,
    displayName,
    leadId,
    body,
  });

  await ensureContactParticipant({
    companyId: params.channel.company_id,
    conversationId: conversation.conversationId,
    waId,
    displayName,
  });

  const createdAt = params.message.timestamp
    ? new Date(Number(params.message.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const { error: msgErr } = await supabaseAdmin.from("messages").insert({
    company_id: params.channel.company_id,
    conversation_id: conversation.conversationId,
    direction: "inbound",
    message_type: "text",
    sender_kind: "contact",
    sender_handle: waId,
    body,
    attachments: [] as Json,
    external_message_id: externalMessageId,
    created_at: createdAt,
  });

  if (msgErr) {
    console.error("[whatsapp-webhook] message insert failed", msgErr);
    return false;
  }

  await supabaseAdmin
    .from("conversations")
    .update({
      last_message_at: createdAt,
      status: "open",
      unread_count: conversation.unreadCount + 1,
    })
    .eq("id", conversation.conversationId)
    .eq("company_id", params.channel.company_id);

  return true;
}

function mapWhatsappStatus(status: string | undefined): "queued" | "sent" | "delivered" | "read" | "failed" {
  switch (status) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    default:
      return "queued";
  }
}

async function handleStatus(params: { channel: WhatsappChannel; status: WhatsappStatus }): Promise<boolean> {
  const externalMessageId = params.status.id ?? "";
  if (!externalMessageId) return false;

  const { data: message, error: msgLookupErr } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("company_id", params.channel.company_id)
    .eq("external_message_id", externalMessageId)
    .maybeSingle();

  if (msgLookupErr) console.error("[whatsapp-webhook] status message lookup failed", msgLookupErr);
  if (!message?.id) return false;

  const errorText = params.status.errors?.[0]
    ? params.status.errors[0].error_data?.details ??
      params.status.errors[0].message ??
      params.status.errors[0].title ??
      "WhatsApp delivery failed"
    : null;

  const { error } = await supabaseAdmin
    .from("message_status")
    .update({
      state: mapWhatsappStatus(params.status.status),
      error: errorText,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", params.channel.company_id)
    .eq("message_id", message.id);

  if (error) console.error("[whatsapp-webhook] status update failed", error);
  return !error;
}

export async function processWhatsappWebhook(payload: WhatsappWebhookPayload) {
  let received = 0;
  let statuses = 0;
  let skipped = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id ?? "";
      const channel = await resolveWhatsappChannel(phoneNumberId);

      if (!channel) {
        skipped += (value?.messages?.length ?? 0) + (value?.statuses?.length ?? 0);
        console.error("[whatsapp-webhook] channel not found", { phoneNumberId });
        continue;
      }

      for (const message of value?.messages ?? []) {
        if (await handleInboundMessage({ channel, contacts: value?.contacts, message })) {
          received += 1;
        } else {
          skipped += 1;
        }
      }

      for (const status of value?.statuses ?? []) {
        if (await handleStatus({ channel, status })) {
          statuses += 1;
        } else {
          skipped += 1;
        }
      }
    }
  }

  return { ok: true, received, statuses, skipped };
}

export async function sendWhatsappText(params: {
  to: string;
  body: string;
  channelConfig?: Json;
}): Promise<{ ok: true; messageId: string | null } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  if (!token) return { ok: false, error: "WHATSAPP_ACCESS_TOKEN ausente" };

  const configuredPhoneNumberId = params.channelConfig
    ? getConfigString(params.channelConfig, "phone_number_id")
    : null;
  const phoneNumberId = configuredPhoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  if (!phoneNumberId) return { ok: false, error: "WHATSAPP_PHONE_NUMBER_ID ausente" };

  const to = normalizeWhatsappHandle(params.to);
  if (!to) return { ok: false, error: "destinatário WhatsApp inválido" };

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: params.body,
      },
    }),
  });

  const responseText = await res.text();
  let parsed: { messages?: Array<{ id?: string }>; error?: { message?: string } } | null = null;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      error: parsed?.error?.message ?? responseText.slice(0, 500) ?? `HTTP ${res.status}`,
    };
  }

  return { ok: true, messageId: parsed?.messages?.[0]?.id ?? null };
}
