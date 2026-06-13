const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const tokenKey = "gestor_servicos_client_token";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function formatDate(value) {
  return value ? value.split("-").reverse().join("/") : "-";
}

async function request(path, options = {}) {
  const response = await fetch(`/.netlify/functions/${path}`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
  return result;
}

function renderStatement(data) {
  const { client, billing, services, payments, paymentMethods } = data;
  document.getElementById("clientName").textContent = client.name;
  document.getElementById("billingPeriod").textContent =
    `${formatDate(billing.period_start)} a ${formatDate(billing.period_end)}`;

  const serviceRows = services.length
    ? services.map((item) => `<tr>
        <td>${formatDate(item.service_date)}</td>
        <td>${escapeHtml(item.service_name)}</td>
        <td>${escapeHtml(item.reference || "-")}</td>
        <td class="amount-service">${money.format(Number(item.amount))}</td>
      </tr>`).join("")
    : `<tr><td colspan="4">Nenhum serviço neste fechamento.</td></tr>`;
  const paymentRows = payments.length
    ? payments.map((item) => `<tr>
        <td>${formatDate(item.payment_date)}</td>
        <td>${escapeHtml(item.method || item.notes || "-")}</td>
        <td class="amount-payment">${money.format(Number(item.amount))}</td>
      </tr>`).join("")
    : `<tr><td colspan="3">Nenhum pagamento neste fechamento.</td></tr>`;
  const methods = paymentMethods.length
    ? paymentMethods.map((method) => `<article class="payment-option">
        <strong>${escapeHtml(method.name)} (${escapeHtml(method.type)})</strong>
        <span>${escapeHtml(method.details || "")}</span>
        ${method.payment_link ? `<a href="${escapeHtml(method.payment_link)}" target="_blank" rel="noopener">Abrir link de pagamento</a>` : ""}
      </article>`).join("")
    : `<p class="meta">Consulte as formas de pagamento com o responsável.</p>`;

  document.getElementById("statementContent").innerHTML = `
    <div class="client-summary">
      <article class="summary-card summary-previous"><span class="summary-dot"></span><span class="meta">Saldo anterior</span><strong>${money.format(Number(billing.previous_balance))}</strong></article>
      <article class="summary-card summary-services"><span class="summary-dot"></span><span class="meta">Serviços</span><strong>${money.format(Number(billing.services_total))}</strong></article>
      <article class="summary-card summary-payments"><span class="summary-dot"></span><span class="meta">Pagamentos</span><strong>${money.format(Number(billing.payments_total))}</strong></article>
      <article class="summary-card summary-total"><span class="summary-dot"></span><span class="meta">Total em aberto</span><strong>${money.format(Number(billing.total_due))}</strong></article>
    </div>
    <section class="client-section section-services">
      <h3>Serviços do período</h3>
      <table class="report-table"><thead><tr><th>Data</th><th>Serviço</th><th>Referência</th><th>Valor</th></tr></thead><tbody>${serviceRows}</tbody></table>
    </section>
    <section class="client-section section-payments">
      <h3>Pagamentos considerados</h3>
      <table class="report-table"><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${paymentRows}</tbody></table>
    </section>
    <section class="client-section">
      <h3>Formas de pagamento</h3>
      <div class="payment-options">${methods}</div>
    </section>`;

  document.getElementById("loginPanel").classList.add("hidden");
  document.getElementById("statementPanel").classList.remove("hidden");
  document.getElementById("logoutButton").classList.remove("hidden");
}

async function loadStatement() {
  const token = sessionStorage.getItem(tokenKey);
  if (!token) return;
  try {
    const data = await request("client-statement", {
      headers: { Authorization: `Bearer ${token}` }
    });
    renderStatement(data);
  } catch {
    sessionStorage.removeItem(tokenKey);
  }
}

document.getElementById("clientLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const error = document.getElementById("loginError");
  const data = new FormData(event.currentTarget);
  error.textContent = "";
  button.disabled = true;
  button.textContent = "Entrando...";
  try {
    const result = await request("client-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: data.get("identifier"),
        password: data.get("password")
      })
    });
    sessionStorage.setItem(tokenKey, result.token);
    await loadStatement();
  } catch (requestError) {
    error.textContent = requestError.message;
  } finally {
    button.disabled = false;
    button.textContent = "Entrar";
  }
});

document.getElementById("logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem(tokenKey);
  location.reload();
});
document.getElementById("printButton").addEventListener("click", () => window.print());

loadStatement();
