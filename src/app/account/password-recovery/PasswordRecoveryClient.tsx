"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  PASSWORD_RECOVERY_INVALID_MESSAGE,
  PASSWORD_RECOVERY_EMAIL_MAX_LENGTH,
  PASSWORD_RECOVERY_PUBLIC_MESSAGE,
  PASSWORD_RECOVERY_TEMPORARY_MESSAGE,
} from "@/modules/password-recovery/password-recovery-http";

type RecoveryRequestResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type Fetcher = typeof fetch;

export async function submitPasswordRecoveryRequest(
  email: string,
  fetcher: Fetcher = fetch
): Promise<RecoveryRequestResult> {
  try {
    const response = await fetcher("/api/account-password-recovery", {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; message?: string; error?: string }
      | null;

    if (response.ok && payload?.ok === true) {
      return {
        status: "success",
        message: payload.message ?? PASSWORD_RECOVERY_PUBLIC_MESSAGE,
      };
    }
    if (response.status === 400) {
      return {
        status: "error",
        message: payload?.error ?? PASSWORD_RECOVERY_INVALID_MESSAGE,
      };
    }
    return { status: "error", message: PASSWORD_RECOVERY_TEMPORARY_MESSAGE };
  } catch {
    return { status: "error", message: PASSWORD_RECOVERY_TEMPORARY_MESSAGE };
  }
}

export function PasswordRecoveryClient() {
  const submittingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<string>();
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const form = event.currentTarget;
    const email = new FormData(form).get("email");
    if (typeof email !== "string") {
      setError(PASSWORD_RECOVERY_INVALID_MESSAGE);
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setError(undefined);
    const result = await submitPasswordRecoveryRequest(email);
    if (result.status === "success") {
      form.reset();
      setSuccess(result.message);
    } else {
      setError(result.message);
    }
    submittingRef.current = false;
    setPending(false);
  }

  if (success) {
    return (
      <>
        <header className="login-card__header" aria-live="polite">
          <span className="meta">Revisa tu correo</span>
          <h1>Solicitud recibida.</h1>
          <p>{success}</p>
        </header>
        <Link className="login-secondary password-reset-login" href="/login">
          Volver al inicio de sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <header className="login-card__header">
        <span className="meta">Recuperación de cuenta</span>
        <h1>Recupera tu acceso.</h1>
        <p>Ingresa el correo asociado a tu cuenta.</p>
      </header>
      <form aria-busy={pending} className="login-form" onSubmit={submit}>
        <div aria-live="polite">
          {error && (
            <p className="login-error" id="password-recovery-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <label className="login-field">
          <span>Correo electrónico</span>
          <input
            aria-describedby={error ? "password-recovery-error" : undefined}
            autoComplete="email"
            disabled={pending}
            inputMode="email"
            maxLength={PASSWORD_RECOVERY_EMAIL_MAX_LENGTH}
            name="email"
            required
            type="email"
          />
        </label>
        <button className="login-primary" disabled={pending} type="submit">
          {pending ? "Enviando…" : "Enviar instrucciones"}
        </button>
      </form>
    </>
  );
}
