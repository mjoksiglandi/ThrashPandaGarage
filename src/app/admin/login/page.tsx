import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginAdmin } from "@/lib/auth";
import { resolveTrustedClientIp } from "@/lib/client-origin";
import { env } from "@/lib/env";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { LoginStage } from "@/components/auth/LoginStage";

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const headerList = await headers();
    const clientIp =
      resolveTrustedClientIp(
        headerList,
        env.TRUSTED_CLIENT_IP_HEADER
      ) ?? "untrusted";
    const rateLimitKey = `login:${clientIp}`;

    if (!checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS)) {
      redirect("/admin/login?error=rate_limit");
    }

    const ok = await loginAdmin(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
    if (!ok) redirect("/admin/login?error=1");

    resetRateLimit(rateLimitKey);
    redirect("/admin");
  }

  const message = error === "rate_limit"
    ? "Demasiados intentos. Espera unos minutos e intenta de nuevo."
    : error === "1" ? "Credenciales inválidas." : undefined;

  return <LoginStage eyebrow="Administración" title="Bienvenido." description="Accede al panel de gestión de Trashpanda Garage." action={login} error={message} submitLabel="Entrar al panel" alternateHref="/portal/login" alternateLabel="Acceso clientes" />;
}
