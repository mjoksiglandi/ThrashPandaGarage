export const CONTACT_NAME_MAX_LENGTH = 80;
export const CONTACT_EMAIL_MAX_LENGTH = 254;
export const CONTACT_MESSAGE_MIN_LENGTH = 10;
export const CONTACT_MESSAGE_MAX_LENGTH = 2_000;

export const CONTACT_SESSION_TYPES = [
  "Retrato",
  "Cosplay",
  "Editorial",
  "Evento",
] as const;

export const CONTACT_SENT_MESSAGE =
  "Tu mensaje fue enviado. Te responderé lo antes posible.";
export const CONTACT_INVALID_MESSAGE =
  "Revisa los campos e intenta nuevamente.";
export const CONTACT_RATE_LIMIT_MESSAGE =
  "Has enviado varios mensajes. Espera un momento antes de intentarlo otra vez.";
export const CONTACT_TEMPORARY_MESSAGE =
  "No pude enviar el mensaje. Intenta nuevamente más tarde.";
