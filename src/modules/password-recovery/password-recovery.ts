import "server-only";

import {
  cryptoTokenGenerator,
  sha256TokenHasher,
} from "@/modules/accounts/secure-token";
import {
  sendPasswordRecoveryEmail,
} from "@/modules/mail/password-recovery-mail";
import {
  createPrismaPasswordRecoveryStore,
} from "./password-recovery.repository";
import {
  PASSWORD_RECOVERY_DURATION_MS,
  createPasswordRecoveryService,
  parsePasswordRecoveryEmail,
} from "./password-recovery.service";
import {
  checkPasswordRecoveryRateLimit,
} from "./password-recovery-rate-limit";

const service = createPasswordRecoveryService({
  store: createPrismaPasswordRecoveryStore(),
  clock: { now: () => new Date() },
  tokenGenerator: cryptoTokenGenerator,
  tokenHasher: sha256TokenHasher,
  durationMs: PASSWORD_RECOVERY_DURATION_MS,
  mailer: {
    send: sendPasswordRecoveryEmail,
  },
  logger: {
    deliveryFailed({ recoveryId, accountId }) {
      console.error("Password recovery email delivery failed", {
        recoveryId,
        accountId,
      });
    },
  },
});

export async function requestAccountPasswordRecovery(input: {
  email: unknown;
  origin: string;
}): Promise<void> {
  const email = parsePasswordRecoveryEmail(input.email);
  if (!checkPasswordRecoveryRateLimit({ email, origin: input.origin })) {
    return;
  }

  try {
    await service.request(email);
  } catch {
    console.error("Password recovery request failed");
  }
}
