"use client";

import { useState } from "react";

export function SessionRevokeButton({
  current,
}: {
  current: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <button
      className={current ? "session-revoke is-current" : "session-revoke"}
      disabled={submitting}
      onClick={(event) => {
        if (
          current &&
          !window.confirm(
            "Cerrar esta sesión te enviará a la pantalla de acceso. ¿Continuar?"
          )
        ) {
          event.preventDefault();
          return;
        }
        setSubmitting(true);
      }}
      type="submit"
    >
      {submitting
        ? "Cerrando…"
        : current
          ? "Cerrar esta sesión"
          : "Cerrar sesión"}
    </button>
  );
}
