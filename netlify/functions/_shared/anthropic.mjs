import { env } from "./server.mjs";

const BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 30000;
const MODEL = "claude-opus-4-8";

export class AnthropicError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "AnthropicError";
    this.status = status || 502;
    this.details = details;
  }
}

const SIGNATURE_STYLE_SCHEMA = {
  type: "object",
  properties: {
    style: {
      type: "object",
      properties: {
        slant: { type: "number" },
        strokeWidth: { type: "number" },
        letterSpacing: { type: "number" },
        baselineVariation: { type: "number" },
        capitalScale: { type: "number" },
        ascenderScale: { type: "number" },
        descenderScale: { type: "number" },
        roundness: { type: "number" },
        pressureVariation: { type: "number" },
        connectionStyle: { type: "string", enum: ["continuous", "disconnected", "mixed"] }
      },
      required: [
        "slant", "strokeWidth", "letterSpacing", "baselineVariation", "capitalScale",
        "ascenderScale", "descenderScale", "roundness", "pressureVariation", "connectionStyle"
      ],
      additionalProperties: false
    },
    summary: { type: "string" }
  },
  required: ["style", "summary"],
  additionalProperties: false
};

// Prompt restritivo, so analise visual - nunca gerar/reproduzir a caligrafia em si (o
// renderizador local so aplica slant/letterSpacing hoje; os demais campos ficam guardados
// pra evolucao futura, conforme o planejamento original do modulo).
const SIGNATURE_ANALYSIS_SYSTEM_PROMPT = `Você é um analisador de estilo caligráfico.

Analise a imagem enviada somente para identificar características visuais da escrita/assinatura.
Não tente reproduzir, gerar ou copiar a escrita - apenas descreva o estilo em parâmetros numéricos.

Avalie: inclinação média, espessura dos traços, espaçamento entre letras, oscilação da linha de
base, escala relativa de maiúsculas, ascendentes, descendentes, arredondamento, variação de
pressão e estilo de conexão entre letras.

Use estes limites como referência ao escolher os valores:
slant: -30 a 30
strokeWidth: 0.5 a 10
letterSpacing: -10 a 20
baselineVariation: 0 a 10
capitalScale: 0.5 a 2
ascenderScale: 0.5 a 2
descenderScale: 0.5 a 2
roundness: 0 a 1
pressureVariation: 0 a 1
connectionStyle: "continuous", "disconnected" ou "mixed"

O campo "summary" deve ser uma frase curta em português descrevendo o estilo observado.`;

async function callAnthropic(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "x-api-key": env("ANTHROPIC_API_KEY"),
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
        ...options.headers
      }
    });
  } catch (error) {
    if (error.name === "AbortError") throw new AnthropicError("A IA não respondeu a tempo.", 504);
    throw new AnthropicError("Falha de comunicação com a IA.", 502);
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new AnthropicError(body?.error?.message || `IA respondeu com HTTP ${response.status}.`, response.status, body);
  }
  return body;
}

export async function analyzeSignatureStyle({ imageBase64, mediaType }) {
  const message = await callAnthropic("/v1/messages", {
    method: "POST",
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SIGNATURE_ANALYSIS_SYSTEM_PROMPT,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SIGNATURE_STYLE_SCHEMA }
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            {
              type: "text",
              text: "Analise o estilo de escrita/assinatura nesta imagem de referência e retorne os parâmetros conforme o schema fornecido, em português."
            }
          ]
        }
      ]
    })
  });

  if (message.stop_reason === "refusal") {
    throw new AnthropicError("A IA recusou analisar esta imagem.", 422, { refusal: true, stopDetails: message.stop_details });
  }
  const textBlock = (message.content || []).find((block) => block.type === "text");
  if (!textBlock?.text) throw new AnthropicError("A IA não retornou uma análise válida.", 502);
  try {
    return JSON.parse(textBlock.text);
  } catch {
    throw new AnthropicError("A IA retornou um formato inesperado.", 502);
  }
}
