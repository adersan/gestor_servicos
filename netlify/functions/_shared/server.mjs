import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";

export function env(name) {
  const value = globalThis.Netlify?.env?.get(name) || process.env[name];
  if (!value) throw new Error(`Variável ${name} não configurada.`);
  return value;
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function supabase(path, options = {}) {
  const secret = env("SUPABASE_SECRET_KEY");
  const authorizationToken = options.token || (secret.startsWith("eyJ") ? secret : "");
  const authorization = authorizationToken
    ? { Authorization: `Bearer ${authorizationToken}` }
    : {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(`${env("SUPABASE_URL")}${path}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        apikey: secret,
        ...authorization,
        "Content-Type": "application/json",
        Prefer: options.prefer || "",
        ...options.headers
      }
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("O banco demorou demais para responder.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || data?.hint || "Falha ao acessar o banco.");
  }
  return data;
}

export async function requireAdmin(request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new Error("Acesso administrativo não autorizado.");

  const user = await supabase("/auth/v1/user", { token });
  const rows = await supabase(`/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`);
  if (!rows?.length) throw new Error("Acesso administrativo não autorizado.");
  return user;
}

export function identifierHash(identifier) {
  return createHash("sha256").update(identifier.trim().toUpperCase()).digest("hex");
}

export function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [algorithm, salt, expectedHex] = String(stored).split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function randomIdentifier() {
  return `GS-${String(randomBytes(4).readUInt32BE() % 100000000).padStart(8, "0")}`;
}

export function randomPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(randomBytes(10), (byte) => alphabet[byte % alphabet.length]).join("");
}

export function randomAccessCode() {
  return randomBytes(32).toString("base64url");
}

export function accessCodeHash(code) {
  return createHash("sha256").update(String(code || "")).digest("hex");
}

export class BillingPaymentError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function findDuplicatePayment(externalId) {
  if (!externalId) return null;
  const duplicate = await supabase(
    `/rest/v1/payments?external_payment_id=eq.${encodeURIComponent(externalId)}&select=id,billing_id,amount&limit=1`
  );
  return duplicate[0] || null;
}

// external_reference do Mercado Pago: "advance:<clientId>" para pagamento antecipado
// (gerado antes de existir cobrança, vira credito/solto) ou o proprio billingId (fluxo de cobrança).
export function parsePaymentReference(reference) {
  const trimmed = String(reference || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("advance:")) {
    const clientId = trimmed.slice("advance:".length).trim();
    return clientId ? { type: "advance", clientId } : null;
  }
  return { type: "billing", billingId: trimmed };
}

export async function applyAdvancePayment({ clientId, amount, date, method, note, source, externalId }) {
  const duplicate = await findDuplicatePayment(externalId);
  if (duplicate) return { processed: false, duplicate: true, paymentId: duplicate.id };

  const clients = await supabase(`/rest/v1/clients?id=eq.${encodeURIComponent(clientId)}&select=id&limit=1`);
  if (!clients.length) throw new BillingPaymentError(404, "Cliente não encontrado.");

  const paymentId = crypto.randomUUID();
  await supabase("/rest/v1/payments", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      id: paymentId,
      client_id: clientId,
      billing_id: null,
      payment_date: date,
      amount,
      method,
      notes: note,
      external_payment_id: externalId || null,
      payment_source: source
    })
  });

  return { processed: true, paymentId, clientId, billingId: null };
}

export async function applyPaymentToBilling({ billingId, amount, date, method, note, source, externalId, capExcessAsFee = false }) {
  const duplicate = await findDuplicatePayment(externalId);
  if (duplicate) return { processed: false, duplicate: true, paymentId: duplicate.id };

  const billings = await supabase(
    `/rest/v1/billings?id=eq.${encodeURIComponent(billingId)}&select=id,client_id,total_due,status,created_at,snapshot&limit=1`
  );
  const billing = billings[0];
  if (!billing || billing.status === "Cancelada") throw new BillingPaymentError(404, "Cobrança ativa não encontrada.");
  if (billing.snapshot?.rolledIntoBillingId) {
    throw new BillingPaymentError(409, "Esta cobrança foi consolidada em uma cobrança posterior.");
  }

  const calculationVersion = Number(billing.snapshot?.calculationVersion || 1);
  const createdFilter = calculationVersion >= 2
    ? ""
    : `&created_at=gt.${encodeURIComponent(billing.created_at)}`;
  const existingPayments = await supabase(
    `/rest/v1/payments?billing_id=eq.${encodeURIComponent(billing.id)}${createdFilter}&select=amount,created_at`
  );
  const paid = existingPayments.reduce((sum, item) => sum + Number(item.amount), 0);
  const openAmount = Math.max(0, Number(billing.total_due) - paid);
  if (openAmount <= 0) throw new BillingPaymentError(409, "Cobrança já está paga.");
  // capExcessAsFee: usado quando o valor recebido pode legitimamente exceder o saldo
  // (ex.: acréscimo de forma de pagamento) — o excedente fica como receita da baixa,
  // não vira credito pro cliente (remaining ja fica em 0 pelo Math.max abaixo).
  if (amount > openAmount + 0.001 && !capExcessAsFee) {
    throw new BillingPaymentError(409, "Valor recebido maior que o saldo da cobrança.", { openAmount });
  }

  const paymentId = crypto.randomUUID();
  await supabase("/rest/v1/payments", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      id: paymentId,
      client_id: billing.client_id,
      billing_id: billing.id,
      payment_date: date,
      amount,
      method,
      notes: note,
      external_payment_id: externalId || null,
      payment_source: source
    })
  });

  const remaining = Math.max(0, openAmount - amount);
  const status = remaining <= 0 ? "Paga" : "Parcial";
  await supabase(`/rest/v1/billings?id=eq.${encodeURIComponent(billing.id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ status })
  });

  return { processed: true, paymentId, billingId: billing.id, status, remaining };
}

export function billingOpenAmount(billing, payments) {
  if (billing.snapshot?.rolledIntoBillingId) return 0;
  const calculationVersion = Number(billing.snapshot?.calculationVersion || 1);
  const createdAt = new Date(billing.created_at).getTime();
  const appliedPayments = payments
    .filter((payment) => calculationVersion >= 2 || new Date(payment.created_at).getTime() > createdAt)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  return Math.max(0, Number(billing.total_due) - appliedPayments);
}

export function selectBillingPaymentMethods(billing, methods) {
  const snapshotMethods = Array.isArray(billing.snapshot?.paymentMethods)
    ? billing.snapshot.paymentMethods.map((method) => ({
      id: method.id,
      type: method.type,
      name: method.name,
      details: method.details || "",
      payment_link: method.link || method.payment_link || ""
    }))
    : [];
  const selectedMethodIds = billing.snapshot?.paymentMethodIds || [];
  return snapshotMethods.length
    ? snapshotMethods
    : (selectedMethodIds.length
      ? methods.filter((method) => selectedMethodIds.includes(method.id))
      : methods);
}

export function resolveTrackingTier(link, credentials = {}) {
  const isGated = Boolean(link.identifier_hash || link.full_token_hash);
  if (!isGated) return "full-legacy";
  const { fullAccessCode, identifier, password } = credentials;
  if (fullAccessCode && link.full_token_hash && accessCodeHash(fullAccessCode) === link.full_token_hash) {
    return "full";
  }
  if (identifier && password && link.identifier_hash && link.password_hash
    && identifierHash(identifier) === link.identifier_hash
    && verifyPassword(password, link.password_hash)) {
    return "full";
  }
  return "restricted";
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

export function signPortalToken(payload) {
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", env("CLIENT_PORTAL_SECRET")).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyPortalToken(token) {
  const [body, suppliedSignature] = String(token || "").split(".");
  if (!body || !suppliedSignature) throw new Error("Sessão inválida.");
  const expectedSignature = createHmac("sha256", env("CLIENT_PORTAL_SECRET")).update(body).digest();
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) {
    throw new Error("Sessão inválida.");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Sessão expirada.");
  return payload;
}
