import { json, requireAdmin, env } from "./_shared/server.mjs";

const MAX_BYTES = 10 * 1024 * 1024;

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);

    const formData = await request.formData();
    const imagem = formData.get("imagem");
    if (!imagem || typeof imagem.arrayBuffer !== "function") {
      return json(400, { error: "Nenhuma imagem enviada." });
    }
    if (imagem.size > MAX_BYTES) {
      return json(400, { error: "Imagem muito grande. O limite é 10MB." });
    }

    const removeBgForm = new FormData();
    removeBgForm.append("image_file", imagem, imagem.name || "imagem.png");
    removeBgForm.append("size", "auto");

    const removeBgResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": env("REMOVEBG_API_KEY") },
      body: removeBgForm
    });

    if (!removeBgResponse.ok) {
      let message = "Não foi possível remover o fundo da imagem.";
      try {
        const errorBody = await removeBgResponse.json();
        const title = errorBody?.errors?.[0]?.title;
        if (title) message = title;
      } catch (parseError) {
        // corpo de erro não veio em JSON, mantém a mensagem padrão
      }
      if (removeBgResponse.status === 429) message = "Limite mensal do remove.bg atingido. Tente novamente no próximo mês ou troque a chave.";
      return json(removeBgResponse.status === 429 ? 429 : 502, { error: message });
    }

    const buffer = await removeBgResponse.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error(error);
    return json(401, { error: error.message || "Não foi possível remover o fundo da imagem." });
  }
};
