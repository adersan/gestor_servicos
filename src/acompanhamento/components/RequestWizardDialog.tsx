import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { amountText } from "@/acompanhamento/format";
import {
  requestServiceMatch,
  requestServiceOptionLabel,
  trackingRequesterUsageItems,
  trackingServiceUsageItems
} from "@/acompanhamento/grouping";
import type { TrackingApiResponse, TrackingClientRequester } from "@/acompanhamento/types";

const STEP_COUNT = 5;
const PAGE_SIZE = 6;

interface PickerItem {
  id: string;
  label: string;
}

interface RequestWizardDialogProps {
  open: boolean;
  data: TrackingApiResponse;
  onClose: () => void;
  onSubmit: (payload: { serviceId: string; references: string; requestedBy: string; notes: string }) => Promise<void>;
  onAddRequester: (name: string) => Promise<TrackingClientRequester>;
}

function PickerGrid({
  items,
  page,
  selectedId,
  onPrev,
  onNext,
  onSelect,
  onReveal
}: {
  items: PickerItem[];
  page: number;
  selectedId: string;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (id: string) => void;
  onReveal: () => void;
}) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const pageItems = items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {pageItems.length ? (
          pageItems.map((item) => (
            <button
              key={item.id || "none"}
              type="button"
              onClick={() => onSelect(item.id)}
              className={
                item.id === selectedId
                  ? "rounded-xl bg-brand px-3 py-2.5 text-xs font-semibold text-white"
                  : "rounded-xl border border-line bg-surface px-3 py-2.5 text-xs font-semibold text-ink hover:bg-brand-soft"
              }
            >
              {item.label}
            </button>
          ))
        ) : (
          <span className="col-span-full text-xs text-muted">Nada disponível.</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={safePage === 0}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onReveal}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink"
        >
          Buscar
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={safePage >= totalPages - 1}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
        >
          Mais
        </button>
      </div>
    </div>
  );
}

export function RequestWizardDialog({ open, data, onClose, onSubmit, onAddRequester }: RequestWizardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const referenceInputFieldRef = useRef<HTMLInputElement>(null);
  const serviceSearchFieldRef = useRef<HTMLInputElement>(null);
  const requesterSearchFieldRef = useRef<HTMLInputElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const notesFieldRef = useRef<HTMLTextAreaElement>(null);

  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState("");
  const [serviceSearchValue, setServiceSearchValue] = useState("");
  const [serviceSearchRevealed, setServiceSearchRevealed] = useState(false);
  const [requesterSearchRevealed, setRequesterSearchRevealed] = useState(false);
  const [servicePage, setServicePage] = useState(0);
  const [requesterPage, setRequesterPage] = useState(0);
  const [references, setReferences] = useState<string[]>([]);
  const [referenceInput, setReferenceInput] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addingRequester, setAddingRequester] = useState(false);

  const showAmounts = data.showAmounts !== false;
  const requestServices = data.requestServices || [];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setStep(1);
      setServicePage(0);
      setRequesterPage(0);
      setServiceSearchRevealed(false);
      setRequesterSearchRevealed(false);
      setReferences([]);
      setReferenceInput("");
      setRequestedBy("");
      setNotes("");
      setMessage("");
      const firstService = requestServices[0] || null;
      setServiceId(firstService?.id || "");
      setServiceSearchValue(requestServiceOptionLabel(firstService));
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleNativeClose() {
      onClose();
    }
    dialog.addEventListener("close", handleNativeClose);
    return () => dialog.removeEventListener("close", handleNativeClose);
  }, [onClose]);

  const serviceUsageItems = useMemo<PickerItem[]>(() => trackingServiceUsageItems(data), [data]);
  const requesterUsageItems = useMemo<PickerItem[]>(
    () => [{ id: "", label: "Não informar" }, ...trackingRequesterUsageItems(data)],
    [data]
  );

  const selectedService = requestServices.find((item) => item.id === serviceId) || null;
  const amountDisplay = requestServices.length
    ? amountText(selectedService?.amount || 0, showAmounts)
    : "";

  function selectService(itemId: string) {
    const service = requestServices.find((item) => item.id === itemId) || null;
    setServiceId(itemId);
    setServiceSearchValue(service ? requestServiceOptionLabel(service) : "");
    setMessage("");
  }

  function selectRequester(itemId: string) {
    setRequestedBy(itemId);
  }

  function addCurrentReference(): boolean {
    const value = referenceInput.trim().toUpperCase();
    if (!value) return false;
    if (references.includes(value)) {
      setMessage(`Referência já está na lista: ${value}. Confira se não foi digitação errada (ex.: "O" e "0").`);
    } else {
      setReferences((current) => [...current, value]);
    }
    setReferenceInput("");
    return true;
  }

  function removeReference(index: number) {
    setReferences((current) => current.filter((_, i) => i !== index));
  }

  function revealServiceSearch() {
    setServiceSearchRevealed(true);
    setTimeout(() => serviceSearchFieldRef.current?.focus(), 0);
  }

  function revealRequesterSearch() {
    setRequesterSearchRevealed(true);
    setTimeout(() => requesterSearchFieldRef.current?.focus(), 0);
  }

  function focusStep(nextStep: number) {
    setTimeout(() => {
      if (nextStep === 2) referenceInputFieldRef.current?.focus();
      else if (nextStep === 4) notesFieldRef.current?.focus();
      else nextButtonRef.current?.focus();
    }, 0);
  }

  function goToStep(nextStep: number) {
    const clamped = Math.min(Math.max(nextStep, 1), STEP_COUNT);
    setStep(clamped);
    focusStep(clamped);
  }

  function validateStep(current: number): boolean {
    setMessage("");
    if (current === 1) {
      const matched = requestServiceMatch(requestServices, serviceSearchValue);
      if (!matched) {
        setMessage("Selecione um serviço válido da lista.");
        revealServiceSearch();
        return false;
      }
      setServiceId(matched.id);
      return true;
    }
    if (current === 2) {
      const willHaveAtLeastOne = references.length > 0 || Boolean(referenceInput.trim());
      addCurrentReference();
      if (!willHaveAtLeastOne) {
        setMessage("Informe ao menos uma placa ou referência.");
        referenceInputFieldRef.current?.focus();
        return false;
      }
    }
    return true;
  }

  async function handleNext() {
    if (step >= STEP_COUNT) {
      await handleSubmit();
      return;
    }
    if (validateStep(step)) goToStep(step + 1);
  }

  function handleBack() {
    if (step <= 1) return;
    goToStep(step - 1);
  }

  async function handleSubmit() {
    const matched = requestServiceMatch(requestServices, serviceSearchValue);
    if (!matched) {
      setMessage("Selecione um serviço válido da lista.");
      goToStep(1);
      return;
    }
    setSubmitting(true);
    setMessage("Enviando pedido...");
    try {
      await onSubmit({
        serviceId: matched.id,
        references: references.join("\n"),
        requestedBy,
        notes
      });
      setMessage("Pedido enviado com sucesso.");
      onClose();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddRequester() {
    const name = requestedBy.trim().replace(/\s+/g, " ");
    if (!name) {
      setMessage("Informe o nome do solicitante.");
      return;
    }
    setAddingRequester(true);
    setMessage("Cadastrando solicitante...");
    try {
      const requester = await onAddRequester(name);
      setRequestedBy(requester.name);
      setMessage("Solicitante cadastrado.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingRequester(false);
    }
  }

  function handleFieldKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON") return;
    if (target.tagName === "TEXTAREA") {
      if (!notes.trim()) {
        event.preventDefault();
        nextButtonRef.current?.focus();
      }
      return;
    }
    event.preventDefault();
    const name = (target as HTMLInputElement).name;
    if (name === "referenceInput") {
      if (addCurrentReference()) referenceInputFieldRef.current?.focus();
      else handleNext();
      return;
    }
    handleNext();
  }

  const progress = (step / STEP_COUNT) * 100;

  return (
    <dialog
      ref={dialogRef}
      className="rd-root m-auto w-[min(560px,92vw)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="text-lg font-semibold text-ink">Novo pedido</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="text-xl text-muted hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="h-1.5 rounded-full bg-surface-2">
            <div className="h-1.5 rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="mt-1 block text-xs text-muted">Passo {step} de {STEP_COUNT}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5" onKeyDown={handleFieldKeyDown}>
          {step === 1 && (
            <div className="grid gap-3">
              <h3 className="text-sm font-semibold text-ink">Qual serviço?</h3>
              <PickerGrid
                items={serviceUsageItems}
                page={servicePage}
                selectedId={serviceId}
                onPrev={() => setServicePage((p) => Math.max(0, p - 1))}
                onNext={() => setServicePage((p) => p + 1)}
                onSelect={selectService}
                onReveal={revealServiceSearch}
              />
              {serviceSearchRevealed && (
                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Serviço
                  <input
                    ref={serviceSearchFieldRef}
                    name="serviceSearch"
                    type="search"
                    autoComplete="off"
                    list="trackingRequestServiceOptions"
                    placeholder={requestServices.length ? "Digite o código ou nome" : "Nenhum serviço disponível"}
                    disabled={!requestServices.length}
                    value={serviceSearchValue}
                    onChange={(event) => {
                      setServiceSearchValue(event.target.value);
                      const matched = requestServiceMatch(requestServices, event.target.value);
                      if (matched) setServiceId(matched.id);
                    }}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base normal-case text-ink focus:border-brand focus:outline-none"
                  />
                  <datalist id="trackingRequestServiceOptions">
                    {requestServices.map((service) => (
                      <option key={service.id} value={requestServiceOptionLabel(service)} />
                    ))}
                  </datalist>
                </label>
              )}
              <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                Valor
                <input readOnly value={amountDisplay} className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-base normal-case text-ink" />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              <h3 className="text-sm font-semibold text-ink">Placa ou referência</h3>
              <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                Placa/referência
                <span className="flex gap-2">
                  <input
                    ref={referenceInputFieldRef}
                    name="referenceInput"
                    type="text"
                    autoComplete="off"
                    placeholder="Digite e aperte Enter"
                    value={referenceInput}
                    onChange={(event) => setReferenceInput(event.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base normal-case text-ink focus:border-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!addCurrentReference()) referenceInputFieldRef.current?.focus();
                    }}
                    className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-ink"
                  >
                    +
                  </button>
                </span>
              </label>
              {references.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {references.map((reference, index) => (
                    <span key={reference} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-ink">
                      {reference}
                      <button
                        type="button"
                        aria-label={`Remover ${reference}`}
                        onClick={() => removeReference(index)}
                        className="text-muted hover:text-danger"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3">
              <h3 className="text-sm font-semibold text-ink">Quem solicitou?</h3>
              <PickerGrid
                items={requesterUsageItems}
                page={requesterPage}
                selectedId={requestedBy.trim()}
                onPrev={() => setRequesterPage((p) => Math.max(0, p - 1))}
                onNext={() => setRequesterPage((p) => p + 1)}
                onSelect={selectRequester}
                onReveal={revealRequesterSearch}
              />
              {requesterSearchRevealed && (
                <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Quem solicitou
                  <span className="flex gap-2">
                    <input
                      ref={requesterSearchFieldRef}
                      name="requestedBy"
                      list="trackingRequesterOptions"
                      placeholder="Nome do solicitante"
                      value={requestedBy}
                      onChange={(event) => setRequestedBy(event.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base normal-case text-ink focus:border-brand focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={addingRequester}
                      onClick={handleAddRequester}
                      className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
                    >
                      +
                    </button>
                  </span>
                  <datalist id="trackingRequesterOptions">
                    {(data.clientRequesters || []).map((item) => (
                      <option key={item.id} value={item.name} />
                    ))}
                  </datalist>
                </label>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-3">
              <h3 className="text-sm font-semibold text-ink">Observação</h3>
              <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                Observação
                <textarea
                  ref={notesFieldRef}
                  name="notes"
                  rows={3}
                  placeholder="Detalhes importantes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base normal-case text-ink focus:border-brand focus:outline-none"
                />
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="grid gap-3">
              <h3 className="text-sm font-semibold text-ink">Confirmação</h3>
              <div className="grid gap-2">
                {[
                  ["Serviço", serviceSearchValue || "-"],
                  ["Valor", amountDisplay || "-"],
                  ["Placa/referência", references.length === 1 ? "1 referência" : `${references.length} referências`],
                  ["Quem solicitou", requestedBy.trim() || "Não informado"],
                  ...(notes.trim() ? [["Observação", notes.trim()]] : [])
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <span className="text-muted">{label}</span>
                    <strong className="text-right text-ink">{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {message && <p className="mt-3 text-sm text-danger">{message}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line p-4">
          <button
            type="button"
            onClick={handleBack}
            className={step === 1 ? "invisible" : "rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink"}
          >
            Voltar
          </button>
          <button
            ref={nextButtonRef}
            type="button"
            disabled={submitting || (step === 1 && !requestServices.length)}
            onClick={handleNext}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {step === STEP_COUNT ? "Enviar pedido" : "Continuar"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
