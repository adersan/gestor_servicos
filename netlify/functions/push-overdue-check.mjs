import { billingOpenAmount, json, supabase } from "./_shared/server.mjs";
import { sendPushToAllAdmins } from "./_shared/push.mjs";

export const config = { schedule: "*/30 * * * *" };

function money(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

async function alreadyNotified(key) {
  const rows = await supabase(`/rest/v1/push_notified_alerts?alert_key=eq.${encodeURIComponent(key)}&select=alert_key`);
  return rows.length > 0;
}

async function markNotified(key) {
  await supabase("/rest/v1/push_notified_alerts", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({ alert_key: key })
  }).catch(() => {});
}

async function checkOverdueServices() {
  const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
  const rows = await supabase(
    `/rest/v1/service_entries?status=eq.${encodeURIComponent("A fazer")}&created_at=lte.${encodeURIComponent(cutoff)}&select=id,service_name,clients(name)`
  );
  for (const row of rows) {
    const key = `service:${row.id}`;
    if (await alreadyNotified(key)) continue;
    await sendPushToAllAdmins({
      title: "Serviço atrasado",
      body: `${row.clients?.name || "Cliente"}: ${row.service_name}`,
      tag: key,
      url: "/#services"
    }).catch((error) => console.error("Falha ao enviar push de serviço atrasado:", error.message));
    await markNotified(key);
  }
}

async function checkOverdueBillings() {
  const today = new Date().toISOString().slice(0, 10);
  const billings = await supabase(
    `/rest/v1/billings?status=neq.${encodeURIComponent("Cancelada")}&select=id,client_id,period_end,total_due,created_at,snapshot,clients(name)&order=created_at.desc`
  );
  const latestByClient = new Map();
  for (const billing of billings) {
    if (!latestByClient.has(billing.client_id)) latestByClient.set(billing.client_id, billing);
  }
  for (const billing of latestByClient.values()) {
    if (!(billing.period_end < today)) continue;
    const payments = await supabase(`/rest/v1/payments?billing_id=eq.${encodeURIComponent(billing.id)}&select=amount,created_at`);
    const open = billingOpenAmount(billing, payments);
    if (open <= 0) continue;
    const key = `billing:${billing.id}`;
    if (await alreadyNotified(key)) continue;
    await sendPushToAllAdmins({
      title: "Cobrança atrasada",
      body: `${billing.clients?.name || "Cliente"}: ${money(open)} em aberto`,
      tag: key,
      url: "/#billing"
    }).catch((error) => console.error("Falha ao enviar push de cobrança atrasada:", error.message));
    await markNotified(key);
  }
}

export default async () => {
  try {
    await checkOverdueServices();
    await checkOverdueBillings();
    return json(200, { ok: true });
  } catch (error) {
    console.error("push-overdue-check falhou:", error.message);
    return json(500, { error: error.message });
  }
};
