import { useEffect, useState, type FormEvent } from "react";

interface AccessChoiceProps {
  onEnterRestricted: () => void;
  onEnterFull: (identifier: string, password: string) => Promise<void>;
  onPasswordFormVisibleChange: (visible: boolean) => void;
}

export function AccessChoice({ onEnterRestricted, onEnterFull, onPasswordFormVisibleChange }: AccessChoiceProps) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    onPasswordFormVisibleChange(showPasswordForm);
  }, [showPasswordForm, onPasswordFormVisibleChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onEnterFull(identifier.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Como deseja entrar?</h2>
      <p className="mt-2 text-sm text-muted">
        Entre sem senha para só acompanhar os serviços, ou entre com senha para o acesso completo.
      </p>
      {!showPasswordForm && (
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            onClick={onEnterRestricted}
          >
            Entrar sem senha
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-brand-soft"
            onClick={() => setShowPasswordForm(true)}
          >
            Entrar com senha
          </button>
        </div>
      )}
      {showPasswordForm && (
        <form className="mt-5 grid gap-3 text-left" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Identificador
            <input
              name="identifier"
              autoComplete="username"
              required
              placeholder="GS-00000000"
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base normal-case text-ink focus:border-brand focus:outline-none"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) return;
                event.preventDefault();
                (event.currentTarget.form?.elements.namedItem("password") as HTMLInputElement | null)?.focus();
              }}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Senha
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base normal-case text-ink focus:border-brand focus:outline-none"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-brand-soft disabled:opacity-50"
          >
            {submitting ? "Entrando..." : "Entrar com senha"}
          </button>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="justify-self-center text-xs font-semibold text-muted hover:text-ink hover:underline"
            onClick={() => {
              setError("");
              setShowPasswordForm(false);
            }}
          >
            Voltar
          </button>
        </form>
      )}
    </section>
  );
}
