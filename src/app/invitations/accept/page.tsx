import Link from "next/link";
import type { Metadata } from "next";
import {
  ACCEPTANCE_PASSWORD_MAX_LENGTH,
  ACCEPTANCE_PASSWORD_MIN_LENGTH,
} from "@/modules/invitations/invitation.service";
import { InvitationAcceptanceClient } from "./InvitationAcceptanceClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function InvitationAcceptancePage() {
  return (
    <main className="login-stage">
      <div className="login-stage__background" aria-hidden="true" />
      <div className="login-stage__fade" aria-hidden="true" />
      <Link className="login-stage__logo" href="/">
        TRASHPANDA<span>—</span>GARAGE
      </Link>
      <section className="login-card">
        <InvitationAcceptanceClient
          minimumPasswordLength={ACCEPTANCE_PASSWORD_MIN_LENGTH}
          maximumPasswordLength={ACCEPTANCE_PASSWORD_MAX_LENGTH}
        />
        <footer className="login-card__footer">
          <Link href="/contact">Necesito ayuda</Link>
        </footer>
      </section>
      <span className="login-stage__copyright">
        © 2026 Trashpanda Garage
      </span>
    </main>
  );
}
