import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./server.mjs";

const BASE_URL = "https://api.mercadopago.com";
const DEFAULT_TIMEOUT_MS = 15000;

export class MercadoPagoError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "MercadoPagoError";
    this.status = status || 502;
    this.details = details;
  }
}

async function callMercadoPago(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env("MERCADOPAGO_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  } catch (error) {
    if (error.name === "AbortError") throw new MercadoPagoError("O Mercado Pago não respondeu a tempo.", 504);
    throw new MercadoPagoError("Falha de comunicação com o Mercado Pago.", 502);
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new MercadoPagoError(body?.message || `Mercado Pago respondeu com HTTP ${response.status}.`, response.status, body);
  }
  return body;
}

export async function createPreference({ title, amount, externalReference, backUrls, notificationUrl }) {
  return callMercadoPago("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [{ title, quantity: 1, unit_price: Number(amount), currency_id: "BRL" }],
      external_reference: externalReference,
      back_urls: backUrls,
      auto_return: "approved",
      notification_url: notificationUrl,
      payment_methods: { installments: 1 }
    })
  });
}

export async function getPayment(paymentId) {
  return callMercadoPago(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

// Formato de assinatura documentado pelo Mercado Pago (header x-signature: "ts=...,v1=...").
// Confirmar contra a documentação atual ao testar com um webhook real antes de confiar em producao.
export function verifyMercadoPagoSignature(incomingRequest, dataId) {
  const signatureHeader = incomingRequest.headers.get("x-signature") || "";
  const requestId = incomingRequest.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.trim().split("=")).filter(([key, value]) => key && value)
  );
  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash || !requestId || !dataId) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", env("MERCADOPAGO_WEBHOOK_SECRET")).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(hash, "hex");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}
