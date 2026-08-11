"use client";

import { useRef, useState } from "react";
import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_INVALID_MESSAGE,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_RATE_LIMIT_MESSAGE,
  CONTACT_SENT_MESSAGE,
  CONTACT_SESSION_TYPES,
  CONTACT_TEMPORARY_MESSAGE,
} from "@/modules/contact/contact-http";

type ContactResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function submitContactRequest(
  body: Record<string, FormDataEntryValue>,
  fetcher: typeof fetch = fetch
): Promise<ContactResult> {
  try {
    const response = await fetcher("/api/contact", {
      method: "POST",
      credentials: "omit",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; message?: string; error?: string }
      | null;

    if (response.ok && payload?.ok === true) {
      return { status: "success", message: payload.message ?? CONTACT_SENT_MESSAGE };
    }
    if (response.status === 400) {
      return { status: "error", message: payload?.error ?? CONTACT_INVALID_MESSAGE };
    }
    if (response.status === 429) {
      return { status: "error", message: payload?.error ?? CONTACT_RATE_LIMIT_MESSAGE };
    }
    return { status: "error", message: CONTACT_TEMPORARY_MESSAGE };
  } catch {
    return { status: "error", message: CONTACT_TEMPORARY_MESSAGE };
  }
}

export function ContactForm() {
  const submittingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<ContactResult>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());

    submittingRef.current = true;
    setPending(true);
    setNotice(undefined);
    const result = await submitContactRequest(body);
    if (result.status === "success") form.reset();
    setNotice(result);
    submittingRef.current = false;
    setPending(false);
  }

  return (
    <form aria-busy={pending} className="contact-form" onSubmit={submit}>
      <div className="form-row">
        <Field label="Nombre">
          <input autoComplete="name" disabled={pending} maxLength={CONTACT_NAME_MAX_LENGTH} minLength={2} name="name" required type="text" />
        </Field>
        <Field label="Email">
          <input autoComplete="email" disabled={pending} inputMode="email" maxLength={CONTACT_EMAIL_MAX_LENGTH} name="email" required type="email" />
        </Field>
      </div>
      <Field label="Tipo de sesión (opcional)">
        <select defaultValue="" disabled={pending} name="sessionType">
          <option value="">Selecciona una opción</option>
          {CONTACT_SESSION_TYPES.map((sessionType) => <option key={sessionType} value={sessionType}>{sessionType}</option>)}
        </select>
      </Field>
      <Field label="Mensaje">
        <textarea disabled={pending} maxLength={CONTACT_MESSAGE_MAX_LENGTH} minLength={CONTACT_MESSAGE_MIN_LENGTH} name="message" placeholder="Personaje, ánimo, referencias, fechas..." required rows={5} />
      </Field>
      <label aria-hidden="true" className="contact-honeypot">
        <span>Sitio web</span>
        <input autoComplete="off" disabled={pending} name="website" tabIndex={-1} type="text" />
      </label>
      <button className="solid-btn" disabled={pending} type="submit">
        {pending ? "Enviando…" : "Enviar mensaje"}
      </button>
      <div aria-live="polite">
        {notice && <p className={`contact-status ${notice.status}`} role={notice.status === "error" ? "alert" : "status"}>{notice.message}</p>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="meta">{label}</span>{children}</label>;
}
