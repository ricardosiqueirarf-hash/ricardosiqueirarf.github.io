import type { Json } from "@/integrations/supabase/types";
import type { ChannelKind } from "@/lib/inbox-format";
import { sendWhatsappText } from "@/lib/whatsapp-mvp.server";

export type SendMessageInput = {
  conversationId: string;
  companyId: string;
  channelKind: ChannelKind;
  channelConfig?: Json;
  body: string;
  messageType: "text" | "template" | "attachment_stub";
  recipients: Array<
    | { kind: "agent"; userId: string }
    | { kind: "contact"; handle: string }
  >;
};

export type SendMessageResult = {
  state: "queued" | "sent" | "delivered" | "failed";
  externalMessageId?: string | null;
  error?: string | null;
};

export interface ChannelAdapter {
  kind: ChannelKind;
  send(input: SendMessageInput): Promise<SendMessageResult>;
}

/* InternalAdapter — não toca rede; marca como sent imediatamente. */
const InternalAdapter: ChannelAdapter = {
  kind: "internal",
  async send() {
    return { state: "sent", externalMessageId: null };
  },
};

/* WhatsApp Cloud API — MVP oficial. */
const WhatsappCloudAdapter: ChannelAdapter = {
  kind: "whatsapp",
  async send(input) {
    const recipient = input.recipients.find((r) => r.kind === "contact");
    if (!recipient || recipient.kind !== "contact") {
      return { state: "failed", error: "sem destinatário WhatsApp" };
    }

    const result = await sendWhatsappText({
      to: recipient.handle,
      body: input.body,
      channelConfig: input.channelConfig,
    });

    if (!result.ok) {
      return { state: "failed", externalMessageId: null, error: result.error };
    }

    return { state: "sent", externalMessageId: result.messageId };
  },
};

const NoopWebchatAdapter: ChannelAdapter = {
  kind: "webchat",
  async send() {
    return { state: "queued", externalMessageId: null };
  },
};

const NoopEmailAdapter: ChannelAdapter = {
  kind: "email",
  async send() {
    return { state: "queued", externalMessageId: null };
  },
};

const REGISTRY: Record<ChannelKind, ChannelAdapter> = {
  internal: InternalAdapter,
  whatsapp: WhatsappCloudAdapter,
  webchat: NoopWebchatAdapter,
  email: NoopEmailAdapter,
};

export function getAdapter(kind: ChannelKind): ChannelAdapter {
  return REGISTRY[kind] ?? InternalAdapter;
}
