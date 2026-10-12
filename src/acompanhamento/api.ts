import type {
  TrackingApiResponse,
  TrackingCredentials,
  TrackingRequesterSaveResult,
  TrackingServiceRequestPayload,
  TrackingServiceRequestResult
} from "@/acompanhamento/types";

async function postJson<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallbackError);
  return data as T;
}

export function fetchTrackingData(
  accessCode: string,
  weekOffset: number,
  credentials: TrackingCredentials = {}
): Promise<TrackingApiResponse> {
  return postJson(
    "/.netlify/functions/service-tracking-data",
    { accessCode, weekOffset, ...credentials },
    "Não foi possível abrir o acompanhamento."
  );
}

export function sendTrackingServiceRequest(
  payload: TrackingServiceRequestPayload
): Promise<TrackingServiceRequestResult> {
  return postJson(
    "/.netlify/functions/tracking-service-request",
    payload,
    "Não foi possível enviar o pedido."
  );
}

export function saveTrackingRequester(payload: {
  accessCode: string;
  name: string;
}): Promise<TrackingRequesterSaveResult> {
  return postJson(
    "/.netlify/functions/tracking-requester-save",
    payload,
    "Não foi possível cadastrar o solicitante."
  );
}
