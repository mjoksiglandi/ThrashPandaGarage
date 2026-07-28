import "server-only";

import bcrypt from "bcryptjs";
import { sha256TokenHasher } from "@/modules/accounts/secure-token";
import {
  createPrismaPasswordResetStore,
} from "./password-recovery.repository";
import {
  checkPasswordResetRateLimit,
} from "./password-reset-rate-limit";
import {
  createPasswordResetService,
} from "./password-reset.service";

const service = createPasswordResetService({
  store: createPrismaPasswordResetStore(),
  clock: { now: () => new Date() },
  tokenHasher: sha256TokenHasher,
  passwordHasher: {
    hash: (password) => bcrypt.hash(password, 12),
  },
});

export class PasswordResetRateLimitedError extends Error {
  constructor() {
    super("Password reset rate limited");
    this.name = "PasswordResetRateLimitedError";
  }
}

export async function resetAccountPassword(input: {
  token: unknown;
  password: unknown;
  origin: string;
}) {
  if (!checkPasswordResetRateLimit(input)) {
    throw new PasswordResetRateLimitedError();
  }
  return service.reset(input);
}
