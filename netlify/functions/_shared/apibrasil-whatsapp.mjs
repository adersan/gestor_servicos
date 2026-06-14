const DEFAULT_BASE_URL = "https://gateway.apibrasil.io/api/v2";
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * @typedef {Object} ApiBrasilProxy
 * @property {string} url
 * @property {string} username
 * @property {string} password
 */

/**
 * @typedef {Object} StartWhatsAppSessionRequest
 * @property {string} session
 * @property {boolean} qrcode
 * @property {string=} number
 * @property {string=} device_name
 * @property {string=} wh_status
 * @property {string=} wh_message
 * @property {string=} wh_connect
 * @property {string=} wh_qrcode
 * @property {string=} qr_logo_url
 * @property {number=} auto_close
 * @property {boolean=} force_clear_cache
 * @property {"new" | "true" | "false"=} headless
 * @property {boolean=} use_chrome
 * @property {string=} browser
 * @property {string=} powered_by
 * @property {boolean=} enable_proxy
 * @property {ApiBrasilProxy=} proxy
 * @property {boolean=} homolog
 */

/**
 * @typedef {Object} ApiBrasilStartResponse
 * @property {boolean=} success
 * @property {string=} message
 * @property {string=} status
 * @property {string=} qrcode
 * @property {string=} session
 * @property {unknown=} data
 */

export class ApiBrasilError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string=} code
   * @param {unknown=} details
   */
  constructor(message, status, code, details) {
    super(message);
    this.name = "ApiBrasilError";
    this.status = status;
    this.code = code || "APIBRASIL_ERROR";
    this.details = details;
  }
}

export class ApiBrasilWhatsAppClient {
  /**
   * @param {Object} config
   * @param {string} config.deviceToken
   * @param {string} config.bearerToken
   * @param {string=} config.baseUrl
   * @param {number=} config.timeoutMs
   * @param {typeof fetch=} config.httpClient
   */
  constructor({
    deviceToken,
    bearerToken,
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    httpClient = fetch
  }) {
    if (!deviceToken || !bearerToken) {
      throw new ApiBrasilError("Credenciais da APIBrasil não configuradas.", 500, "MISSING_CREDENTIALS");
    }
    this.deviceToken = deviceToken;
    this.bearerToken = bearerToken;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
    this.httpClient = httpClient;
  }

  /**
   * @param {StartWhatsAppSessionRequest} payload
   * @returns {Promise<ApiBrasilStartResponse>}
   */
  async startSession(payload) {
    if (!payload.session?.trim()) {
      throw new ApiBrasilError("O nome da sessão é obrigatório.", 400, "INVALID_SESSION");
    }
    if (typeof payload.qrcode !== "boolean") {
      throw new ApiBrasilError("O campo qrcode deve ser booleano.", 400, "INVALID_QRCODE");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.httpClient(`${this.baseUrl}/whatsapp/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          DeviceToken: this.deviceToken,
          Authorization: `Bearer ${this.bearerToken}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const text = await response.text();
      const body = parseResponse(text);
      if (!response.ok) {
        throw mapApiError(response.status, body);
      }
      return /** @type {ApiBrasilStartResponse} */ (body);
    } catch (error) {
      if (error instanceof ApiBrasilError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiBrasilError(
          `A APIBrasil não respondeu em ${this.timeoutMs / 1000} segundos.`,
          504,
          "APIBRASIL_TIMEOUT"
        );
      }
      throw new ApiBrasilError(
        error instanceof Error ? error.message : "Falha de comunicação com a APIBrasil.",
        502,
        "APIBRASIL_NETWORK_ERROR"
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * @param {string} text
 * @returns {unknown}
 */
function parseResponse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/**
 * @param {number} status
 * @param {unknown} body
 * @returns {ApiBrasilError}
 */
function mapApiError(status, body) {
  const record = isRecord(body) ? body : {};
  const nestedError = isRecord(record.error) ? record.error : {};
  const message = firstString(
    record.message,
    record.error_description,
    nestedError.message,
    `APIBrasil respondeu com HTTP ${status}.`
  );
  const code = firstString(record.code, nestedError.code, `HTTP_${status}`);
  return new ApiBrasilError(message, status, code, body);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {...unknown} values
 * @returns {string}
 */
function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "Erro na APIBrasil.";
}
