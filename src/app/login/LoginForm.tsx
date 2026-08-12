"use client";

import { useRef, useState } from "react";
import {
  ACCOUNT_LOGIN_REDIRECT,
  ADMIN_LOGIN_REDIRECT,
  TEMPORARY_LOGIN_MESSAGE,
} from "@/modules/accounts/account-login-http";
import {
  LOGIN_EMAIL_MAX_LENGTH,
  LOGIN_PASSWORD_MAX_LENGTH,
} from "@/modules/accounts/account-login-policy";

export function AccountLoginForm() {
  const submittingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setError(undefined);

    try {
      const response = await fetch("/api/account-login", {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });
      if (response.redirected) {
        const redirectUrl = new URL(response.url);
        const allowedRedirects = [
          ACCOUNT_LOGIN_REDIRECT,
          ADMIN_LOGIN_REDIRECT,
        ];
        if (
          redirectUrl.origin === window.location.origin &&
          allowedRedirects.includes(redirectUrl.pathname)
        ) {
          window.location.assign(redirectUrl.pathname);
          return;
        }
        setError(TEMPORARY_LOGIN_MESSAGE);
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || payload?.ok !== true) {
        setError(payload?.error ?? TEMPORARY_LOGIN_MESSAGE);
        return;
      }
      setError(TEMPORARY_LOGIN_MESSAGE);
    } catch {
      setError(TEMPORARY_LOGIN_MESSAGE);
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <form
      action="/api/account-login"
      aria-busy={pending}
      className="login-form"
      method="post"
      onSubmit={submit}
    >
      <div aria-live="polite">
        {error && (
          <p className="login-error" id="account-login-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <label className="login-field">
        <span>Correo electrónico</span>
        <input
          aria-describedby={error ? "account-login-error" : undefined}
          autoComplete="email"
          inputMode="email"
          maxLength={LOGIN_EMAIL_MAX_LENGTH}
          name="email"
          required
          type="email"
        />
      </label>
      <label className="login-field">
        <span>Contraseña</span>
        <input
          aria-describedby={error ? "account-login-error" : undefined}
          autoComplete="current-password"
          maxLength={LOGIN_PASSWORD_MAX_LENGTH}
          name="password"
          required
          type="password"
        />
      </label>
      <button
        className="login-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Iniciando sesión…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
