/**
 * Mesmas chaves literais de sessionStorage/localStorage do acompanhamento.js
 * vanilla - critico pra nao invalidar sessoes/links ja abertos por clientes
 * quando a flag React for ligada (os dois convivem, lendo/escrevendo nas
 * mesmas chaves).
 */

const TOKEN_KEY = "gestor_servicos_tracking_code";
const FULL_KEY = "gestor_servicos_tracking_full";
const IDENTIFIER_KEY = "gestor_servicos_tracking_identifier";
const PASSWORD_KEY = "gestor_servicos_tracking_password";
const CHOICE_KEY = "gestor_servicos_tracking_choice";
const SERVICE_DISPLAY_KEY = "gestor_servicos_tracking_service_display";

export function getStoredAccessCode(): string {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setStoredAccessCode(value: string): void {
  sessionStorage.setItem(TOKEN_KEY, value);
}

export function getStoredFullAccessCode(): string {
  return sessionStorage.getItem(FULL_KEY) || "";
}

export function setStoredFullAccessCode(value: string): void {
  sessionStorage.setItem(FULL_KEY, value);
}

export function getStoredChoice(): string | null {
  return sessionStorage.getItem(CHOICE_KEY);
}

export function setStoredChoice(value: string): void {
  sessionStorage.setItem(CHOICE_KEY, value);
}

export function clearStoredChoice(): void {
  sessionStorage.removeItem(CHOICE_KEY);
}

export function getStoredFullCredentials(): { fullAccessCode?: string; identifier?: string; password?: string } {
  const fullAccessCode = getStoredFullAccessCode();
  const identifier = sessionStorage.getItem(IDENTIFIER_KEY) || "";
  const password = sessionStorage.getItem(PASSWORD_KEY) || "";
  const credentials: { fullAccessCode?: string; identifier?: string; password?: string } = {};
  if (fullAccessCode) credentials.fullAccessCode = fullAccessCode;
  if (identifier) credentials.identifier = identifier;
  if (password) credentials.password = password;
  return credentials;
}

export function setStoredFullIdentityCredentials(identifier: string, password: string): void {
  sessionStorage.setItem(IDENTIFIER_KEY, identifier);
  sessionStorage.setItem(PASSWORD_KEY, password);
}

export function getStoredServiceDisplayMode(): "simple" | "full" {
  return localStorage.getItem(SERVICE_DISPLAY_KEY) === "simple" ? "simple" : "full";
}

export function setStoredServiceDisplayMode(mode: "simple" | "full"): void {
  localStorage.setItem(SERVICE_DISPLAY_KEY, mode);
}
