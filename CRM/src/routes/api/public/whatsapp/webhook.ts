import { createFileRoute } from "@tanstack/react-router";

import { processWhatsappWebhook, verifyMetaSignature } from "@/lib/whatsapp-mvp.server";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? "";

        if (mode === "subscribe" && challenge && expected && token === expected) {
          return new Response(challenge, { status: 200 });
        }

        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-hub-signature-256");

        if (!verifyMetaSignature(rawBody, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }

        try {
          const result = await processWhatsappWebhook(payload as never);
          return Response.json(result, { status: 200 });
        } catch (err) {
          console.error("[whatsapp-webhook] fatal", err);
          // Meta precisa receber 200 em produção para não ficar reenviando lixo.
          return Response.json({ ok: false, error: "webhook_processing_failed" }, { status: 200 });
        }
      },
    },
  },
});
