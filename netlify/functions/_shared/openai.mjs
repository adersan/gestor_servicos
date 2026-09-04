import { env } from "./server.mjs";

const BASE_URL = "https://api.openai.com";
const DEFAULT_TIMEOUT_MS = 60000;
const MODEL = "gpt-image-2";

export class OpenAIError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "OpenAIError";
    this.status = status || 502;
    this.details = details;
  }
}

// Experimento explicitamente marcado como tal pro usuario (ver app.js/index.html):
// modelos de geracao de imagem genericos nao "aprendem" o estilo de uma foto de
// referencia - o resultado tende a sair generico, sem garantia de parecer com a
// caligrafia enviada. Usa /v1/images/edits (nao /v1/images/generations) porque so
// esse endpoint aceita imagem de referencia junto do prompt.
export async function generateHandwritingImage({ referenceImageBase64, referenceMediaType, text }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const form = new FormData();
  form.append("model", MODEL);
  const buffer = Buffer.from(referenceImageBase64, "base64");
  const blob = new Blob([buffer], { type: referenceMediaType || "image/png" });
  form.append("image[]", blob, "referencia.png");
  form.append(
    "prompt",
    `Handwritten text that reads exactly "${text}", replicating as closely as possible the ` +
      "handwriting style, slant, stroke thickness, letter shapes and connections shown in the " +
      "reference image. Plain solid white background, only the handwritten text, no other " +
      "elements, no watermark, no extra text, no signature line."
  );
  form.append("size", "1024x1024");
  form.append("quality", "medium");
  form.append("n", "1");

  let response;
  try {
    response = await fetch(`${BASE_URL}/v1/images/edits`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}` },
      body: form
    });
  } catch (error) {
    if (error.name === "AbortError") throw new OpenAIError("A IA não respondeu a tempo.", 504);
    throw new OpenAIError("Falha de comunicação com a IA.", 502);
  } finally {
    clearTimeout(timeout);
  }

  const text2 = await response.text();
  const body = text2 ? JSON.parse(text2) : {};
  if (!response.ok) {
    throw new OpenAIError(body?.error?.message || `IA respondeu com HTTP ${response.status}.`, response.status, body);
  }

  const item = body?.data?.[0];
  if (item?.b64_json) return item.b64_json;
  if (item?.url) {
    const imageResponse = await fetch(item.url);
    if (!imageResponse.ok) throw new OpenAIError("Não foi possível baixar a imagem gerada.", 502);
    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  }
  throw new OpenAIError("A IA não retornou uma imagem.", 502);
}
