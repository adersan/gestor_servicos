import { requireAdmin, supabase } from "./_shared/server.mjs";
import { generateHandwritingImage, OpenAIError } from "./_shared/openai.mjs";

// Atencao: o nome deste arquivo TEM que terminar em "-background" - e assim que a
// Netlify reconhece uma Background Function (ate 15min de limite, contra 60s de uma
// function sincrona normal). A resposta HTTP desta function e sempre ignorada/descartada
// pelo navegador (a Netlify ja manda 202 vazio na hora) - o resultado real so chega ao
// cliente via polling em handwriting-job-status.mjs, consultando a linha gravada aqui.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_TEXT_LENGTH = 60;

async function updateJob(jobId, patch) {
  await supabase(`/rest/v1/handwriting_jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    prefer: "return=minimal"
  });
}

export default async (request) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 202 });
  }
  const { jobId, imageBase64, mediaType, text } = body || {};
  if (!jobId) return new Response(null, { status: 202 });

  try {
    await requireAdmin(request);
  } catch (error) {
    console.error("generate-handwriting-background: acesso negado", error);
    return new Response(null, { status: 202 });
  }

  const trimmedText = typeof text === "string" ? text.trim() : "";
  const invalid = !imageBase64 || typeof imageBase64 !== "string"
    || !ALLOWED_MIME.includes(mediaType)
    || Math.ceil((imageBase64.length * 3) / 4) > MAX_IMAGE_BYTES
    || !trimmedText
    || trimmedText.length > MAX_TEXT_LENGTH;

  if (invalid) {
    await supabase("/rest/v1/handwriting_jobs", {
      method: "POST",
      body: JSON.stringify({ id: jobId, status: "error", error_message: "Dados inválidos para gerar a imagem." }),
      prefer: "return=minimal"
    }).catch((error) => console.error(error));
    return new Response(null, { status: 202 });
  }

  // Grava a linha "pending" antes de comecar - sem isso, uma consulta de status logo
  // apos o envio encontraria a tabela vazia e nao saberia distinguir "ainda nem comecou"
  // de "id invalido".
  await supabase("/rest/v1/handwriting_jobs", {
    method: "POST",
    body: JSON.stringify({ id: jobId, status: "pending" }),
    prefer: "return=minimal"
  }).catch((error) => console.error(error));

  try {
    const resultBase64 = await generateHandwritingImage({
      referenceImageBase64: imageBase64,
      referenceMediaType: mediaType,
      text: trimmedText
    });
    await updateJob(jobId, { status: "done", result_image_base64: resultBase64 });
  } catch (error) {
    console.error(error);
    const message = error instanceof OpenAIError && error.status === 429
      ? "Limite de uso da IA atingido no momento. Tente novamente em instantes."
      : "Não foi possível gerar a imagem no momento.";
    await updateJob(jobId, { status: "error", error_message: message }).catch((updateError) => console.error(updateError));
  }

  return new Response(null, { status: 202 });
};
