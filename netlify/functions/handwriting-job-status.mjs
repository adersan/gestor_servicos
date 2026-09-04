import { json, requireAdmin, supabase } from "./_shared/server.mjs";

export default async (request) => {
  if (request.method !== "GET") return json(405, { error: "Método não permitido." });

  try {
    await requireAdmin(request);
  } catch (error) {
    return json(401, { error: error.message || "Acesso administrativo não autorizado." });
  }

  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) return json(400, { error: "jobId não informado." });

  try {
    const rows = await supabase(
      `/rest/v1/handwriting_jobs?id=eq.${encodeURIComponent(jobId)}&select=status,result_image_base64,error_message`
    );
    const job = rows?.[0];
    if (!job) return json(200, { status: "pending" });
    return json(200, {
      status: job.status,
      imageBase64: job.result_image_base64 || "",
      errorMessage: job.error_message || ""
    });
  } catch (error) {
    console.error(error);
    return json(500, { error: "Não foi possível consultar o andamento." });
  }
};
