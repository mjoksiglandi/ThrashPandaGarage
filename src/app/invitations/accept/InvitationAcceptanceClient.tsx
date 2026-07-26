"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  acceptInvitationAction,
  inspectInvitationAction,
  type InvitationAcceptanceActionState,
} from "./actions";

const initialActionState: InvitationAcceptanceActionState = {
  status: "available",
};

const errorMessages = {
  mismatch: "Las contraseñas no coinciden.",
  password: "La contraseña no cumple la política indicada.",
  temporary: "No pudimos activar tu cuenta. Inténtalo nuevamente.",
} as const;

function UnavailableInvitation() {
  return (
    <header className="login-card__header">
      <span className="meta">Invitación de cuenta</span>
      <h1>Este enlace no está disponible.</h1>
      <p>
        La invitación puede haber expirado, sido reemplazada o utilizada.
        Solicita un nuevo enlace si necesitas activar tu cuenta.
      </p>
    </header>
  );
}

export function InvitationAcceptanceClient({
  minimumPasswordLength,
  maximumPasswordLength,
}: {
  minimumPasswordLength: number;
  maximumPasswordLength: number;
}) {
  const tokenRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const [availability, setAvailability] = useState<
    "checking" | "available" | "unavailable" | "temporary"
  >("checking");
  const [actionState, formAction, pending] = useActionState(
    async (
      previousState: InvitationAcceptanceActionState,
      formData: FormData
    ) => {
      if (!tokenRef.current) {
        return { status: "unavailable" as const };
      }
      return acceptInvitationAction(
        tokenRef.current,
        previousState,
        formData
      );
    },
    initialActionState
  );

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const encodedToken = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);

    let invitationToken = encodedToken;
    try {
      invitationToken = decodeURIComponent(encodedToken);
    } catch {
      // Keep the malformed value so the server applies the same public policy.
    }

    tokenRef.current = invitationToken;
    inspectInvitationAction(invitationToken)
      .then((state) => setAvailability(state.status))
      .catch(() => setAvailability("temporary"));
  }, []);

  if (
    availability === "unavailable" ||
    actionState.status === "unavailable"
  ) {
    return <UnavailableInvitation />;
  }

  if (availability === "checking") {
    return (
      <header className="login-card__header" aria-live="polite">
        <span className="meta">Invitación de cuenta</span>
        <h1>Validando invitación…</h1>
      </header>
    );
  }

  if (availability === "temporary") {
    return (
      <header className="login-card__header">
        <span className="meta">Invitación de cuenta</span>
        <h1>No pudimos validar el enlace.</h1>
        <p>Inténtalo nuevamente en unos minutos.</p>
      </header>
    );
  }

  const message = actionState.error
    ? errorMessages[actionState.error]
    : undefined;

  return (
    <>
      <header className="login-card__header">
        <span className="meta">Invitación de cuenta</span>
        <h1>Activa tu cuenta.</h1>
        <p>Define la contraseña que usarás para tu acceso privado.</p>
      </header>
      <form action={formAction} className="login-form">
        {message && (
          <p className="login-error" role="alert">
            {message}
          </p>
        )}
        <label className="login-field">
          <span>Contraseña</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={minimumPasswordLength}
            maxLength={maximumPasswordLength}
            required
          />
        </label>
        <label className="login-field">
          <span>Confirmar contraseña</span>
          <input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={minimumPasswordLength}
            maxLength={maximumPasswordLength}
            required
          />
        </label>
        <p className="acceptance-guidance">
          Entre {minimumPasswordLength} y {maximumPasswordLength} caracteres.
          Algunos caracteres pueden ocupar más de un byte.
        </p>
        <button className="login-primary" disabled={pending} type="submit">
          {pending ? "Activando…" : "Activar mi cuenta"}
        </button>
      </form>
    </>
  );
}
