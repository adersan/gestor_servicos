import { json, requireAdmin } from "./_shared/server.mjs";
import { analyzeSignatureStyle, AnthropicError } from "./_shared/anthropic.mjs";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);
  } catch (authError) {
    return json(401, { error: authError.message || "Acesso administrativo não autorizado." });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Corpo da requisição inválido." });
  }

  const { imageBase64, mediaType } = body || {};
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return json(400, { error: "Nenhuma imagem enviada." });
  }
  if (!ALLOWED_MIME.includes(mediaType)) {
    return json(400, { error: "Formato de imagem não suportado. Use PNG, JPG ou WEBP." });
  }
  if (Math.ceil((imageBase64.length * 3) / 4) > MAX_IMAGE_BYTES) {
    return json(400, { error: "Imagem muito grande. O limite é 3MB." });
  }

  try {
    const result = await analyzeSignatureStyle({ imageBase64, mediaType });
    return json(200, result);
  } catch (error) {
    console.error(error);
    if (error instanceof AnthropicError) {
      if (error.status === 504) return json(504, { error: "A IA demorou demais para responder. Tente novamente." });
      if (error.status === 422) return json(422, { error: "A IA não conseguiu analisar esta imagem. Tente outra referência." });
      if (error.status === 429) return json(429, { error: "Limite de uso da IA atingido no momento. Tente novamente em instantes." });
      if (error.status === 400) return json(400, { error: "Não foi possível processar esta imagem. Verifique o arquivo e tente novamente." });
    }
    return json(500, { error: "Não foi possível analisar a imagem no momento." });
  }
};
