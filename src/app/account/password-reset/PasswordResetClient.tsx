"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ACCOUNT_PASSWORD_MAX_BYTES,
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
} from "@/modules/accounts/account-password-policy";
import {
  PASSWORD_RESET_PASSWORD_MESSAGE,
  PASSWORD_RESET_TEMPORARY_MESSAGE,
  PASSWORD_RESET_UNAVAILABLE_MESSAGE,
} from "@/modules/password-recovery/password-reset-http";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function capturePasswordResetToken(
  location: Pick<Location, "hash" | "pathname">,
  history: Pick<History, "replaceState">
): string | null {
  const fragment = location.hash.startsWith("#")
    ? location.hash.slice(1)
    : "";
  history.replaceState(null, "", location.pathname);
  const token = new URLSearchParams(fragment).get("token");
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

export function validatePasswordResetForm(
  password: string,
  confirmation: string
): "mismatch" | "password" | null {
  if (password !== confirmation) {
    return "mismatch";
  }
  if (
    password.length < ACCOUNT_PASSWORD_MIN_LENGTH ||
    password.length > ACCOUNT_PASSWORD_MAX_LENGTH ||
    password.trim().length === 0 ||
    new TextEncoder().encode(password).byteLength >
      ACCOUNT_PASSWORD_MAX_BYTES
  ) {
    return "password";
  }
  return null;
}

export function PasswordResetClient() {
  const tokenRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const submittingRef = useRef(false);
  const [status, setStatus] = useState<
    "loading" | "ready" | "success" | "unavailable"
  >("loading");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;
    tokenRef.current = capturePasswordResetToken(
      window.location,
      window.history
    );
    setStatus(tokenRef.current ? "ready" : "unavailable");
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || !tokenRef.current) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = formData.get("password");
    const confirmation = formData.get("passwordConfirmation");
    if (
      typeof password !== "string" ||
      typeof confirmation !== "string"
    ) {
      setError(PASSWORD_RESET_PASSWORD_MESSAGE);
      return;
    }

    const validation = validatePasswordResetForm(password, confirmation);
    if (validation) {
      setError(
        validation === "mismatch"
          ? "Las contraseñas no coinciden."
          : PASSWORD_RESET_PASSWORD_MESSAGE
      );
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/account-password-reset", {
        method: "POST",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: tokenRef.current,
          password,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (response.ok && payload?.ok === true) {
        tokenRef.current = null;
        form.reset();
        setStatus("success");
        return;
      }
      if (response.status === 400) {
        tokenRef.current = null;
        setStatus("unavailable");
        return;
      }
      setError(payload?.message ?? PASSWORD_RESET_TEMPORARY_MESSAGE);
    } catch {
      setError(PASSWORD_RESET_TEMPORARY_MESSAGE);
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  if (status === "loading") {
    return (
      <header className="login-card__header" aria-live="polite">
        <span className="meta">Recuperación de cuenta</span>
        <h1>Preparando restablecimiento…</h1>
      </header>
    );
  }

  if (status === "unavailable") {
    return (
      <header className="login-card__header">
        <span className="meta">Recuperación de cuenta</span>
        <h1>Este enlace no está disponible.</h1>
        <p>{PASSWORD_RESET_UNAVAILABLE_MESSAGE} Solicita uno nuevo.</p>
      </header>
    );
  }

  if (status === "success") {
    return (
      <>
        <header className="login-card__header" aria-live="polite">
          <span className="meta">Contraseña actualizada</span>
          <h1>Tu acceso está listo.</h1>
          <p>La contraseña fue actualizada. Inicia sesión nuevamente.</p>
        </header>
        <Link className="login-primary password-reset-login" href="/login">
          Ir al inicio de sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <header className="login-card__header">
        <span className="meta">Recuperación de cuenta</span>
        <h1>Define una nueva contraseña.</h1>
        <p>La usaremos en tu próximo inicio de sesión.</p>
      </header>
      <form
        aria-busy={pending}
        className="login-form"
        onSubmit={submit}
      >
        <div aria-live="polite">
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <label className="login-field">
          <span>Nueva contraseña</span>
          <input
            autoComplete="new-password"
            disabled={pending}
            maxLength={ACCOUNT_PASSWORD_MAX_LENGTH}
            minLength={ACCOUNT_PASSWORD_MIN_LENGTH}
            name="password"
            required
            type="password"
          />
        </label>
        <label className="login-field">
          <span>Confirmar contraseña</span>
          <input
            autoComplete="new-password"
            disabled={pending}
            maxLength={ACCOUNT_PASSWORD_MAX_LENGTH}
            minLength={ACCOUNT_PASSWORD_MIN_LENGTH}
            name="passwordConfirmation"
            required
            type="password"
          />
        </label>
        <p className="acceptance-guidance">
          Entre {ACCOUNT_PASSWORD_MIN_LENGTH} y{" "}
          {ACCOUNT_PASSWORD_MAX_LENGTH} caracteres, con un máximo de{" "}
          {ACCOUNT_PASSWORD_MAX_BYTES} bytes UTF-8.
        </p>
        <button className="login-primary" disabled={pending} type="submit">
          {pending ? "Actualizando…" : "Actualizar contraseña"}
        </button>
      </form>
    </>
  );
}
