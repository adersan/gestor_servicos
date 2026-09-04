import { json, requireAdmin } from "./_shared/server.mjs";
import { generateHandwritingImage, OpenAIError } from "./_shared/openai.mjs";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_TEXT_LENGTH = 60;

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

  const { imageBase64, mediaType, text } = body || {};
  const trimmedText = typeof text === "string" ? text.trim() : "";
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return json(400, { error: "Nenhuma imagem de referência enviada." });
  }
  if (!ALLOWED_MIME.includes(mediaType)) {
    return json(400, { error: "Formato de imagem não suportado. Use PNG, JPG ou WEBP." });
  }
  if (Math.ceil((imageBase64.length * 3) / 4) > MAX_IMAGE_BYTES) {
    return json(400, { error: "Imagem muito grande. O limite é 3MB." });
  }
  if (!trimmedText) return json(400, { error: "Digite o texto a ser gerado." });
  if (trimmedText.length > MAX_TEXT_LENGTH) {
    return json(400, { error: `Texto muito longo. O limite é ${MAX_TEXT_LENGTH} caracteres.` });
  }

  try {
    const resultBase64 = await generateHandwritingImage({
      referenceImageBase64: imageBase64,
      referenceMediaType: mediaType,
      text: trimmedText
    });
    return json(200, { imageBase64: resultBase64 });
  } catch (error) {
    console.error(error);
    if (error instanceof OpenAIError) {
      if (error.status === 504) return json(504, { error: "A IA demorou demais para responder. Tente novamente." });
      if (error.status === 429) return json(429, { error: "Limite de uso da IA atingido no momento. Tente novamente em instantes." });
      if (error.status === 400) return json(400, { error: "Não foi possível processar esta imagem/texto. Tente novamente." });
    }
    return json(500, { error: "Não foi possível gerar a imagem no momento." });
  }
};
