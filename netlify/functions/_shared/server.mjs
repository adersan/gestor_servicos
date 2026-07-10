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
